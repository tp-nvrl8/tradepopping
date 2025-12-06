# backend/app/routes/datalake_bars.py
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.datalake.bar_store import read_daily_bars
from app.datalake.eodhd_client import PriceBarDTO

router = APIRouter(
    tags=["datalake-bars"],
)


@router.get(
    "/datalake/bars/cached",
    response_model=List[PriceBarDTO],
)
async def get_cached_daily_bars(
    symbol: str = Query(..., description="Ticker symbol, e.g. AAPL"),
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[PriceBarDTO]:
    """
    Read cached daily bars from DuckDB (daily_bars table) for [start, end].

    This does *not* call EODHD. It only reads what has already been ingested
    into the datalake via the EODHD ingest endpoints.
    """
    if start > end:
        raise HTTPException(
            status_code=400,
            detail="start date must be <= end date",
        )

    bars = read_daily_bars(symbol=symbol, start=start, end=end)
    return bars