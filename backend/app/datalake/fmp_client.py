# backend/app/datalake/fmp_client.py

import os
from typing import List, TypedDict, Optional

import httpx


class FmpClientError(Exception):
    """Custom error type for FMP client failures."""
    pass


class FmpSymbolDTO(TypedDict):
    """
    Normalized symbol row coming from FMP company screener.
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
    min_market_cap: int = 50_000_000,
    max_market_cap: Optional[int] = 200_000_000_000,
    exchanges: str = "NYSE,NASDAQ",
    country: str = "US",
    is_etf: bool = False,
    is_fund: bool = False,
    is_actively_trading: bool = True,
    include_all_share_classes: bool = False,
    limit: int = 10_000,
) -> List[FmpSymbolDTO]:
    """
    Fetch a symbol universe from FMP company screener, including market cap,
    sector, industry, etc.

    Endpoint:
      https://financialmodelingprep.com/stable/company-screener
    """
    api_key = _ensure_api_key()

    base_url = "https://financialmodelingprep.com/stable/company-screener"

    params = {
        "apikey": api_key,
        "marketCapMoreThan": str(min_market_cap),
        # FMP uses marketCapLowerThan for the upper bound
        "marketCapLowerThan": str(max_market_cap) if max_market_cap is not None else None,
        "exchange": exchanges,
        "country": country,
        "isEtf": str(is_etf).lower(),
        "isFund": str(is_fund).lower(),
        "isActivelyTrading": str(is_actively_trading).lower(),
        "includeAllShareClasses": str(include_all_share_classes).lower(),
        "limit": str(limit),
    }

    # Remove None values so we don't send empty params
    params = {k: v for k, v in params.items() if v is not None}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(base_url, params=params)

    if resp.status_code >= 400:
        raise RuntimeError(f"FMP HTTP error {resp.status_code}: {resp.text}")

    data = resp.json()
    if not isinstance(data, list):
        raise FmpClientError(f"Unexpected FMP response: {data!r}")

    out: List[FmpSymbolDTO] = []

    for row in data:
        symbol = (row.get("symbol") or "").strip().upper()
        name = (row.get("companyName") or row.get("company_name") or "").strip()
        exchange = (row.get("exchangeShortName") or row.get("exchange") or "").strip().upper()
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