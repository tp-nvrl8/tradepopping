from datetime import date
from typing import List

from fastapi import APIRouter, HTTPException, Query

from ..datahub.polygon_client import fetch_polygon_daily_ohlcv, PriceBarDTO
from ..datahub.bar_store import read_daily_bars, upsert_daily_bars

router = APIRouter(
    prefix="/data/bars",
    tags=["data-bars"],
)


def _validate_date_range(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date.",
        )


@router.get("/daily")
async def get_daily_bars(
    symbol: str = Query(..., description="Ticker symbol, e.g. AAPL"),
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD, inclusive)"),
) -> List[PriceBarDTO]:
    """
    Return daily OHLCV bars for a symbol in [start, end] inclusive.
    Behavior:
    - First, try to read from the DuckDB 'daily_bars' lake.
    - If no rows exist for the requested range:
        - Fetch from Polygon via fetch_polygon_daily_ohlcv
        - Upsert into the DuckDB lake
        - Return the fetched bars.
    - If some rows exist, we currently just return what is in the lake.
      (Later we can add more sophisticated partial-fill logic.)
    """
    _validate_date_range(start, end)

    # First attempt: read from local lake
    existing = read_daily_bars(symbol, start, end)
    if existing:
        return existing

    # If nothing in the lake yet for this symbol/range, lazily fetch from Polygon
    try:
        fetched = await fetch_polygon_daily_ohlcv(symbol, start, end)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch from Polygon: {exc}",
        )

    # If still empty (weekend/holiday/no trading), just return empty
    if not fetched:
        return []

    # Persist into the lake, then return
    upsert_daily_bars(symbol, fetched)
    return fetched
