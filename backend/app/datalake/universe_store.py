# backend/app/datalake/universe_store.py

from __future__ import annotations

import os
from typing import Dict, List, TypedDict

import duckdb

from app.datalake.fmp_client import FmpSymbolDTO

# Use the same DuckDB file as the rest of the datalake
# IMPORTANT: this matches the container path /data/tradepopping.duckdb
TP_DUCKDB_PATH = os.getenv(
    "TP_DUCKDB_PATH",
    "/data/tradepopping.duckdb",
)

TABLE_NAME = "symbol_universe"


class UniverseStats(TypedDict):
    total_symbols: int
    by_exchange: Dict[str, int]
    by_type: Dict[str, int]
    by_sector: Dict[str, int]
    by_cap_bucket: Dict[str, int]


def _get_conn(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(TP_DUCKDB_PATH, read_only=read_only)


def _ensure_schema() -> None:
    """
    Make sure the symbol_universe table exists.
    """
    con = _get_conn(read_only=False)
    try:
        con.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
                symbol              TEXT PRIMARY KEY,
                name                TEXT NOT NULL,
                exchange            TEXT NOT NULL,
                sector              TEXT,
                industry            TEXT,
                market_cap          DOUBLE NOT NULL,
                price               DOUBLE NOT NULL,
                is_etf              BOOLEAN NOT NULL,
                is_actively_trading BOOLEAN NOT NULL
            )
            """
        )
    finally:
        con.close()


# Ensure table exists on import
_ensure_schema()


def upsert_universe(rows: List[FmpSymbolDTO]) -> int:
    """
    Insert / update the FMP symbol universe into DuckDB.

    - Deduplicates by symbol (PRIMARY KEY).
    - Safe to call repeatedly; newer rows overwrite old ones.
    """
    if not rows:
        return 0

    records = [
        (
            row["symbol"],
            row["name"],
            row["exchange"],
            row.get("sector"),
            row.get("industry"),
            float(row["market_cap"]),
            float(row["price"]),
            bool(row["is_etf"]),
            bool(row["is_actively_trading"]),
        )
        for row in rows
    ]

    con = _get_conn(read_only=False)
    try:
        con.execute("BEGIN")
        con.executemany(
            f"""
            INSERT OR REPLACE INTO {TABLE_NAME} (
                symbol,
                name,
                exchange,
                sector,
                industry,
                market_cap,
                price,
                is_etf,
                is_actively_trading
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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


def get_universe_stats() -> UniverseStats:
    """
    Aggregate stats for the stored symbol universe.

    Returns a dict with:
      - total_symbols
      - by_exchange
      - by_type (EQUITY vs ETF)
      - by_sector
      - by_cap_bucket (penny/small/mid/large)
    """

    _ensure_schema()
    con = _get_conn(read_only=True)
    try:
        # Total rows
        total_row = con.execute(
            f"SELECT COUNT(*) FROM {TABLE_NAME}"
        ).fetchone()
        total_symbols = int(total_row[0]) if total_row else 0

        # By exchange
        exchange_rows = con.execute(
            f"""
            SELECT
              COALESCE(NULLIF(TRIM(exchange), ''), 'UNKNOWN') AS exch,
              COUNT(*) AS n
            FROM {TABLE_NAME}
            GROUP BY exch
            ORDER BY n DESC
            """
        ).fetchall()
        by_exchange: Dict[str, int] = {
            exch: int(n) for exch, n in exchange_rows
        }

        # By type (ETF vs EQUITY)
        type_rows = con.execute(
            f"""
            SELECT
              CASE WHEN is_etf THEN 'ETF' ELSE 'EQUITY' END AS t,
              COUNT(*) AS n
            FROM {TABLE_NAME}
            GROUP BY t
            ORDER BY n DESC
            """
        ).fetchall()
        by_type: Dict[str, int] = {t: int(n) for t, n in type_rows}

        # By sector (top sectors; UNKNOWN grouped)
        sector_rows = con.execute(
            f"""
            SELECT
              COALESCE(NULLIF(TRIM(sector), ''), 'UNKNOWN') AS s,
              COUNT(*) AS n
            FROM {TABLE_NAME}
            GROUP BY s
            ORDER BY n DESC
            """
        ).fetchall()
        by_sector: Dict[str, int] = {s: int(n) for s, n in sector_rows}

        # By cap bucket:
        #   - penny: price < 5
        #   - small_cap: market_cap < 2B
        #   - mid_cap:   2B–10B
        #   - large_cap: >= 10B
        cap_rows = con.execute(
            f"""
            SELECT bucket, COUNT(*) AS n
            FROM (
              SELECT
                CASE
                  WHEN price < 5 THEN 'penny'
                  WHEN market_cap < 2e9 THEN 'small_cap'
                  WHEN market_cap < 10e9 THEN 'mid_cap'
                  ELSE 'large_cap'
                END AS bucket
              FROM {TABLE_NAME}
            )
            GROUP BY bucket
            ORDER BY n DESC
            """
        ).fetchall()
        by_cap_bucket: Dict[str, int] = {
            bucket: int(n) for bucket, n in cap_rows
        }

        return UniverseStats(
            total_symbols=total_symbols,
            by_exchange=by_exchange,
            by_type=by_type,
            by_sector=by_sector,
            by_cap_bucket=by_cap_bucket,
        )
    finally:
        con.close()