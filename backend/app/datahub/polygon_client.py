# backend/app/datahub/polygon_client.py

from __future__ import annotations

import os
from datetime import date, datetime, timezone
from typing import List

import httpx

from .schemas import PriceBar


class PolygonConfigError(RuntimeError):
  pass


def _get_polygon_api_key() -> str:
  api_key = os.getenv("POLYGON_API_KEY")
  if not api_key:
    raise PolygonConfigError(
      "POLYGON_API_KEY is not set in the environment. "
      "Set it in your Codespaces/DO environment or .env file."
    )
  return api_key


def _get_polygon_base_url() -> str:
  # You can override with POLYGON_BASE_URL if you ever need to.
  return os.getenv("POLYGON_BASE_URL", "https://api.polygon.io")


async def fetch_polygon_daily_ohlcv(
  symbol: str,
  start_date: date,
  end_date: date,
) -> List[PriceBar]:
  """
  Fetch daily OHLCV bars from Polygon aggregates API.

  Uses:
    GET /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}

  Returns normalized PriceBar objects.
  """

  api_key = _get_polygon_api_key()
  base_url = _get_polygon_base_url()

  # Polygon expects YYYY-MM-DD for from/to
  from_str = start_date.isoformat()
  to_str = end_date.isoformat()

  url = (
    f"{base_url}/v2/aggs/ticker/{symbol}/range/1/day/"
    f"{from_str}/{to_str}"
  )

  params = {
    "adjusted": "true",
    "sort": "asc",
    "limit": 50000,
    "apiKey": api_key,
  }

  async with httpx.AsyncClient(timeout=15.0) as client:
    resp = await client.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()

  # Basic sanity check
  if data.get("status") != "OK":
    message = data.get("message") or "Unknown Polygon error"
    raise RuntimeError(f"Polygon error: {message}")

  results = data.get("results") or []
  bars: List[PriceBar] = []

  for item in results:
    # Polygon aggregates use 't' = unix ms timestamp
    ts_ms = item.get("t")
    if ts_ms is None:
      continue

    ts = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)

    o = item.get("o")
    h = item.get("h")
    l = item.get("l")
    c = item.get("c")
    v = item.get("v")

    # Skip incomplete rows
    if any(val is None for val in (o, h, l, c, v)):
      continue

    bars.append(
      PriceBar(
        time=ts,
        open=float(o),
        high=float(h),
        low=float(l),
        close=float(c),
        volume=int(v),
      )
    )

  return bars