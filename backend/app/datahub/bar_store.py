# backend/app/datahub/bar_store.py

"""
Simple DuckDB-backed cache for daily OHLCV bars.

- Stores one table: daily_bars
- Keyed by (symbol, trade_date)
- Used by the Polygon datahub endpoint as a write-through cache.
"""

import os
from datetime import date, datetime
from typing import List, Sequence

import duckdb

from app.datahub.polygon_client import PriceBarDTO

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

    We keep this very simple: open on-demand and close in each function.
    """
    return duckdb.connect(TP_DUCKDB_PATH, read_only=read_only)


def _ensure_schema() -> None:
    """
    Create the daily_bars table if it does not exist yet.

    NOTE: We use `trade_date` as the date column name to match our
    earlier experiments so we don't fight column name mismatches.
    """
    con = _get_connection(read_only=False)
    try:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_bars (
                symbol     TEXT NOT NULL,
                trade_date DATE NOT NULL,
                open       DOUBLE NOT NULL,
                high       DOUBLE NOT NULL,
                low        DOUBLE NOT NULL,
                close      DOUBLE NOT NULL,
                volume     DOUBLE NOT NULL,
                PRIMARY KEY (symbol, trade_date)
            )
            """
        )
    finally:
        con.close()


# Run schema creation on import so the table is always present.
_ensure_schema()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def upsert_daily_bars(symbol: str, bars: Sequence[PriceBarDTO]) -> int:
    """
    Insert / update daily bars for a symbol into DuckDB.

    - `bars` uses the same shape as PolygonClient's PriceBarDTO.
    - We normalise the ISO `time` into a `trade_date` (DATE).
    - Uses INSERT OR REPLACE on (symbol, trade_date).
    """
    if not bars:
        return 0

    symbol = symbol.upper()

    records = []
    for b in bars:
        # b["time"] is ISO8601 string, e.g. "2024-01-02T00:00:00+00:00"
        dt = datetime.fromisoformat(b["time"])
        trade_date = dt.date()

        records.append(
            (
                symbol,
                trade_date,
                float(b["open"]),
                float(b["high"]),
                float(b["low"]),
                float(b["close"]),
                float(b["volume"]),
            )
        )

    con = _get_connection(read_only=False)
    try:
        con.execute("BEGIN")
        con.executemany(
            """
            INSERT OR REPLACE INTO daily_bars
                (symbol, trade_date, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )
        con.execute("COMMIT")
    except Exception:
        # Best effort rollback; if it fails we just re-raise.
        try:
            con.execute("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        con.close()

    return len(records)


def read_daily_bars(symbol: str, start: date, end: date) -> List[PriceBarDTO]:
    """
    Read cached daily bars for `symbol` in [start, end] (inclusive)
    from DuckDB, returning the same DTO shape as PolygonClient.
    """
    symbol = symbol.upper()

    con = _get_connection(read_only=True)
    try:
        rows = con.execute(
            """
            SELECT
                trade_date,
                open,
                high,
                low,
                close,
                volume
            FROM daily_bars
            WHERE symbol = ?
              AND trade_date BETWEEN ? AND ?
            ORDER BY trade_date
            """,
            [symbol, start, end],
        ).fetchall()
    finally:
        con.close()

    dto_rows: List[PriceBarDTO] = []
    for trade_date, o, h, l, c, v in rows:
        dto_rows.append(
            PriceBarDTO(
                time=trade_date.isoformat(),
                open=float(o),
                high=float(h),
                low=float(l),
                close=float(c),
                volume=float(v),
            )
        )

    return dto_rows