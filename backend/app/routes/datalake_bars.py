from __future__ import annotations

from datetime import date
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.datalake.bar_store import read_daily_bars, ingest_eodhd_window

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


@router.get("/datalake/bars/daily", response_model=List[PriceBarOut])
async def get_datalake_daily_bars(
  symbol: str,
  start: date,
  end: date,
  current_user: Dict[str, Any] = Depends(get_current_user),
):
  """
  Read daily OHLCV bars from the DuckDB datalake.

  If the window is missing, fetch from EODHD, upsert into DuckDB,
  then return the freshly ingested bars.
  """
  symbol = symbol.upper().strip()
  if not symbol:
    raise HTTPException(status_code=400, detail="symbol is required")

  if end < start:
    raise HTTPException(status_code=400, detail="end must be >= start")

  # 1) Try to read from DuckDB cache
  try:
    bars = read_daily_bars(symbol=symbol, start=start, end=end)
  except Exception as e:
    raise HTTPException(
      status_code=500,
      detail=f"Error reading bars from DuckDB: {e}",
    )

  # 2) If nothing in cache, pull from EODHD and upsert
  if not bars:
    try:
      await ingest_eodhd_window(symbol=symbol, start=start, end=end)
      bars = read_daily_bars(symbol=symbol, start=start, end=end)
    except Exception as e:
      raise HTTPException(
        status_code=502,
        detail=f"Error fetching bars from EODHD: {e}",
      )

  # 3) Convert DTOs (dict-like) → pydantic model
  return [
    PriceBarOut(
      time=b["time"],
      open=float(b["open"]),
      high=float(b["high"]),
      low=float(b["low"]),
      close=float(b["close"]),
      volume=float(b["volume"]),
    )
    for b in bars
  ]