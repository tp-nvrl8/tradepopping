# backend/app/routers/datahub.py
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..schemas.datahub import (
    DataSourceStatus,
    DataSourceTestResponse,
    EodhdIngestResponse,
    EodhdJobStatus,
    PriceBarDTO,
    UniverseBrowseResponse,
    UniverseIngestResult,
    UniverseRow,
    UniverseStats,
)


# If you already have auth deps, swap this out
def fake_auth_dep() -> None:
    """Placeholder for your real auth dependency."""
    return None


router = APIRouter(
    prefix="/datalake",
    tags=["datalake"],
    dependencies=[Depends(fake_auth_dep)],
)

# ---------------------------------------------------------------------------
# In-memory placeholders (replace with DuckDB / real logic)
# ---------------------------------------------------------------------------

_FAKE_UNIVERSE: List[UniverseRow] = [
    UniverseRow(
        symbol="AAPL",
        name="Apple Inc.",
        exchange="NASDAQ",
        sector="Information Technology",
        industry="Consumer Electronics",
        market_cap=3_000_000_000_000,
        price=190.0,
        is_etf=False,
        is_actively_trading=True,
    ),
    UniverseRow(
        symbol="MSFT",
        name="Microsoft Corporation",
        exchange="NASDAQ",
        sector="Information Technology",
        industry="Systems Software",
        market_cap=2_800_000_000_000,
        price=380.0,
        is_etf=False,
        is_actively_trading=True,
    ),
    UniverseRow(
        symbol="SPY",
        name="SPDR S&P 500 ETF Trust",
        exchange="NYSE",
        sector="ETF",
        industry=None,
        market_cap=500_000_000_000,
        price=500.0,
        is_etf=True,
        is_actively_trading=True,
    ),
]

_LAST_EODHD_JOB: Optional[EodhdJobStatus] = None


# ---------------------------------------------------------------------------
# FMP Universe ingest + stats
# ---------------------------------------------------------------------------


@router.get("/universe/stats", response_model=UniverseStats)
async def get_universe_stats() -> UniverseStats:
    """Return aggregate stats over the stored symbol universe.

    TODO: Replace with DuckDB queries over your real universe table.
    """
    total = len(_FAKE_UNIVERSE)

    by_exchange: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    by_sector: Dict[str, int] = {}
    by_cap_bucket: Dict[str, int] = {}

    for row in _FAKE_UNIVERSE:
        by_exchange[row.exchange] = by_exchange.get(row.exchange, 0) + 1

        t = "ETF" if row.is_etf else "EQUITY"
        by_type[t] = by_type.get(t, 0) + 1

        sector_key = row.sector or "UNKNOWN"
        by_sector[sector_key] = by_sector.get(sector_key, 0) + 1

        mc = row.market_cap
        if mc < 300_000_000:
            bucket = "<300M"
        elif mc < 2_000_000_000:
            bucket = "300M–2B"
        elif mc < 10_000_000_000:
            bucket = "2B–10B"
        elif mc < 50_000_000_000:
            bucket = "10B–50B"
        else:
            bucket = "50B+"
        by_cap_bucket[bucket] = by_cap_bucket.get(bucket, 0) + 1

    return UniverseStats(
        total_symbols=total,
        by_exchange=by_exchange,
        by_type=by_type,
        by_sector=by_sector,
        by_cap_bucket=by_cap_bucket,
    )


@router.post("/fmp/universe/ingest", response_model=UniverseIngestResult)
async def ingest_fmp_universe(
    min_market_cap: int = Query(..., ge=0),
    exchanges: str = Query(..., description="Comma-separated exchanges"),
    limit: int = Query(..., ge=1),
    include_etfs: bool = Query(False),
    active_only: bool = Query(True),
) -> UniverseIngestResult:
    """Kick off (or simulate) an ingest of the FMP symbol universe.

    TODO: Replace with real FMP call + DuckDB upsert, then compute counts.
    """
    # For now we pretend we ingested our fake universe
    symbols_received = min(limit, len(_FAKE_UNIVERSE))
    rows_upserted = symbols_received  # 1 row per symbol in the mock

    return UniverseIngestResult(
        source="fmp",
        symbols_received=symbols_received,
        rows_upserted=rows_upserted,
    )


@router.get("/universe/browse", response_model=UniverseBrowseResponse)
async def browse_universe(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("symbol"),
    sort_dir: str = Query("asc"),
    search: Optional[str] = None,
    sector: Optional[str] = None,
    min_market_cap: Optional[float] = None,
    max_market_cap: Optional[float] = None,
) -> UniverseBrowseResponse:
    """Return a paged, filtered view of the universe.

    TODO: Replace with proper DuckDB SELECT ... WHERE ... ORDER BY ... LIMIT ...
    """
    # filter
    rows = list(_FAKE_UNIVERSE)

    if search:
        s = search.lower()
        rows = [r for r in rows if s in r.symbol.lower() or s in r.name.lower()]

    if sector:
        rows = [r for r in rows if (r.sector or "UNKNOWN") == sector]

    if min_market_cap is not None:
        rows = [r for r in rows if r.market_cap >= min_market_cap]

    if max_market_cap is not None:
        rows = [r for r in rows if r.market_cap <= max_market_cap]

    # sort
    reverse = sort_dir.lower() == "desc"

    def sort_key(r: UniverseRow) -> Any:
        if sort_by == "name":
            return r.name
        if sort_by == "sector":
            return r.sector or ""
        if sort_by == "exchange":
            return r.exchange
        if sort_by == "market_cap":
            return r.market_cap
        if sort_by == "price":
            return r.price
        # default symbol
        return r.symbol

    rows.sort(key=sort_key, reverse=reverse)

    total_items = len(rows)
    total_pages = max(1, (total_items + page_size - 1) // page_size)
    page = max(1, min(page, total_pages))

    start = (page - 1) * page_size
    end = start + page_size
    page_rows = rows[start:end]

    sectors = sorted({r.sector or "UNKNOWN" for r in _FAKE_UNIVERSE})
    exchanges = sorted({r.exchange for r in _FAKE_UNIVERSE})

    min_mc = min((r.market_cap for r in _FAKE_UNIVERSE), default=None)
    max_mc = max((r.market_cap for r in _FAKE_UNIVERSE), default=None)

    return UniverseBrowseResponse(
        items=page_rows,
        total_items=total_items,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        sectors=sectors,
        exchanges=exchanges,
        min_market_cap=min_mc,
        max_market_cap=max_mc,
    )


# ---------------------------------------------------------------------------
# EODHD window ingest + job status
# ---------------------------------------------------------------------------


@router.post("/eodhd/ingest-window", response_model=EodhdIngestResponse)
async def ingest_eodhd_window(
    payload: Dict[str, Any],
) -> EodhdIngestResponse:
    """Simulate an EODHD ingest job and record a 'last job' snapshot.

    TODO: Wire to real EODHD ingest and job tracking.
    """
    global _LAST_EODHD_JOB

    requested_start = payload.get("start")
    requested_end = payload.get("end")
    min_cap = int(payload.get("min_market_cap") or 0)
    max_symbols = int(payload.get("max_symbols") or 0) or len(_FAKE_UNIVERSE)

    universe_considered = len(_FAKE_UNIVERSE)
    symbols_selected = min(universe_considered, max_symbols)
    symbols_attempted = symbols_selected
    symbols_succeeded = symbols_selected
    symbols_failed = 0
    rows_observed = symbols_selected * 10  # dummy

    job_id = f"job-{int(datetime.utcnow().timestamp())}"
    job_state = "succeeded"

    # Build ingest response
    resp = EodhdIngestResponse(
        requested_start=requested_start,
        requested_end=requested_end,
        universe_symbols_considered=universe_considered,
        symbols_selected=symbols_selected,
        symbols_attempted=symbols_attempted,
        symbols_succeeded=symbols_succeeded,
        symbols_failed=symbols_failed,
        rows_observed_after_ingest=rows_observed,
        failed_symbols=[],
        job_id=job_id,
        job_state=job_state,
    )

    now_iso = datetime.utcnow().isoformat() + "Z"

    _LAST_EODHD_JOB = EodhdJobStatus(
        id=job_id,
        created_at=now_iso,
        started_at=now_iso,
        finished_at=now_iso,
        state=job_state,
        requested_start=requested_start,
        requested_end=requested_end,
        universe_symbols_considered=universe_considered,
        symbols_attempted=symbols_attempted,
        symbols_succeeded=symbols_succeeded,
        symbols_failed=symbols_failed,
        last_error=None,
    )

    return resp


@router.get("/eodhd/jobs/latest", response_model=EodhdJobStatus)
async def get_latest_eodhd_job() -> EodhdJobStatus:
    """Return the last recorded EODHD ingest job."""
    if _LAST_EODHD_JOB is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No EODHD jobs yet",
        )
    return _LAST_EODHD_JOB
