# backend/app/routes/datalake_fmp.py

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import get_current_user
from app.datalake.fmp_client import fetch_fmp_symbol_universe
from app.datalake.universe_store import (upsert_universe, get_universe_stats, browse_universe, UniverseStats,)

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

# ---------- Universe browser API ----------

class UniverseRowModel(BaseModel):
  symbol: str
  name: str
  exchange: str
  sector: Optional[str] = None
  industry: Optional[str] = None
  market_cap: float
  price: float
  is_etf: bool
  is_actively_trading: bool


class UniverseBrowseResponse(BaseModel):
  items: List[UniverseRowModel]
  total_items: int
  page: int
  page_size: int
  total_pages: int
  sectors: List[str]
  exchanges: List[str]
  min_market_cap: Optional[float]
  max_market_cap: Optional[float]


@router.get(
  "/datalake/universe/browse",
  response_model=UniverseBrowseResponse,
)
async def browse_symbol_universe(
  page: int = Query(1, ge=1),
  page_size: int = Query(50, ge=1, le=500),
  search: Optional[str] = Query(None, description="Search by symbol or name"),
  sector: Optional[str] = Query(None),
  min_market_cap: Optional[float] = Query(None),
  max_market_cap: Optional[float] = Query(None),
  exchanges: Optional[str] = Query(
    None,
    description="Comma-separated exchanges (e.g. NYSE,NASDAQ)"
  ),
  sort_by: str = Query(
    "symbol",
    regex="^(symbol|name|sector|exchange|market_cap|price)$"
  ),
  sort_dir: str = Query(
    "asc",
    regex="^(asc|desc)$"
  ),
  current_user: Dict[str, Any] = Depends(get_current_user),
):
  """
  Browse the stored symbol_universe with paging, sorting, and filters.
  """

  exch_list: Optional[List[str]] = None
  if exchanges:
    exch_list = [e.strip().upper() for e in exchanges.split(",") if e.strip()]

  (
    items,
    total_items,
    sectors,
    exch_all,
    min_cap_global,
    max_cap_global,
  ) = browse_universe(
    page=page,
    page_size=page_size,
    search=search,
    sector=sector,
    min_market_cap=min_market_cap,
    max_market_cap=max_market_cap,
    exchanges=exch_list,
    sort_by=sort_by,
    sort_dir=sort_dir,
  )

  total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1

  item_models = [UniverseRowModel(**row) for row in items]

  return UniverseBrowseResponse(
    items=item_models,
    total_items=total_items,
    page=page,
    page_size=page_size,
    total_pages=total_pages,
    sectors=sectors,
    exchanges=exch_all,
    min_market_cap=min_cap_global,
    max_market_cap=max_cap_global,
  )