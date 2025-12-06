# backend/app/datalake/bar_store.py

"""
Simple DuckDB-backed cache for daily OHLCV bars.

- Stores one table: daily_bars
- Keyed by (symbol, trade_date)
- Used as a write-through cache for EODHD daily OHLCV.
"""

import asyncio
import os
from datetime import date, datetime
from typing import List, Sequence

import duckdb

from app.datalake.eodhd_client import fetch_eodhd_daily_ohlcv, PriceBarDTO

# Where the DuckDB file lives inside the backend container
TP_DUCKDB_PATH: str = os.getenv(
    "TP_DUCKDB_PATH",
    # IMPORTANT: keep this default in sync with other datalake modules
    "/data/tradepopping.duckdb",
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

    NOTE: we use trade_date as the date column name.
    """
    con = _get_connection(read_only=False)
    try:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_bars (
                symbol      TEXT NOT NULL,
                trade_date  DATE NOT NULL,
                open        DOUBLE NOT NULL,
                high        DOUBLE NOT NULL,
                low         DOUBLE NOT NULL,
                close       DOUBLE NOT NULL,
                volume      DOUBLE NOT NULL,
                vwap        DOUBLE,
                turnover    DOUBLE,
                change_pct  DOUBLE,
                adj_open    DOUBLE,
                adj_high    DOUBLE,
                adj_low     DOUBLE,
                adj_close   DOUBLE,
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

    - `bars` uses the same shape as EODHD PriceBarDTO.
    - We normalise the ISO `time` into a `trade_date` (DATE).
    - Uses INSERT OR REPLACE on (symbol, trade_date).
    """
    if not bars:
        return 0

    symbol = symbol.upper()

    records = []
    for b in bars:
        # b["time"] is ISO8601, e.g. "2024-01-02T00:00:00+00:00"
        dt = datetime.fromisoformat(b["time"])
        trade_date = dt.date()

        adj_open = b.get("adj_open", b.get("open"))
        adj_high = b.get("adj_high", b.get("high"))
        adj_low = b.get("adj_low", b.get("low"))
        adj_close = b.get("adj_close", b.get("close"))

        records.append(
            (
                symbol,
                trade_date,
                float(b["open"]),
                float(b["high"]),
                float(b["low"]),
                float(b["close"]),
                float(b["volume"]),
                float(b["vwap"]) if b.get("vwap") is not None else None,
                float(b["turnover"]) if b.get("turnover") is not None else None,
                float(b["change_pct"]) if b.get("change_pct") is not None else None,
                float(adj_open) if adj_open is not None else None,
                float(adj_high) if adj_high is not None else None,
                float(adj_low) if adj_low is not None else None,
                float(adj_close) if adj_close is not None else None,
            )
        )

    con = _get_connection(read_only=False)
    try:
        con.execute("BEGIN")
        con.executemany(
            """
            INSERT OR REPLACE INTO daily_bars
                (symbol, trade_date, open, high, low, close, volume,
                 vwap, turnover, change_pct, adj_open, adj_high, adj_low, adj_close)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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


def read_daily_bars(symbol: str, start: date, end: date) -> List[PriceBarDTO]:
    """
    Read cached daily bars for `symbol` in [start, end] (inclusive)
    from DuckDB, returning a PriceBarDTO list.
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
                volume,
                vwap,
                turnover,
                change_pct,
                adj_open,
                adj_high,
                adj_low,
                adj_close
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
    for (
        trade_date,
        o,
        h,
        l,
        c,
        v,
        vwap,
        turnover,
        change_pct,
        adj_open,
        adj_high,
        adj_low,
        adj_close,
    ) in rows:
        bar = {
            "time": f"{trade_date.isoformat()}T00:00:00+00:00",
            "open": float(o),
            "high": float(h),
            "low": float(l),
            "close": float(c),
            "volume": float(v),
        }

        optional_fields = {
            "vwap": vwap,
            "turnover": turnover,
            "change_pct": change_pct,
            "adj_open": adj_open,
            "adj_high": adj_high,
            "adj_low": adj_low,
            "adj_close": adj_close,
        }

        for key, val in optional_fields.items():
            if val is not None:
                bar[key] = float(val)

        dto_rows.append(PriceBarDTO(**bar))

    return dto_rows


async def ingest_eodhd_window(symbol: str, start: date, end: date) -> None:
    """
    Fetch daily bars from EODHD for [start, end] and upsert into daily_bars.
    """
    _ensure_schema()
    bars = await fetch_eodhd_daily_ohlcv(symbol=symbol, start=start, end=end)
    upsert_daily_bars(symbol, bars)


if __name__ == "__main__":
    # Simple manual test when running this module directly
    from datetime import date as _date

    asyncio.run(
        ingest_eodhd_window(
            symbol="AAPL",
            start=_date(2024, 1, 2),
            end=_date(2024, 1, 31),
        )
    )