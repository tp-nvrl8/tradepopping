# backend/app/routes/datahub_bars.py

from datetime import date
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

# Import the async client + DTO from the Polygon client
from app.datahub.polygon_client import (
    fetch_polygon_daily_ohlcv,
    PriceBarDTO,
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
):
    """
    Fetch daily OHLCV bars from Polygon between [start, end], inclusive.

    This wraps the async client in app.datahub.polygon_client and
    normalizes errors into HTTP responses so the frontend
    gets a clean message instead of a 500.
    """
    try:
        bars_dto: List[PriceBarDTO] = await fetch_polygon_daily_ohlcv(
            symbol=symbol,
            start=start,
            end=end,
        )
    except ValueError as ve:
        # Date validation issues (future dates, end < start, etc.)
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        # Polygon HTTP / API-key issues bubbled up as RuntimeError
        raise HTTPException(status_code=502, detail=str(re))
    except Exception as e:
        # Catch-all to keep the client from seeing a raw 500
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error while fetching Polygon OHLCV: {e}",
        )

    # Convert TypedDict -> Pydantic model
    return [PriceBarOut(**bar) for bar in bars_dto]