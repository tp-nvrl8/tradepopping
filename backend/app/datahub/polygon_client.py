# backend/app/datahub/polygon_client.py

import os
from datetime import date, datetime, timezone
from typing import List, Optional, TypedDict

import httpx
from pydantic import BaseModel


class PolygonClientError(Exception):
    """Custom error type for Polygon client failures."""

    pass


class PriceBarDTO(TypedDict):
    """
    Shape sent back to the frontend Data Hub page.
    """

    time: str  # ISO-8601 string (UTC)
    open: float
    high: float
    low: float
    close: float
    volume: float


POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "").strip()


def _ensure_api_key() -> str:
    """
    Return the Polygon API key or raise a clear error
    if it's not configured.
    """
    if not POLYGON_API_KEY:
        raise RuntimeError(
            "POLYGON_API_KEY not set in environment. "
            "Check your .env and docker-compose env_file config."
        )
    return POLYGON_API_KEY


def _clamp_dates(
    start: date,
    end: date,
    today: Optional[date] = None,
) -> tuple[date, date]:
    """
    Clamp input dates so we never go into the future, but allow
    end == today (the key behavior we want for 'today's bar').

    Rules:
      - if start > today  -> error
      - if end  > today   -> clamp end = today
      - if end  < start   -> error
    """
    if today is None:
        # Use UTC so we behave consistently inside the container
        today = datetime.now(timezone.utc).date()

    if start > today:
        raise ValueError("Start date cannot be in the future.")

    if end > today:
        end = today

    if end < start:
        raise ValueError("End date cannot be before start date.")

    return start, end


async def fetch_polygon_daily_ohlcv(
    symbol: str,
    start: date,
    end: date,
) -> List[PriceBarDTO]:
    """
    Fetch daily OHLCV bars from Polygon between [start, end], inclusive.

    - Uses /v2/aggs/ticker/{symbol}/range/1/day/{start}/{end}
    - Allows end == today (no artificial block).
    - Clamps any future end date back to today.
    - Returns an empty list if Polygon has no bars in that window
      (e.g. weekend, holiday, or truly no trading yet),
      instead of throwing an error.
    """

    api_key = _ensure_api_key()
    start_clamped, end_clamped = _clamp_dates(start, end)

    # Polygon wants YYYY-MM-DD in the path
    start_str = start_clamped.isoformat()
    end_str = end_clamped.isoformat()

    url = (
        f"https://api.polygon.io/v2/aggs/ticker/"
        f"{symbol.upper()}/range/1/day/{start_str}/{end_str}"
    )

    params = {
        "apiKey": api_key,
        "adjusted": "true",
        "sort": "asc",
        "limit": 5000,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)

    # If Polygon itself errors (401, 403, 5xx etc.), raise a clear error
    if resp.status_code >= 400:
        raise RuntimeError(f"Polygon HTTP error {resp.status_code}: {resp.text}")

    data = resp.json()

    # Polygon returns:
    # {
    #   "ticker": "AAPL",
    #   "queryCount": ...,
    #   "resultsCount": ...,
    #   "results": [
    #       { "t": 1731542400000, "o": ..., "h": ..., "l": ..., "c": ..., "v": ... },
    #       ...
    #   ],
    #   ...
    # }
    results = data.get("results") or []

    # IMPORTANT:
    # Do NOT treat "no results" as an error.
    # Just return [] so the frontend can show "No data to preview"
    # without blowing up.
    if not results:
        return []

    bars: List[PriceBarDTO] = []

    for row in results:
        # t is epoch millis in UTC
        ts_ms = row.get("t")
        if ts_ms is None:
            continue

        dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)

        o = row.get("o")
        h = row.get("h")
        l = row.get("l")
        c = row.get("c")
        v = row.get("v")

        # basic sanity check
        if any(val is None for val in (o, h, l, c, v)):
            continue

        bars.append(
            PriceBarDTO(
                time=dt.isoformat(),
                open=float(o),
                high=float(h),
                low=float(l),
                close=float(c),
                volume=float(v),
            )
        )

    return bars
