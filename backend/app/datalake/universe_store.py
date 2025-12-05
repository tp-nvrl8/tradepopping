# backend/app/datalake/universe_store.py

from __future__ import annotations

import os
from typing import Dict, List, TypedDict, Optional, Tuple, Any

import duckdb

from app.datalake.fmp_client import FmpSymbolDTO

# Use the same DuckDB file everywhere (env wins, default is DO/dev-friendly)
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
    """
    Always open DuckDB with a single consistent configuration.

    DuckDB does not like multiple connections to the same file with
    different configs (including read_only), so we ignore the flag and
    enforce "read-only" at the application level instead.
    """
    return duckdb.connect(TP_DUCKDB_PATH)

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


# ---------- Universe browser helpers ----------

def browse_universe(
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    sector: Optional[str] = None,
    min_market_cap: Optional[float] = None,
    max_market_cap: Optional[float] = None,
    exchanges: Optional[List[str]] = None,
    sort_by: str = "symbol",
    sort_dir: str = "asc",
) -> Tuple[List[Dict[str, Any]], int, List[str], List[str], Optional[float], Optional[float]]:
    """
    Server-side browsing helper:

    - paging
    - search (symbol/name)
    - sector filter
    - cap filters
    - exchange filter
    - sorting
    """
    _ensure_schema()
    con = _get_conn(read_only=True)
    try:
        # Clamp page + page_size
        page = max(1, page)
        page_size = max(1, min(page_size, 500))

        # Build WHERE
        where_clauses: List[str] = []
        params: List[Any] = []

        if search:
            s = f"%{search.strip().upper()}%"
            where_clauses.append(
                "(UPPER(symbol) LIKE ? OR UPPER(name) LIKE ?)"
            )
            params.extend([s, s])

        if sector:
            where_clauses.append(
                "COALESCE(NULLIF(TRIM(sector), ''), 'UNKNOWN') = ?"
            )
            params.append(sector)

        if exchanges:
            exch_clean = [ex.strip().upper() for ex in exchanges if ex.strip()]
            if exch_clean:
                placeholders = ", ".join(["?"] * len(exch_clean))
                where_clauses.append(f"exchange IN ({placeholders})")
                params.extend(exch_clean)

        if min_market_cap is not None:
            where_clauses.append("market_cap >= ?")
            params.append(float(min_market_cap))

        if max_market_cap is not None:
            where_clauses.append("market_cap <= ?")
            params.append(float(max_market_cap))

        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)

        # Sorting
        sort_map = {
            "symbol": "symbol",
            "name": "name",
            "sector": "sector",
            "exchange": "exchange",
            "market_cap": "market_cap",
            "price": "price",
        }
        sort_column = sort_map.get(sort_by, "symbol")
        sort_dir_sql = "DESC" if sort_dir.lower() == "desc" else "ASC"

        # Total count
        total_row = con.execute(
            f"SELECT COUNT(*) FROM {TABLE_NAME}{where_sql}",
            params,
        ).fetchone()
        total_items = int(total_row[0]) if total_row else 0

        # Page slice
        offset = (page - 1) * page_size

        rows = con.execute(
            f"""
            SELECT
              symbol,
              name,
              exchange,
              sector,
              industry,
              market_cap,
              price,
              is_etf,
              is_actively_trading
            FROM {TABLE_NAME}
            {where_sql}
            ORDER BY {sort_column} {sort_dir_sql}
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        ).fetchall()

        items: List[Dict[str, Any]] = []
        for (
            symbol,
            name,
            exchange,
            sector_val,
            industry,
            market_cap,
            price,
            is_etf,
            is_actively_trading,
        ) in rows:
            items.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "exchange": exchange,
                    "sector": sector_val,
                    "industry": industry,
                    "market_cap": float(market_cap),
                    "price": float(price),
                    "is_etf": bool(is_etf),
                    "is_actively_trading": bool(is_actively_trading),
                }
            )

        # Available sectors (full table, not filtered)
        sector_rows = con.execute(
            f"""
            SELECT DISTINCT
              COALESCE(NULLIF(TRIM(sector), ''), 'UNKNOWN') AS s
            FROM {TABLE_NAME}
            ORDER BY s ASC
            """
        ).fetchall()
        sectors = [s for (s,) in sector_rows]

        # Available exchanges (full table)
        exch_rows = con.execute(
            f"""
            SELECT DISTINCT
              COALESCE(NULLIF(TRIM(exchange), ''), 'UNKNOWN') AS e
            FROM {TABLE_NAME}
            ORDER BY e ASC
            """
        ).fetchall()
        exch_list = [e for (e,) in exch_rows]

        # Global cap range
        cap_row = con.execute(
            f"SELECT MIN(market_cap), MAX(market_cap) FROM {TABLE_NAME}"
        ).fetchone()
        min_cap_global = float(cap_row[0]) if cap_row and cap_row[0] is not None else None
        max_cap_global = float(cap_row[1]) if cap_row and cap_row[1] is not None else None

        return items, total_items, sectors, exch_list, min_cap_global, max_cap_global
    finally:
        con.close()