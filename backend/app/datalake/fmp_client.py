# backend/app/datalake/fmp_client.py

import os
from typing import List, Optional, TypedDict

import httpx

# Hard allow-list: we only keep these exchanges, even if FMP returns more.
ALLOWED_EXCHANGES = {"NYSE", "NASDAQ"}


class FmpClientError(Exception):
    """Custom error type for FMP client failures."""

    pass


class FmpSymbolDTO(TypedDict):
    """
    Normalized symbol row coming from FMP stock screener.
    Only keep the fields we actually care about.
    """

    symbol: str
    name: str
    exchange: str
    sector: Optional[str]
    industry: Optional[str]
    market_cap: float
    price: float
    is_etf: bool
    is_actively_trading: bool


FMP_API_KEY = os.getenv("FMP_API_KEY", "").strip()


def _ensure_api_key() -> str:
    if not FMP_API_KEY:
        raise RuntimeError(
            "FMP_API_KEY not set in environment. "
            "Add it to your .env and docker-compose env_file."
        )
    return FMP_API_KEY


async def fetch_fmp_symbol_universe(
    min_market_cap: int = 50_000_000,  # 50M default floor
    max_market_cap: Optional[int] = None,
    # Default to pure NYSE + NASDAQ
    exchanges: str = "NYSE,NASDAQ",
    limit: int = 5000,
    include_etfs: bool = False,
    active_only: bool = True,
) -> List[FmpSymbolDTO]:
    """
    Fetch a symbol universe from FMP company screener, including market cap.

    Docs (company-screener):
      /stable/company-screener?exchange=NYSE,NASDAQ&marketCapMoreThan=...&apikey=...

    We normalize into FmpSymbolDTO and additionally enforce ALLOWED_EXCHANGES.
    """
    api_key = _ensure_api_key()

    base_url = "https://financialmodelingprep.com/stable/company-screener"

    params = {
        "exchange": exchanges,
        "marketCapMoreThan": str(min_market_cap),
        "limit": str(limit),
        "apikey": api_key,
    }

    if max_market_cap is not None:
        params["marketCapLowerThan"] = str(max_market_cap)

    # These flags map to the newer screener filters
    if include_etfs:
        # "Include ETFs" => don't filter at API level;
        # we'll keep the flag in the DTO and you can filter later.
        pass
    else:
        # Ask FMP to filter out ETFs if supported
        params["isEtf"] = "false"

    if active_only:
        params["isActivelyTrading"] = "true"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(base_url, params=params)

    if resp.status_code >= 400:
        raise RuntimeError(f"FMP HTTP error {resp.status_code}: {resp.text}")

    data = resp.json()
    if not isinstance(data, list):
        # Be defensive
        raise FmpClientError(f"Unexpected FMP response: {data!r}")

    out: List[FmpSymbolDTO] = []

    for row in data:
        symbol = (row.get("symbol") or "").strip().upper()
        name = (row.get("companyName") or row.get("company_name") or "").strip()

        # FMP can use either "exchangeShortName" or "exchange"
        exchange_raw = row.get("exchangeShortName") or row.get("exchange") or ""
        exchange = exchange_raw.strip().upper()

        # 🔒 Hard filter: keep only pure NYSE / NASDAQ rows
        if exchange not in ALLOWED_EXCHANGES:
            continue

        sector = (row.get("sector") or None) or None
        industry = (row.get("industry") or None) or None
        market_cap = row.get("marketCap")
        price = row.get("price")

        if not symbol or market_cap is None or price is None:
            continue

        out.append(
            FmpSymbolDTO(
                symbol=symbol,
                name=name or symbol,
                exchange=exchange or "UNKNOWN",
                sector=sector,
                industry=industry,
                market_cap=float(market_cap),
                price=float(price),
                is_etf=bool(row.get("isEtf", False)),
                is_actively_trading=bool(row.get("isActivelyTrading", True)),
            )
        )

    return out
