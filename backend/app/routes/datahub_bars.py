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
from app.datahub.bar_store import (
    BarStoreError,
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
    force_live: bool = Query(False, description="If true, skip cache and hit Polygon"),
):
    """
    Fetch daily OHLCV bars from Polygon between [start, end], inclusive.

    This wraps the async client in app.datahub.polygon_client and
    normalizes errors into HTTP responses so the frontend
    gets a clean message instead of a 500.
    """
    if not force_live:
        try:
            cached_rows = read_daily_bars(
                symbol=symbol,
                start=start,
                end=end,
                source="polygon",
            )
            if cached_rows:
                return [
                    PriceBarOut(
                        time=f"{row['bar_date'].isoformat()}T00:00:00Z",
                        open=row["open"],
                        high=row["high"],
                        low=row["low"],
                        close=row["close"],
                        volume=row["volume"],
                    )
                    for row in cached_rows
                ]
        except BarStoreError as err:
            print(f"Warning: DuckDB read failed, falling back to Polygon. Error: {err}")

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

    try:
        upsert_daily_bars(symbol=symbol, bars=bars_dto, source="polygon")
    except BarStoreError as err:
        print(f"Warning: DuckDB write failed after Polygon fetch. Error: {err}")

    # Convert TypedDict -> Pydantic model
    return [PriceBarOut(**bar) for bar in bars_dto]


@router.get("/data/bars/daily", response_model=List[PriceBarOut])
async def get_daily_bars_for_teststand(
    symbol: str = Query(..., min_length=1),
    start: date = Query(...),
    end: date = Query(...),
    force_live: bool = Query(False),
):
    return await get_polygon_daily_ohlcv(
        symbol=symbol,
        start=start,
        end=end,
        force_live=force_live,
    )