# backend/app/datalake/eodhd_client.py

import os
from datetime import date, datetime, timezone
from typing import List, TypedDict, Optional

import httpx


class EodhdClientError(Exception):
    """Custom error type for EODHD client failures."""
    pass


class PriceBarDTO(TypedDict, total=False):
    """
    Normalized OHLCV bar shape for our system.

    Optional fields mirror extended EODHD payload keys so downstream caches
    can persist richer data without changing callers.
    """

    # Required fields
    time: str  # ISO-8601 string (UTC, date-only ok)
    open: float
    high: float
    low: float
    close: float
    volume: float

    # Optional extras
    vwap: float
    turnover: float
    change_pct: float
    adj_open: float
    adj_high: float
    adj_low: float
    adj_close: float


EODHD_API_TOKEN = os.getenv("EODHD_API_TOKEN", "").strip()


def _ensure_api_token() -> str:
    """
    Return the EODHD API token or raise a clear error if it's not configured.
    """
    if not EODHD_API_TOKEN:
        raise RuntimeError(
            "EODHD_API_TOKEN not set in environment. "
            "Add it to your .env and docker-compose env_file."
        )
    return EODHD_API_TOKEN


def _clamp_dates(
    start: date,
    end: date,
    today: Optional[date] = None,
) -> tuple[date, date]:
    """
    Clamp input dates so we never go into the future, but allow end == today.
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
    symbol: str,
    start: date,
    end: date,
    exchange: str = "US",
) -> List[PriceBarDTO]:
    """
    Fetch daily OHLCV bars from EODHD between [start, end], inclusive.

    Uses /api/eod/<symbol>.<exchange> with from/to params.

    We normalize the result into our PriceBarDTO list.
    """
    api_token = _ensure_api_token()
    start_clamped, end_clamped = _clamp_dates(start, end)

    # EODHD expects something like "AAPL.US"
    full_symbol = f"{symbol.upper()}.{exchange.upper()}"

    base_url = "https://eodhd.com/api/eod"
    params = {
        "api_token": api_token,
        "from": start_clamped.isoformat(),
        "to": end_clamped.isoformat(),
        "fmt": "json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(f"{base_url}/{full_symbol}", params=params)

    if resp.status_code >= 400:
        raise RuntimeError(
            f"EODHD HTTP error {resp.status_code}: {resp.text}"
        )

    data = resp.json()

    # If EODHD returns an error message instead of a list
    if isinstance(data, dict) and data.get("code") and data.get("message"):
        raise EodhdClientError(
            f"EODHD error {data.get('code')}: {data.get('message')}"
        )

    if not isinstance(data, list):
        # Be defensive; we'll just return empty
        return []

    bars: List[PriceBarDTO] = []

    for row in data:
        # Expected keys: date, open, high, low, close, volume
        d = row.get("date")
        o = row.get("open")
        h = row.get("high")
        l = row.get("low")
        c = row.get("close")
        v = row.get("volume")

        if not d or any(val is None for val in (o, h, l, c, v)):
            continue

        extras = {
            "vwap": row.get("vwap"),
            "turnover": row.get("turnover"),
            # EODHD uses change_p for percentage change; fall back to change
            "change_pct": row.get("change_p") if row.get("change_p") is not None else row.get("change"),
            "adj_open": row.get("adjusted_open"),
            "adj_high": row.get("adjusted_high"),
            "adj_low": row.get("adjusted_low"),
            # adjusted_close might be named adj_close in some payloads
            "adj_close": row.get("adjusted_close") if row.get("adjusted_close") is not None else row.get("adj_close"),
        }

        # Keep it simple: date-only ISO, treat as UTC midnight
        bar: PriceBarDTO = {
            "time": f"{d}T00:00:00+00:00",
            "open": float(o),
            "high": float(h),
            "low": float(l),
            "close": float(c),
            "volume": float(v),
        }

        # Attach optional extras if present (skip None values)
        for key, val in extras.items():
            if val is not None:
                bar[key] = float(val)

        bars.append(PriceBarDTO(**bar))

    return bars