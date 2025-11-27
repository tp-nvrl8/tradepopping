import os
from typing import Optional, TypedDict

import httpx


class FmpSymbolDTO(TypedDict):
    symbol: str
    name: str
    exchange: str
    asset_type: str
    is_active: bool
    market_cap: Optional[float]


def _ensure_fmp_api_key() -> str:
    api_key = os.getenv("FMP_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("FMP_API_KEY environment variable is not set")
    return api_key


async def fetch_fmp_symbol_universe(limit: int = 2000) -> list[FmpSymbolDTO]:
    api_key = _ensure_fmp_api_key()
    url = "https://financialmodelingprep.com/api/v3/stock/list"
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, params={"apikey": api_key})
        if resp.status_code >= 400:
            raise RuntimeError(f"FMP HTTP error {resp.status_code}: {resp.text}")
        data = resp.json()
        if not isinstance(data, list):
            raise RuntimeError("Unexpected FMP /stock/list payload")

        symbols: list[FmpSymbolDTO] = []
        for row in data:
            symbol = row.get("symbol") or ""
            if not symbol:
                continue
            symbols.append(
                FmpSymbolDTO(
                    symbol=symbol,
                    name=row.get("name") or "",
                    exchange=row.get("exchangeShortName")
                    or row.get("exchange")
                    or "",
                    asset_type=row.get("type") or "Unknown",
                    is_active=bool(row.get("isActivelyTrading", True)),
                    market_cap=row.get("marketCap"),
                )
            )
            if len(symbols) >= limit:
                break

        return symbols
