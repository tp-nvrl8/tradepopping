# backend/app/routes/datalake_fmp.py

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import get_current_user
from app.datalake.fmp_client import fetch_fmp_symbol_universe
from app.datalake.universe_store import upsert_universe, get_universe_stats

router = APIRouter(tags=["datalake-fmp"])


class UniverseIngestResult(BaseModel):
    source: str = "fmp"
    symbols_received: int
    rows_upserted: int


@router.post(
    "/datalake/fmp/universe/ingest",
    response_model=UniverseIngestResult,
)
async def ingest_fmp_universe(
    # These default values match your UI defaults
    min_market_cap: int = Query(50_000_000, ge=0),          # 50M
    max_market_cap: Optional[int] = Query(None, ge=0),
    exchanges: str = Query("NYSE,NASDAQ,AMEX"),
    limit: int = Query(5000, ge=1, le=10_000),
    include_etfs: bool = Query(False),
    active_only: bool = Query(True),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Pull the symbol universe from FMP company screener and upsert into DuckDB.

    Filters (min/max cap, exchanges, ETF / active flags, limit) come from
    query parameters (driven by the DataHub UI).
    """
    try:
        symbols = await fetch_fmp_symbol_universe(
            min_market_cap=min_market_cap,
            max_market_cap=max_market_cap,
            exchanges=exchanges,
            limit=limit,
            include_etfs=include_etfs,
            active_only=active_only,
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