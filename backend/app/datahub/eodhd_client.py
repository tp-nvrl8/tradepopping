"""Client for fetching daily OHLCV data from EODHD."""

import os
from datetime import date, datetime, timezone
from typing import List, Optional, TypedDict

import httpx


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


EODHD_API_TOKEN = os.getenv("EODHD_API_TOKEN", "").strip()


def _ensure_api_key() -> str:
    """
    Return the EODHD API token or raise a clear error if it is missing.
    """

    if not EODHD_API_TOKEN:
        raise RuntimeError(
            "EODHD_API_TOKEN not set in environment. "
            "Check your .env and docker-compose env_file config."
        )
    return EODHD_API_TOKEN


def _clamp_dates(
    start: date, end: date, today: Optional[date] = None
) -> tuple[date, date]:
    """
    Clamp input dates so we never go into the future, but allow end == today.

    Rules:
    - if start > today  -> error
    - if end  > today   -> clamp end = today
    - if end  < start   -> error
    """

    if today is None:
        today = datetime.now(timezone.utc).date()

    if start > today:
        raise ValueError("Start date cannot be in the future.")

    if end > today:
        end = today

    if end < start:
        raise ValueError("End date cannot be before start date.")

    return start, end


async def fetch_eodhd_daily_ohlcv(
    symbol: str, start: date, end: date
) -> List[PriceBarDTO]:
    """
    Fetch daily OHLCV bars from EODHD between [start, end], inclusive.
    """

    api_token = _ensure_api_key()
    start_clamped, end_clamped = _clamp_dates(start, end)

    url = f"https://eodhd.com/api/eod/{symbol.upper()}.US"
    params = {
        "from": start_clamped.isoformat(),
        "to": end_clamped.isoformat(),
        "period": "d",
        "order": "a",
        "fmt": "json",
        "api_token": api_token,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)

    if resp.status_code >= 400:
        raise RuntimeError(f"EODHD HTTP error {resp.status_code}: {resp.text}")

    data = resp.json() or []

    if not data:
        return []

    bars: List[PriceBarDTO] = []

    for row in data:
        date_str = row.get("date")
        if not date_str:
            continue

        dt = datetime.fromisoformat(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        o = row.get("open")
        h = row.get("high")
        l = row.get("low")
        c = row.get("close")
        v = row.get("volume")

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
