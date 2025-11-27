# backend/app/routes/datahub_bars.py

from datetime import date
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.datahub.polygon_client import (
    fetch_polygon_daily_ohlcv,
    PriceBarDTO,
)
from app.datahub.bar_store import (
    read_daily_bars,
    upsert_daily_bars,
)

router = APIRouter(
    tags=["datahub"],
)


class PriceBarOut(BaseModel):
    """Response model sent back to the frontend."""
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float


@router.get(
    "/datahub/polygon/daily-ohlcv",
    response_model=List[PriceBarOut],
)
async def get_polygon_daily_ohlcv(
    symbol: str = Query(..., min_length=1, description="Ticker symbol, e.g. AAPL"),
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    force_live: bool = Query(
        False,
        description="If true, always hit Polygon and refresh cache before returning.",
    ),
):
    """
    Fetch daily OHLCV bars between [start, end], inclusive.

    Strategy:
      1. Try Polygon first (unless force_live=False AND we later
         decide to serve from cache only).
      2. On successful Polygon fetch:
         - write bars into DuckDB cache
         - return those bars to caller
      3. If Polygon fails (network / quota / auth):
         - fall back to DuckDB cache
         - if cache also fails or is empty, raise 502/500.
    """
    symbol = symbol.upper()

    # 1) Try live Polygon
    live_bars: List[PriceBarDTO] | None = None
    live_error: Exception | None = None

    try:
        live_bars = await fetch_polygon_daily_ohlcv(
            symbol=symbol,
            start=start,
            end=end,
        )

        # Write-through into DuckDB cache (best effort)
        try:
            upsert_count = upsert_daily_bars(symbol, live_bars)
            print(
                f"[DATAHUB] Upserted {upsert_count} bars into DuckDB "
                f"for {symbol} {start} → {end}",
                flush=True,
            )
        except Exception as cache_err:
            # Don't kill the request if cache write fails
            print(
                f"[DATAHUB] WARNING: failed to upsert DuckDB cache: {cache_err}",
                flush=True,
            )

    except ValueError as ve:
        # Date validation (from polygon_client)
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        # Polygon HTTP / key problems bubbled as RuntimeError
        live_error = re
        live_bars = None
    except Exception as e:
        # Generic unexpected error from the client
        live_error = e
        live_bars = None

    # If live Polygon worked, great – return those bars.
    if live_bars is not None:
        return [PriceBarOut(**bar) for bar in live_bars]

    # 2) Otherwise, fall back to DuckDB cache
    try:
        cached_bars = read_daily_bars(symbol, start, end)
    except Exception as cache_err:
        raise HTTPException(
            status_code=502,
            detail=f"Polygon fetch failed ({live_error}); "
                   f"cache read also failed ({cache_err})",
        )

    if not cached_bars:
        raise HTTPException(
            status_code=502,
            detail=f"Polygon fetch failed and no cached bars available: {live_error}",
        )

    print(
        f"[DATAHUB] Served {len(cached_bars)} cached bars for {symbol} "
        f"{start} → {end} from DuckDB after Polygon failure.",
        flush=True,
    )

    return [PriceBarOut(**bar) for bar in cached_bars]