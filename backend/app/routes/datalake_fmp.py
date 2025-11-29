# backend/app/routes/datalake_fmp.py

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
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
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UniverseIngestResult:
    """
    Pull the symbol universe from FMP and upsert into DuckDB.

    TEMP DEBUG MODE:
    - We let any error from `fetch_fmp_symbol_universe` bubble up so that
      the full traceback is visible in `docker compose logs backend`.
    """

    # 🔍 Do NOT wrap this in try/except for now — we want the real error.
    symbols = await fetch_fmp_symbol_universe()
    print(f"[FMP UNIVERSE] fetched {len(symbols)} symbols", flush=True)

    # We still keep a wrapper around our own DB write logic.
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
def universe_stats(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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