# backend/app/datahub/symbol_store.py

"""
DuckDB-backed symbol universe store populated from FMP.

Table: universe_symbols

  symbol      TEXT PRIMARY KEY
  name        TEXT
  exchange    TEXT
  sector      TEXT
  industry    TEXT
  market_cap  DOUBLE
  is_etf      BOOLEAN
  is_fund     BOOLEAN
  is_active   BOOLEAN
  updated_at  TIMESTAMP

We fetch a snapshot from FMP and upsert rows by symbol.
"""

import asyncio
import os
from datetime import datetime
from typing import List, Optional, Sequence, Tuple

import duckdb
from app.datahub.fmp_client import FMPSymbolDTO, fetch_fmp_universe

# Where the DuckDB file lives inside the backend container
TP_DUCKDB_PATH: str = os.getenv(
    "TP_DUCKDB_PATH",
    "/app/data/tradepopping_bars.duckdb",
)

# Ensure directory exists
_db_dir = os.path.dirname(TP_DUCKDB_PATH)
if _db_dir:
    os.makedirs(_db_dir, exist_ok=True)


def _get_connection(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """
    Open a DuckDB connection.

    Same pattern as bar_store: open on-demand and close in each function.
    """
    return duckdb.connect(TP_DUCKDB_PATH, read_only=read_only)


def _ensure_schema() -> None:
    """
    Create the universe_symbols table if it does not exist yet.
    """
    con = _get_connection(read_only=False)
    try:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS universe_symbols (
                symbol      TEXT PRIMARY KEY,
                name        TEXT,
                exchange    TEXT,
                sector      TEXT,
                industry    TEXT,
                market_cap  DOUBLE,
                is_etf      BOOLEAN,
                is_fund     BOOLEAN,
                is_active   BOOLEAN,
                updated_at  TIMESTAMP NOT NULL
            )
            """
        )
    finally:
        con.close()


# Run schema creation on import so the table is always present.
_ensure_schema()


def _normalize_row(row: FMPSymbolDTO) -> Optional[Tuple]:
    """
    Map a raw FMPSymbolDTO into our universe_symbols row tuple.

    Returns None if the row is unusable (e.g. missing symbol).
    """
    symbol = row.get("symbol")
    if not symbol:
        return None

    symbol = symbol.upper().strip()
    if not symbol:
        return None

    name = row.get("companyName") or row.get("company_name") or ""

    exchange = (row.get("exchange") or "").upper() or None
    sector = row.get("sector") or None
    industry = row.get("industry") or None

    mc_raw = row.get("marketCap")
    try:
        market_cap = float(mc_raw) if mc_raw not in (None, "", 0) else None
    except (TypeError, ValueError):
        market_cap = None

    is_etf = bool(row.get("isEtf")) if "isEtf" in row else None
    is_fund = bool(row.get("isFund")) if "isFund" in row else None
    is_active = bool(row.get("isActivelyTrading")) if "isActivelyTrading" in row else None

    updated_at = datetime.utcnow()

    return (
        symbol,
        name,
        exchange,
        sector,
        industry,
        market_cap,
        is_etf,
        is_fund,
        is_active,
        updated_at,
    )


def upsert_fmp_symbols(symbols: Sequence[FMPSymbolDTO]) -> int:
    """
    Insert / update universe symbols into DuckDB.

    - Upserts by PRIMARY KEY (symbol).
    - Returns number of rows written.
    """
    if not symbols:
        return 0

    records: List[Tuple] = []
    for raw in symbols:
        row = _normalize_row(raw)
        if row is not None:
            records.append(row)

    if not records:
        return 0

    con = _get_connection(read_only=False)
    try:
        con.execute("BEGIN")
        con.executemany(
            """
            INSERT OR REPLACE INTO universe_symbols (
                symbol,
                name,
                exchange,
                sector,
                industry,
                market_cap,
                is_etf,
                is_fund,
                is_active,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )
        con.execute("COMMIT")
    except Exception:
        try:
            con.execute("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        con.close()

    return len(records)


def read_universe(limit: int = 20) -> List[Tuple]:
    """
    Simple helper: read back some of the universe to inspect it.
    Not used by the app yet, but good for debugging.
    """
    con = _get_connection(read_only=True)
    try:
        rows = con.execute(
            """
            SELECT
                symbol,
                name,
                exchange,
                market_cap,
                sector,
                industry
            FROM universe_symbols
            ORDER BY market_cap DESC NULLS LAST
            LIMIT ?
            """,
            [limit],
        ).fetchall()
    finally:
        con.close()

    return rows


async def ingest_fmp_universe() -> None:
    """
    Fetch the FMP stock universe and upsert into DuckDB.
    """
    print("[FMP] Fetching universe snapshot from FMP...", flush=True)
    symbols = await fetch_fmp_universe()
    print(f"[FMP] Received {len(symbols)} raw records", flush=True)

    written = upsert_fmp_symbols(symbols)
    print(f"[FMP] Upserted {written} rows into universe_symbols", flush=True)

    sample = read_universe(limit=5)
    print("[FMP] Top 5 by market cap:", flush=True)
    for row in sample:
        print("   ", row, flush=True)


if __name__ == "__main__":
    asyncio.run(ingest_fmp_universe())
