from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import duckdb
from app.auth import get_current_user
from app.datalake.bar_store import archive_old_daily_bars, ingest_eodhd_window, read_daily_bars
from app.datalake.eodhd_queue import (
    enqueue,
    get_counts,
    mark_failed,
    mark_succeeded,
    pop_next,
    reset_stale_running_to_pending,
)
from app.datalake.ingest_jobs import (
    create_ingest_job,
    get_ingest_job,
    get_latest_ingest_job,
    update_ingest_job,
    update_ingest_job_progress,
)
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["datalake-eodhd"])

TP_DUCKDB_PATH: str = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb")


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class EodhdIngestRequest(BaseModel):
    start: date
    end: date

    min_market_cap: int = 50_000_000
    max_market_cap: Optional[int] = None

    exchanges: List[str] = ["NYSE", "NASDAQ"]
    include_etfs: bool = False
    active_only: bool = True

    max_symbols: int = 500


class EodhdIngestResponse(BaseModel):
    requested_start: date
    requested_end: date

    universe_symbols_considered: int
    symbols_selected: int
    symbols_attempted: int
    symbols_succeeded: int
    symbols_failed: int

    rows_observed_after_ingest: int
    failed_symbols: List[str]

    job_id: str
    job_state: str


class EodhdFullHistoryRequest(BaseModel):
    start: date
    end: date

    min_market_cap: int = 50_000_000
    max_market_cap: Optional[int] = None
    exchanges: List[str] = ["NYSE", "NASDAQ"]
    include_etfs: bool = False
    active_only: bool = True
    max_symbols: int = 500

    window_days: int = 365

    # NEW (optional): retention/archiving
    archive_on_finish: bool = False
    archive_keep_days: Optional[int] = Field(
        default=None,
        ge=30,
        description=(
            "If set and archive_on_finish=true, keep this many days in daily_bars "
            "and archive the rest."
        ),
    )


class EodhdFullHistoryResponse(BaseModel):
    start: date
    end: date
    window_days: int
    num_windows: int

    universe_symbols_considered: int
    symbols_selected: int

    total_symbols_attempted: int
    total_symbols_succeeded: int
    total_symbols_failed: int

    total_rows_observed: int


class EodhdFullHistoryStartResponse(BaseModel):
    job_id: str
    start: date
    end: date
    window_days: int


class EodhdJobStatusResponse(BaseModel):
    id: str
    created_at: Optional[str]
    started_at: Optional[str]
    finished_at: Optional[str]
    state: str

    requested_start: date
    requested_end: date
    universe_symbols_considered: int

    symbols_attempted: int
    symbols_succeeded: int
    symbols_failed: int

    last_error: Optional[str]


class EodhdIngestFullHistoryRequest(BaseModel):
    start: date
    min_market_cap: int = 50_000_000
    max_market_cap: Optional[int] = None
    exchanges: List[str] = ["NYSE", "NASDAQ"]
    include_etfs: bool = False
    active_only: bool = True
    max_symbols: int = 500


class EodhdResumableStartResponse(BaseModel):
    job_id: str
    requested_start: date
    requested_end: date
    window_days: int
    queued_items: int


class EodhdJobProgressResponse(BaseModel):
    job_id: str
    state: str
    total: int
    pending: int
    running: int
    succeeded: int
    failed: int
    pct_complete: float


class EodhdArchiveRequest(BaseModel):
    """
    Archive daily bars older than a cutoff.

    keep_days:
      - Keep last N days in daily_bars
      - Move everything older than (today - keep_days) into daily_bars_archive
    """

    keep_days: int = Field(3650, ge=30)  # ~10 years default


class EodhdArchiveResponse(BaseModel):
    cutoff_date: date
    archived: int
    deleted_from_hot: int


# ---------------------------------------------------------------------------
# DuckDB helpers
# ---------------------------------------------------------------------------


def _get_duckdb_connection(read_only: bool = True) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(TP_DUCKDB_PATH)


def _select_universe_symbols(
    min_market_cap: int,
    max_market_cap: Optional[int],
    exchanges: List[str],
    include_etfs: bool,
    active_only: bool,
    max_symbols: int,
) -> List[str]:
    con = _get_duckdb_connection(read_only=True)
    try:
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = 'symbol_universe';"
        ).fetchall()
        if not tables:
            return []

        params: List[Any] = []
        where_clauses: List[str] = []

        if exchanges:
            placeholders = ", ".join(["?"] * len(exchanges))
            where_clauses.append(f"exchange IN ({placeholders})")
            params.extend([ex.upper() for ex in exchanges])

        where_clauses.append("(is_fund IS NULL OR is_fund = FALSE)")
        where_clauses.append("market_cap IS NOT NULL")
        where_clauses.append("market_cap >= ?")
        params.append(float(min_market_cap))

        if max_market_cap is not None:
            where_clauses.append("market_cap <= ?")
            params.append(float(max_market_cap))

        if not include_etfs:
            where_clauses.append("(is_etf IS NULL OR is_etf = FALSE)")

        if active_only:
            where_clauses.append("is_actively_trading = TRUE")

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        sql = f"""
            SELECT symbol
            FROM symbol_universe
            {where_sql}
            ORDER BY market_cap DESC
            LIMIT ?
        """
        params.append(int(max_symbols))

        rows = con.execute(sql, params).fetchall()
        return [r[0] for r in rows]
    finally:
        con.close()


def _build_windows(start: date, end: date, window_days: int) -> List[Tuple[date, date]]:
    windows: List[Tuple[date, date]] = []
    cur = start
    while cur <= end:
        window_end = cur + timedelta(days=window_days - 1)
        if window_end > end:
            window_end = end
        windows.append((cur, window_end))
        cur = window_end + timedelta(days=1)
    return windows


# ---------------------------------------------------------------------------
# NEW: Archive endpoint (manual)
# ---------------------------------------------------------------------------


@router.post("/datalake/eodhd/archive", response_model=EodhdArchiveResponse)
async def archive_daily_bars(
    body: EodhdArchiveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=int(body.keep_days))
    result = archive_old_daily_bars(cutoff_date=cutoff)
    return EodhdArchiveResponse(
        cutoff_date=cutoff,
        archived=int(result["archived"]),
        deleted_from_hot=int(result["deleted_from_hot"]),
    )


# ---------------------------------------------------------------------------
# Existing endpoints (unchanged behavior)
# ---------------------------------------------------------------------------


@router.post("/datalake/eodhd/ingest-window", response_model=EodhdIngestResponse)
async def ingest_eodhd_for_universe(
    payload: EodhdIngestRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    symbols = _select_universe_symbols(
        min_market_cap=payload.min_market_cap,
        max_market_cap=payload.max_market_cap,
        exchanges=payload.exchanges,
        include_etfs=payload.include_etfs,
        active_only=payload.active_only,
        max_symbols=payload.max_symbols,
    )
    universe_count = len(symbols)
    if universe_count == 0:
        raise HTTPException(status_code=400, detail="No symbols matched from symbol_universe.")

    job_id = create_ingest_job(
        requested_start=payload.start,
        requested_end=payload.end,
        universe_symbols_considered=universe_count,
    )

    succeeded = 0
    failed = 0
    failed_symbols: List[str] = []
    total_rows_observed = 0

    try:
        for sym in symbols:
            try:
                await ingest_eodhd_window(symbol=sym, start=payload.start, end=payload.end)
                bars = read_daily_bars(symbol=sym, start=payload.start, end=payload.end)
                total_rows_observed += len(bars)
                succeeded += 1
            except Exception as e:
                failed += 1
                failed_symbols.append(f"{sym}: {e}")

        job_state = "succeeded" if failed == 0 else "failed"
        last_error = None if failed == 0 else "Some symbols failed during ingest."

        update_ingest_job(
            job_id,
            state=job_state,
            symbols_attempted=universe_count,
            symbols_succeeded=succeeded,
            symbols_failed=failed,
            last_error=last_error,
        )

    except Exception as e:
        update_ingest_job(
            job_id,
            state="failed",
            symbols_attempted=universe_count,
            symbols_succeeded=succeeded,
            symbols_failed=max(universe_count - succeeded, failed),
            last_error=str(e),
        )
        raise

    return EodhdIngestResponse(
        requested_start=payload.start,
        requested_end=payload.end,
        universe_symbols_considered=universe_count,
        symbols_selected=universe_count,
        symbols_attempted=universe_count,
        symbols_succeeded=succeeded,
        symbols_failed=failed,
        rows_observed_after_ingest=total_rows_observed,
        failed_symbols=failed_symbols,
        job_id=job_id,
        job_state="succeeded" if failed == 0 else "failed",
    )


@router.post("/datalake/eodhd/ingest-full-history", response_model=EodhdIngestResponse)
async def ingest_eodhd_full_history_route(
    body: EodhdIngestFullHistoryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    start_date = body.start
    end_date = date.today()

    symbols = _select_universe_symbols(
        min_market_cap=body.min_market_cap,
        max_market_cap=body.max_market_cap,
        exchanges=body.exchanges,
        include_etfs=body.include_etfs,
        active_only=body.active_only,
        max_symbols=body.max_symbols,
    )
    universe_count = len(symbols)
    if universe_count == 0:
        raise HTTPException(status_code=400, detail="No symbols matched from symbol_universe.")

    job_id = create_ingest_job(
        requested_start=start_date,
        requested_end=end_date,
        universe_symbols_considered=universe_count,
    )

    succeeded = 0
    failed = 0
    failed_symbols: List[str] = []
    total_rows_observed = 0

    try:
        for sym in symbols:
            try:
                await ingest_eodhd_window(symbol=sym, start=start_date, end=end_date)
                bars = read_daily_bars(symbol=sym, start=start_date, end=end_date)
                total_rows_observed += len(bars)
                succeeded += 1
            except Exception as e:
                failed += 1
                failed_symbols.append(f"{sym}: {e}")

        job_state = "succeeded" if failed == 0 else "failed"
        last_error = None if failed == 0 else "Some symbols failed during ingest."

        update_ingest_job(
            job_id,
            state=job_state,
            symbols_attempted=universe_count,
            symbols_succeeded=succeeded,
            symbols_failed=failed,
            last_error=last_error,
        )
    except Exception as e:
        update_ingest_job(
            job_id,
            state="failed",
            symbols_attempted=universe_count,
            symbols_succeeded=succeeded,
            symbols_failed=max(universe_count - succeeded, failed),
            last_error=str(e),
        )
        raise

    return EodhdIngestResponse(
        requested_start=start_date,
        requested_end=end_date,
        universe_symbols_considered=universe_count,
        symbols_selected=universe_count,
        symbols_attempted=universe_count,
        symbols_succeeded=succeeded,
        symbols_failed=failed,
        rows_observed_after_ingest=total_rows_observed,
        failed_symbols=failed_symbols,
        job_id=job_id,
        job_state="succeeded" if failed == 0 else "failed",
    )


# ---------------------------------------------------------------------------
# Resumable worker + endpoints (queue-based)
# ---------------------------------------------------------------------------


async def _run_resumable_job(
    job_id: str,
    *,
    archive_on_finish: bool = False,
    archive_keep_days: Optional[int] = None,
) -> None:
    """
    Resume-safe ingest worker.
    Processes queue items until none remain.

    HARDENING:
      - Reconciles ingest_jobs counters from queue state on startup
      - Makes resume 100% deterministic after crashes
    """

    # 1. Reset stale running items (crash recovery)
    try:
        reset_stale_running_to_pending(job_id, stale_minutes=10)  # type: ignore[arg-type]
    except TypeError:
        reset_stale_running_to_pending(job_id)

    job = get_ingest_job(job_id)
    if job is None:
        return

    # 2. Reconcile job counters from queue truth
    counts = get_counts(job_id)

    succeeded = int(counts["succeeded"])
    failed = int(counts["failed"])
    attempted = succeeded + failed

    update_ingest_job_progress(
        job_id,
        state="running",
        universe_symbols_considered=int(job["universe_symbols_considered"]),
        symbols_attempted=attempted,
        symbols_succeeded=succeeded,
        symbols_failed=failed,
        last_error=None if failed == 0 else "Some queue items previously failed.",
    )

    # 3. Main work loop
    while True:
        item = pop_next(job_id=job_id, max_attempts=5)
        if item is None:
            break

        sym = str(item["symbol"])
        ws = item["window_start"]
        we = item["window_end"]

        attempted += 1
        try:
            await ingest_eodhd_window(symbol=sym, start=ws, end=we)
            mark_succeeded(job_id, sym, ws, we)
            succeeded += 1
        except Exception as e:
            mark_failed(job_id, sym, ws, we, str(e))
            failed += 1

        update_ingest_job_progress(
            job_id,
            state="running",
            symbols_attempted=attempted,
            symbols_succeeded=succeeded,
            symbols_failed=failed,
            last_error=None if failed == 0 else "Some queue items failed (see eodhd_ingest_queue).",
        )

    # 4. Finalize
    counts = get_counts(job_id)
    if counts["pending"] > 0 or counts["running"] > 0:
        update_ingest_job(
            job_id,
            state="running",
            symbols_attempted=succeeded + failed,
            symbols_succeeded=succeeded,
            symbols_failed=failed,
            last_error="Job paused with remaining queue items.",
        )
        return

    final_state = "succeeded" if counts["failed"] == 0 else "failed"

    update_ingest_job(
        job_id,
        state=final_state,
        symbols_attempted=succeeded + failed,
        symbols_succeeded=succeeded,
        symbols_failed=failed,
        last_error=(
            None
            if final_state == "succeeded"
            else "Some queue items failed. Resume will retry up to max_attempts."
        ),
    )

    # 5. Optional archive on finish
    if archive_on_finish and archive_keep_days is not None and archive_keep_days >= 30:
        cutoff = date.today() - timedelta(days=int(archive_keep_days))
        try:
            archive_old_daily_bars(cutoff_date=cutoff)
        except Exception:
            pass


@router.post(
    "/datalake/eodhd/full-history/start-resumable",
    response_model=EodhdResumableStartResponse,
)
async def start_resumable_full_history(
    payload: EodhdFullHistoryRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if payload.start > payload.end:
        raise HTTPException(status_code=400, detail="start date must be <= end date")
    if payload.window_days <= 0:
        raise HTTPException(status_code=400, detail="window_days must be positive")

    symbols = _select_universe_symbols(
        min_market_cap=payload.min_market_cap,
        max_market_cap=payload.max_market_cap,
        exchanges=payload.exchanges,
        include_etfs=payload.include_etfs,
        active_only=payload.active_only,
        max_symbols=payload.max_symbols,
    )
    universe_count = len(symbols)
    if universe_count == 0:
        raise HTTPException(status_code=400, detail="No symbols matched from symbol_universe.")

    job_id = create_ingest_job(
        requested_start=payload.start,
        requested_end=payload.end,
        universe_symbols_considered=universe_count,
    )

    windows = _build_windows(payload.start, payload.end, payload.window_days)

    items: List[Tuple[str, date, date]] = []
    for sym in symbols:
        for ws, we in windows:
            items.append((sym, ws, we))

    queued = enqueue(job_id=job_id, items=items)

    background_tasks.add_task(
        _run_resumable_job,
        job_id,
        archive_on_finish=bool(payload.archive_on_finish),
        archive_keep_days=payload.archive_keep_days,
    )

    return EodhdResumableStartResponse(
        job_id=job_id,
        requested_start=payload.start,
        requested_end=payload.end,
        window_days=payload.window_days,
        queued_items=int(queued),
    )


@router.post("/datalake/eodhd/jobs/{job_id}/resume")
async def resume_resumable_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    job = get_ingest_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job id not found.")

    # Resume does not auto-archive; archiving is either:
    # - part of the original start-resumable payload, or
    # - manual call to /datalake/eodhd/archive
    background_tasks.add_task(_run_resumable_job, job_id)
    return {"ok": True, "job_id": job_id}


@router.get(
    "/datalake/eodhd/jobs/{job_id}/progress",
    response_model=EodhdJobProgressResponse,
)
async def get_job_progress(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    job = get_ingest_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job id not found.")

    counts = get_counts(job_id)
    total = max(int(counts["total"]), 1)
    done = int(counts["succeeded"]) + int(counts["failed"])
    pct = (done / total) * 100.0

    return EodhdJobProgressResponse(
        job_id=job_id,
        state=str(job["state"]),
        total=int(counts["total"]),
        pending=int(counts["pending"]),
        running=int(counts["running"]),
        succeeded=int(counts["succeeded"]),
        failed=int(counts["failed"]),
        pct_complete=float(pct),
    )


@router.get("/datalake/eodhd/jobs/latest", response_model=EodhdJobStatusResponse)
async def get_latest_eodhd_job(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    data = get_latest_ingest_job()
    if data is None:
        raise HTTPException(status_code=404, detail="No EODHD ingest jobs found.")

    return EodhdJobStatusResponse(
        id=data["id"],
        created_at=data["created_at"],
        started_at=data["started_at"],
        finished_at=data["finished_at"],
        state=data["state"],
        requested_start=date.fromisoformat(data["requested_start"]),
        requested_end=date.fromisoformat(data["requested_end"]),
        universe_symbols_considered=data["universe_symbols_considered"],
        symbols_attempted=data["symbols_attempted"],
        symbols_succeeded=data["symbols_succeeded"],
        symbols_failed=data["symbols_failed"],
        last_error=data["last_error"],
    )
