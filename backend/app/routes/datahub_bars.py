# backend/app/routes/datahub_bars.py

from datetime import date
from typing import List

from app.datalake.bar_store import (
    ingest_eodhd_window,
    read_daily_bars,
)
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

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
async def get_daily_ohlcv(
    symbol: str = Query(..., min_length=1, description="Ticker symbol, e.g. AAPL"),
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    force_live: bool = Query(
        False,
        description="If true, always pull from EODHD and refresh cache.",
    ),
):
    """
    Fetch daily OHLCV bars between [start, end], inclusive.

    Implementation strategy:

    - Optionally refresh from EODHD (force_live or in future if cache miss).
    - Read from DuckDB.
    - Return normalized PriceBarOut list.

    For now, we keep it simple and always call ingest_eodhd_window
    so the cache stays fresh, then read from DuckDB.
    """
    try:
        # For now: always refresh EODHD window so DuckDB stays current.
        # Later we can optimize to only call EODHD if cache is missing.
        await ingest_eodhd_window(symbol=symbol, start=start, end=end)

        dto_bars = read_daily_bars(symbol=symbol, start=start, end=end)

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error while fetching daily OHLCV: {e}",
        )

    return [PriceBarOut(**bar) for bar in dto_bars]
