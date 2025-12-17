from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import duckdb
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.auth import get_current_user
from app.datalake.bar_store import ingest_eodhd_window, read_daily_bars
from app.datalake.ingest_jobs import (
    create_ingest_job,
    update_ingest_job,
    get_latest_ingest_job,
)

router = APIRouter(tags=["datalake-eodhd"])

# Use the same DuckDB path as the rest of the datalake
TP_DUCKDB_PATH: str = os.getenv(
    "TP_DUCKDB_PATH",
    "/data/tradepopping.duckdb",
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class EodhdIngestRequest(BaseModel):
    """
    Request payload for bulk EODHD ingestion driven by the FMP universe
    for a single date window [start, end].
    """
    start: date
    end: date

    # Universe filters
    min_market_cap: int = 50_000_000      # 50M default floor
    max_market_cap: Optional[int] = None  # no cap if None

    exchanges: List[str] = ["NYSE", "NASDAQ"]
    include_etfs: bool = False
    active_only: bool = True

    # Safety valves
    max_symbols: int = 500  # hard ceiling so we don't accidentally ingest 10k+ symbols


class EodhdIngestResponse(BaseModel):
    """
    Summary of what we ingested for a single [start, end] window.
    Includes job metadata for the UI.
    """
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
    job_state: str  # "running" | "succeeded" | "failed"


class EodhdFullHistoryRequest(BaseModel):
    """
    Request for a multi-window full-history ingest, chunked by `window_days`.
    Reuses the same universe filters, but walks multiple date windows.
    """
    start: date
    end: date

    # Universe filters (same semantics as EodhdIngestRequest)
    min_market_cap: int = 50_000_000
    max_market_cap: Optional[int] = None
    exchanges: List[str] = ["NYSE", "NASDAQ"]
    include_etfs: bool = False
    active_only: bool = True
    max_symbols: int = 500

    # How many days per chunk
    window_days: int = 365


class EodhdFullHistoryResponse(BaseModel):
    """
    Aggregated summary for a multi-window ingest.
    """
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
    """
    Lightweight response when we *start* a full-history ingest
    in the background. The detailed running stats live in
    eodhd_ingest_jobs and are exposed via /datalake/eodhd/jobs/latest.
    """
    job_id: str
    start: date
    end: date
    window_days: int


class EodhdJobStatusResponse(BaseModel):
    """
    Status payload for the latest EODHD ingest job.
    Mirrors get_latest_ingest_job().
    """
    id: str
    created_at: Optional[str]
    started_at: Optional[str]
    finished_at: Optional[str]
    state: str  # "running" | "succeeded" | "failed"

    requested_start: date
    requested_end: date
    universe_symbols_considered: int

    symbols_attempted: int
    symbols_succeeded: int
    symbols_failed: int

    last_error: Optional[str]


class EodhdIngestFullHistoryRequest(BaseModel):
    """
    Simple full-history ingest driven by the UI:
    UI supplies the earliest `start` date and filters,
    backend uses today's date as the end.
    """
    start: date
    min_market_cap: int = 50_000_000
    max_market_cap: Optional[int] = None
    exchanges: List[str] = ["NYSE", "NASDAQ"]
    include_etfs: bool = False
    active_only: bool = True
    max_symbols: int = 500


# ---------------------------------------------------------------------------
# DuckDB helpers
# ---------------------------------------------------------------------------


def _get_duckdb_connection(read_only: bool = True) -> duckdb.DuckDBPyConnection:
    """
    Local helper to open DuckDB.

    We ignore read_only here to keep DuckDB configuration consistent
    across all connections in this process.
    """
    return duckdb.connect(TP_DUCKDB_PATH)


def _select_universe_symbols(
    min_market_cap: int,
    max_market_cap: Optional[int],
    exchanges: List[str],
    include_etfs: bool,
    active_only: bool,
    max_symbols: int,
) -> List[str]:
    """
    Read candidate symbols from symbol_universe in DuckDB based on filters.

    IMPORTANT:
    - We ALWAYS exclude funds here.
    - We handle NULLs safely (is_fund/is_etf/market_cap may be NULL).
    """
    con = _get_duckdb_connection(read_only=True)
    try:
        # Make sure table exists
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = 'symbol_universe';"
        ).fetchall()
        if not tables:
            # Nothing ingested yet
            return []

        params: List[Any] = []
        where_clauses: List[str] = []

        # Exchange filter
        if exchanges:
            placeholders = ", ".join(["?"] * len(exchanges))
            where_clauses.append(f"exchange IN ({placeholders})")
            params.extend([ex.upper() for ex in exchanges])

        # ALWAYS exclude funds (NULL treated as not-fund)
        where_clauses.append("(is_fund IS NULL OR is_fund = FALSE)")

        # Market cap filters (exclude NULL market caps)
        where_clauses.append("market_cap IS NOT NULL")
        where_clauses.append("market_cap >= ?")
        params.append(float(min_market_cap))

        if max_market_cap is not None:
            where_clauses.append("market_cap <= ?")
            params.append(float(max_market_cap))

        # ETF filter (NULL treated as not-etf)
        if not include_etfs:
            where_clauses.append("(is_etf IS NULL OR is_etf = FALSE)")

        # Active trading filter
        if active_only:
            where_clauses.append("is_actively_trading = TRUE")

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

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


# ---------------------------------------------------------------------------
# Single-window ingest (UI: "Ingest window")
# ---------------------------------------------------------------------------


@router.post(
    "/datalake/eodhd/ingest-window",
    response_model=EodhdIngestResponse,
)
async def ingest_eodhd_for_universe(
    payload: EodhdIngestRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Bulk-ingest EODHD daily bars for a window [start, end] for a filtered
    subset of the FMP universe stored in DuckDB (symbol_universe).

    Also registers a job row in eodhd_ingest_jobs so the UI can show status.
    """

    # 1) Pick symbols from the existing universe in DuckDB
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
        raise HTTPException(
            status_code=400,
            detail=(
                "No symbols matched from symbol_universe. "
                "Make sure you have ingested the FMP universe "
                "and that your filters are not too strict."
            ),
        )

    # 2) Create a job record
    job_id = create_ingest_job(
        requested_start=payload.start,
        requested_end=payload.end,
        universe_symbols_considered=universe_count,
    )

    succeeded = 0
    failed = 0
    failed_symbols: List[str] = []
    total_rows_observed = 0

    # 3) Ingest bars from EODHD for each symbol, one by one
    try:
        for sym in symbols:
            try:
                # Write-through ingest into daily_bars
                await ingest_eodhd_window(
                    symbol=sym,
                    start=payload.start,
                    end=payload.end,
                )

                # Read back what we have for this symbol / window to count rows.
                bars = read_daily_bars(
                    symbol=sym,
                    start=payload.start,
                    end=payload.end,
                )
                total_rows_observed += len(bars)
                succeeded += 1
            except Exception as e:
                failed += 1
                failed_symbols.append(f"{sym}: {e}")

        # Decide final job state
        if failed == 0:
            job_state = "succeeded"
            last_error = None
        else:
            job_state = "failed"
            last_error = "Some symbols failed during ingest."

        update_ingest_job(
            job_id,
            state=job_state,
            symbols_attempted=universe_count,
            symbols_succeeded=succeeded,
            symbols_failed=failed,
            last_error=last_error,
        )

    except Exception as e:
        # Hard failure – mark job as failed and re-raise
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


# ---------------------------------------------------------------------------
# Simple full-history ingest (UI: "Ingest full history")
# ---------------------------------------------------------------------------


@router.post(
    "/datalake/eodhd/ingest-full-history",
    response_model=EodhdIngestResponse,
    summary="Ingest full EODHD daily-bar history for a filtered universe",
)
async def ingest_eodhd_full_history_route(
    body: EodhdIngestFullHistoryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Full-history ingest driven by the same mechanics as /datalake/eodhd/ingest-window,
    but with:
      - start: provided by the UI (body.start)
      - end:   today's date
    """

    start_date = body.start
    end_date = date.today()

    # 1) Pick symbols from the existing universe in DuckDB
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
        raise HTTPException(
            status_code=400,
            detail=(
                "No symbols matched from symbol_universe. "
                "Make sure you have ingested the FMP universe "
                "and that your filters are not too strict."
            ),
        )

    # 2) Create a job record
    job_id = create_ingest_job(
        requested_start=start_date,
        requested_end=end_date,
        universe_symbols_considered=universe_count,
    )

    succeeded = 0
    failed = 0
    failed_symbols: List[str] = []
    total_rows_observed = 0

    # 3) Ingest bars from EODHD for each symbol, one by one
    try:
        for sym in symbols:
            try:
                await ingest_eodhd_window(
                    symbol=sym,
                    start=start_date,
                    end=end_date,
                )
                bars = read_daily_bars(
                    symbol=sym,
                    start=start_date,
                    end=end_date,
                )
                total_rows_observed += len(bars)
                succeeded += 1
            except Exception as e:
                failed += 1
                failed_symbols.append(f"{sym}: {e}")

        # Decide final job state
        if failed == 0:
            job_state = "succeeded"
            last_error = None
        else:
            job_state = "failed"
            last_error = "Some symbols failed during ingest."

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
# Advanced multi-window full-history ingest (existing design)
#   - /datalake/eodhd/full-history/ingest
#   - /datalake/eodhd/full-history/start
#   - background worker _run_full_history_ingest
#   - /datalake/eodhd/jobs/latest
# ---------------------------------------------------------------------------


@router.post(
    "/datalake/eodhd/full-history/ingest",
    response_model=EodhdFullHistoryResponse,
)
async def ingest_eodhd_full_history(
    payload: EodhdFullHistoryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Walk multiple windows from [start, end], chunked by `window_days`,
    and ingest EODHD daily bars for each (symbol, window).

    Uses the same symbol_universe filters as /datalake/eodhd/ingest-window.
    """

    if payload.start > payload.end:
        raise HTTPException(
            status_code=400,
            detail="start date must be <= end date",
        )

    if payload.window_days <= 0:
        raise HTTPException(
            status_code=400,
            detail="window_days must be positive",
        )

    # 1) Pick symbols once (universe is the same for all windows)
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
        raise HTTPException(
            status_code=400,
            detail=(
                "No symbols matched from symbol_universe. "
                "Make sure you have ingested the FMP universe "
                "and that your filters are not too strict."
            ),
        )

    # 2) Build windows
    windows: List[Tuple[date, date]] = []
    cur = payload.start
    while cur <= payload.end:
        window_end = cur + timedelta(days=payload.window_days - 1)
        if window_end > payload.end:
            window_end = payload.end
        windows.append((cur, window_end))
        cur = window_end + timedelta(days=1)

    num_windows = len(windows)

    # 3) Nested ingest: for each symbol × window
    total_attempted = 0
    total_succeeded = 0
    total_failed = 0
    total_rows_observed = 0

    for sym in symbols:
        for (w_start, w_end) in windows:
            total_attempted += 1
            try:
                await ingest_eodhd_window(
                    symbol=sym,
                    start=w_start,
                    end=w_end,
                )
                bars = read_daily_bars(
                    symbol=sym,
                    start=w_start,
                    end=w_end,
                )
                total_rows_observed += len(bars)
                total_succeeded += 1
            except Exception:
                total_failed += 1

    return EodhdFullHistoryResponse(
        start=payload.start,
        end=payload.end,
        window_days=payload.window_days,
        num_windows=num_windows,
        universe_symbols_considered=universe_count,
        symbols_selected=universe_count,
        total_symbols_attempted=total_attempted,
        total_symbols_succeeded=total_succeeded,
        total_symbols_failed=total_failed,
        total_rows_observed=total_rows_observed,
    )


async def _run_full_history_ingest(job_id: str, payload_dict: Dict[str, Any]) -> None:
    """
    Background task that walks multiple windows from [start, end],
    calling ingest_eodhd_window() for each (symbol, window) pair
    and updating the eodhd_ingest_jobs row as we go.
    """
    try:
        payload = EodhdFullHistoryRequest(**payload_dict)

        # 1) Pick symbols once from symbol_universe
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
            # Mark job as failed and bail early
            update_ingest_job(
                job_id=job_id,
                state="failed",
                universe_symbols_considered=0,
                symbols_attempted=0,
                symbols_succeeded=0,
                symbols_failed=0,
                last_error=(
                    "No symbols matched from symbol_universe for the "
                    "given filters. Did you ingest the FMP universe?"
                ),
            )
            return

        # 2) Build windows [start, end] in chunks of window_days
        windows: List[Tuple[date, date]] = []
        cur = payload.start
        while cur <= payload.end:
            window_end = cur + timedelta(days=payload.window_days - 1)
            if window_end > payload.end:
                window_end = payload.end
            windows.append((cur, window_end))
            cur = window_end + timedelta(days=1)

        # We know universe_count now; mark job as running with this info
        update_ingest_job(
            job_id=job_id,
            state="running",
            universe_symbols_considered=universe_count,
            symbols_attempted=0,
            symbols_succeeded=0,
            symbols_failed=0,
            last_error=None,
        )

        total_attempted = 0
        total_succeeded = 0
        total_failed = 0
        total_rows_observed = 0

        # 3) Nested ingest: for each symbol × window
        for sym in symbols:
            for (w_start, w_end) in windows:
                total_attempted += 1
                try:
                    # Write bars into DuckDB for this window
                    await ingest_eodhd_window(
                        symbol=sym,
                        start=w_start,
                        end=w_end,
                    )
                    bars = read_daily_bars(
                        symbol=sym,
                        start=w_start,
                        end=w_end,
                    )
                    total_rows_observed += len(bars)
                    total_succeeded += 1
                except Exception:
                    total_failed += 1

        # 4) Final job update — mark success
        update_ingest_job(
            job_id=job_id,
            state="succeeded",
            universe_symbols_considered=universe_count,
            symbols_attempted=total_attempted,
            symbols_succeeded=total_succeeded,
            symbols_failed=total_failed,
            last_error=None,
        )

    except Exception as exc:
        # Catch any unexpected crash and mark job as failed
        update_ingest_job(
            job_id=job_id,
            state="failed",
            universe_symbols_considered=0,
            symbols_attempted=0,
            symbols_succeeded=0,
            symbols_failed=0,
            last_error=f"Background full-history ingest crashed: {exc}",
        )


@router.post(
    "/datalake/eodhd/full-history/start",
    response_model=EodhdFullHistoryStartResponse,
)
async def start_eodhd_full_history(
    payload: EodhdFullHistoryRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Kick off a full-history ingest (multiple date windows) in the background.

    This returns quickly with a job_id. Progress and final stats are
    exposed via /datalake/eodhd/jobs/latest which reads from
    eodhd_ingest_jobs in DuckDB.
    """

    if payload.start > payload.end:
        raise HTTPException(
            status_code=400,
            detail="start date must be <= end date",
        )

    if payload.window_days <= 0:
        raise HTTPException(
            status_code=400,
            detail="window_days must be positive",
        )

    # Initial job row; we don't yet know universe_count until the background task runs
    job_id = create_ingest_job(
        requested_start=payload.start,
        requested_end=payload.end,
        universe_symbols_considered=0,
        symbols_attempted=0,
        symbols_succeeded=0,
        symbols_failed=0,
        last_error=None,
    )

    # Schedule the async background worker
    background_tasks.add_task(
        _run_full_history_ingest,
        job_id,
        payload.dict(),
    )

    return EodhdFullHistoryStartResponse(
        job_id=job_id,
        start=payload.start,
        end=payload.end,
        window_days=payload.window_days,
    )


@router.get(
    "/datalake/eodhd/jobs/latest",
    response_model=EodhdJobStatusResponse,
)
async def get_latest_eodhd_job(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Surface the latest EODHD ingest job to the UI.
    """
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