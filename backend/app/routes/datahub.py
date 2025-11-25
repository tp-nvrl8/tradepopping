# backend/app/routes/datahub.py

from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, HTTPException, Query

from app.datahub.schemas import PriceBar
from app.datahub.polygon_client import (
  fetch_polygon_daily_ohlcv,
  PolygonConfigError,
)

router = APIRouter(prefix="/datahub", tags=["datahub"])


@router.get(
  "/polygon/daily-ohlcv",
  response_model=List[PriceBar],
  summary="Fetch daily OHLCV bars from Polygon",
)
async def get_polygon_daily_ohlcv(
  symbol: str = Query(..., description="Ticker symbol, e.g. AAPL"),
  start: date = Query(..., description="Start date (YYYY-MM-DD)"),
  end: date = Query(..., description="End date (YYYY-MM-DD)"),
):
  """
  Simple DataHub entry point:

  - Talks to Polygon aggregates API
  - Normalizes to PriceBar objects
  - Returns the series directly to the frontend

  Later, this endpoint can:
    * Read from your data lake instead of Polygon
    * Or decide based on cache state (lake vs. live pull)
  """
  try:
    bars = await fetch_polygon_daily_ohlcv(symbol, start, end)
  except PolygonConfigError as exc:
    raise HTTPException(status_code=500, detail=str(exc))
  except Exception as exc:  # pragma: no cover - generic network / API issues
    raise HTTPException(
      status_code=502,
      detail=f"Error fetching data from Polygon: {exc}",
    ) from exc

  return bars