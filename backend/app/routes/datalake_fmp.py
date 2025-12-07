# backend/app/routes/datalake_fmp.py

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import duckdb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user

router = APIRouter(tags=["datalake-fmp"])

TP_DUCKDB_PATH: str = os.getenv(
    "TP_DUCKDB_PATH",
    "/data/tradepopping.duckdb",
)


def _get_conn() -> duckdb.DuckDBPyConnection:
  return duckdb.connect(TP_DUCKDB_PATH)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class FmpUniverseSummary(BaseModel):
    total_symbols: int
    exchanges: List[str]
    last_ingested_at: Optional[str]
    min_market_cap: Optional[float]
    max_market_cap: Optional[float]


class FmpUniverseIngestResponse(BaseModel):
    """
    For now this is a *no-op* placeholder that just reports current counts.
    Later we can wire it to a real FMP ingest function.
    """
    symbols_ingested: int
    symbols_updated: int
    symbols_skipped: int
    total_symbols_after: int
    started_at: str
    finished_at: str


# ---------------------------------------------------------------------------
# Summary endpoint (used by FmpUniverseSection)
# ---------------------------------------------------------------------------

@router.get(
    "/datalake/fmp/universe/summary",
    response_model=FmpUniverseSummary,
)
async def get_fmp_universe_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Summarize the symbol_universe table:
      - total symbol count
      - distinct exchanges
      - min/max market cap

    This does NOT modify data; it's read-only.
    """
    con = _get_conn()
    try:
        # Make sure the table exists
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = 'symbol_universe';"
        ).fetchall()

        if not tables:
            # No universe ingested yet
            return FmpUniverseSummary(
                total_symbols=0,
                exchanges=[],
                last_ingested_at=None,
                min_market_cap=None,
                max_market_cap=None,
            )

        # total symbols
        total_symbols = con.execute(
            "SELECT COUNT(*) FROM symbol_universe;"
        ).fetchone()[0]

        # distinct exchanges
        exchange_rows = con.execute(
            "SELECT DISTINCT exchange FROM symbol_universe ORDER BY exchange;"
        ).fetchall()
        exchanges = [r[0] for r in exchange_rows if r[0] is not None]

        # market cap range (if column exists)
        min_cap = None
        max_cap = None
        try:
            min_cap, max_cap = con.execute(
                "SELECT MIN(market_cap), MAX(market_cap) FROM symbol_universe;"
            ).fetchone()
        except Exception:
            # If market_cap column doesn't exist, just leave as None
            min_cap = None
            max_cap = None

        # last_ingested_at – only if you have that column; otherwise None
        last_ingested_at: Optional[str] = None
        try:
            row = con.execute(
                "SELECT MAX(updated_at) FROM symbol_universe;"
            ).fetchone()
            if row and row[0] is not None:
                last_ingested_at = str(row[0])
        except Exception:
            last_ingested_at = None

        return FmpUniverseSummary(
            total_symbols=int(total_symbols),
            exchanges=exchanges,
            last_ingested_at=last_ingested_at,
            min_market_cap=float(min_cap) if min_cap is not None else None,
            max_market_cap=float(max_cap) if max_cap is not None else None,
        )

    finally:
        con.close()


# ---------------------------------------------------------------------------
# Placeholder ingest endpoint (keeps UI from 404’ing)
# ---------------------------------------------------------------------------

@router.post(
    "/datalake/fmp/universe/ingest",
    response_model=FmpUniverseIngestResponse,
)
async def ingest_fmp_universe_placeholder(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Placeholder for FMP universe ingest.

    Right now this DOES NOT call FMP; it simply reports current counts.
    We'll wire this to the real FMP ingest pipeline in a later step.
    """
    con = _get_conn()
    try:
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = 'symbol_universe';"
        ).fetchall()

        if not tables:
            total = 0
        else:
            total = con.execute(
                "SELECT COUNT(*) FROM symbol_universe;"
            ).fetchone()[0]

    finally:
        con.close()

    now = datetime.utcnow().isoformat() + "Z"

    return FmpUniverseIngestResponse(
        symbols_ingested=0,
        symbols_updated=0,
        symbols_skipped=int(total),
        total_symbols_after=int(total),
        started_at=now,
        finished_at=now,
    )