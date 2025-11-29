# backend/app/routes/datalake_fmp.py

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.datalake.fmp_client import fetch_fmp_symbol_universe
from app.datalake.universe_store import upsert_universe, get_universe_stats

router = APIRouter(tags=["datalake-fmp"])


class UniverseIngestRequest(BaseModel):
    """
    Filters the UI can send when ingesting the FMP universe.
    Defaults match our current TradePopping 'hunting ground'.
    """
    min_market_cap: int = 50_000_000
    max_market_cap: Optional[int] = 5_000_000_000
    exchanges: str = "NYSE,NASDAQ,AMEX"
    country: str = "US"
    is_etf: bool = False
    is_fund: bool = False
    is_actively_trading: bool = True
    include_all_share_classes: bool = False


class UniverseIngestResult(BaseModel):
    source: str = "fmp"
    symbols_received: int
    rows_upserted: int


@router.post(
    "/datalake/fmp/universe/ingest",
    response_model=UniverseIngestResult,
)
async def ingest_fmp_universe(
    payload: UniverseIngestRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Pull the symbol universe from FMP and upsert into DuckDB,
    using filters supplied by the UI.
    """
    try:
        symbols = await fetch_fmp_symbol_universe(
            min_market_cap=payload.min_market_cap,
            max_market_cap=payload.max_market_cap,
            exchanges=payload.exchanges,
            country=payload.country,
            is_etf=payload.is_etf,
            is_fund=payload.is_fund,
            is_actively_trading=payload.is_actively_trading,
            include_all_share_classes=payload.include_all_share_classes,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error fetching universe from FMP: {e}",
        )

    try:
        rows_upserted = upsert_universe(symbols)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error writing universe to DuckDB: {e}",
        )

    return UniverseIngestResult(
        symbols_received=len(symbols),
        rows_upserted=rows_upserted,
    )


@router.get("/datalake/universe/stats")
def universe_stats(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Return aggregate stats about the stored symbol universe.
    """
    try:
        return get_universe_stats()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reading universe stats: {e}",
        )