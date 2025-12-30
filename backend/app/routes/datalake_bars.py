# backend/app/routes/datalake_bars.py

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from app.auth import get_current_user
from app.datalake.bar_store import read_daily_bars
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["datalake-bars"])


class PriceBarOut(BaseModel):
    """
    Shape the frontend expects for a daily OHLCV bar.
    """

    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float


def _normalize_bar(row: Any) -> PriceBarOut:
    """
    Converts any row from read_daily_bars into a strict PriceBarOut.

    Supports:
      - dict-like rows
      - object-like rows
      - tuple-like / DuckDB row objects
    """

    # 1) Handle dict-like rows
    if isinstance(row, dict):
        # Try common field names for date
        trade_date = row.get("trade_date") or row.get("date") or row.get("day") or row.get("time")
        if trade_date is None:
            raise KeyError(f"Row missing date field: keys={list(row.keys())}")

        return PriceBarOut(
            time=str(trade_date),
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row["volume"]),
        )

    # 2) Handle DuckDB tuple-like rows
    if isinstance(row, (tuple, list)):
        # We need to know column order from read_daily_bars.
        # Assume [date, open, high, low, close, volume].
        trade_date, o, h, l, c, v = row
        return PriceBarOut(
            time=str(trade_date),
            open=float(o),
            high=float(h),
            low=float(l),
            close=float(c),
            volume=float(v),
        )

    # 3) Handle object-like rows (DuckDB objects)
    # Try common field names for the date field
    date_fields = ["trade_date", "date", "day", "time"]
    trade_date = None
    for field in date_fields:
        if hasattr(row, field):
            trade_date = getattr(row, field)
            break

    if trade_date is None:
        raise KeyError(f"Row has no recognizable date field. Available: {dir(row)}")

    return PriceBarOut(
        time=str(trade_date),
        open=float(getattr(row, "open")),
        high=float(getattr(row, "high")),
        low=float(getattr(row, "low")),
        close=float(getattr(row, "close")),
        volume=float(getattr(row, "volume")),
    )


@router.get(
    "/datalake/bars/daily",
    response_model=List[PriceBarOut],
)
async def get_datalake_daily_bars(
    symbol: str,
    start: date,
    end: date,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Read daily OHLCV bars for a symbol from the DuckDB data lake
    (daily_bars table) for [start, end], inclusive.
    """
    if start > end:
        raise HTTPException(
            status_code=400,
            detail="start date must be <= end date",
        )

    try:
        bars = read_daily_bars(symbol=symbol.upper(), start=start, end=end)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read bars from data lake: {exc}",
        ) from exc

    if not bars:
        # It’s fine if there are no rows; the frontend can show "no data"
        return []

    return [_normalize_bar(row) for row in bars]
