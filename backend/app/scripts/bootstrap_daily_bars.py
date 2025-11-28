# backend/app/scripts/bootstrap_daily_bars.py

"""
Historical bootstrap: pull daily bars from Polygon and store them in DuckDB.

You run this *inside* the backend container with:
    docker compose exec backend python -m app.scripts.bootstrap_daily_bars
"""

import os
import asyncio
from datetime import date
from typing import List, TypedDict

import duckdb  # uses the package from backend requirements.txt

from app.datahub.polygon_client import fetch_polygon_daily_ohlcv


# --- Types mirroring polygon_client ------------------------------


class PriceBarDTO(TypedDict):
    time: str   # ISO-8601 (UTC)
    open: float
    high: float
    low: float
    close: float
    volume: float


# --- DuckDB plumbing ---------------------------------------------

DB_PATH = os.getenv("TP_DUCKDB_PATH", "/app/data/tradepopping_bars.duckdb")


def get_conn(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """
    Open a DuckDB connection to our bars DB.
    """
    # DuckDB ignores read_only for file that doesn't exist yet,
    # so we just pass the path.
    return duckdb.connect(DB_PATH, read_only=read_only)


def ensure_schema(conn: duckdb.DuckDBPyConnection) -> None:
    """
    Make sure the daily_bars table exists with the expected schema.
    Safe to call multiple times.
    """
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_bars (
            symbol      TEXT,
            trade_date  DATE,
            open        DOUBLE,
            high        DOUBLE,
            low         DOUBLE,
            close       DOUBLE,
            volume      DOUBLE,
            PRIMARY KEY (symbol, trade_date)
        );
        """
    )


# --- Core helper -------------------------------------------------


async def fetch_and_store_symbol(
    symbol: str,
    start: date,
    end: date,
) -> None:
    """
    Fetch [start, end] daily bars for `symbol` from Polygon and upsert into DuckDB.

    This is *idempotent*: if you run it again for the same range,
    INSERT OR REPLACE will just refresh the existing rows.
    """
    symbol_u = symbol.upper()
    print(f"\n=== {symbol_u}: bootstrapping {start} → {end} ===")

    # 1) Fetch from Polygon
    bars: List[PriceBarDTO] = await fetch_polygon_daily_ohlcv(
        symbol=symbol_u,
        start=start,
        end=end,
    )

    if not bars:
        print(f"[{symbol_u}] Polygon returned NO bars for {start} → {end}")
        return

    print(f"[{symbol_u}] fetched {len(bars)} bars from Polygon")

    # 2) Open DB + ensure schema
    conn = get_conn(read_only=False)
    ensure_schema(conn)

    # 3) Upsert rows
    rows = [
        (
            symbol_u,
            b["time"][:10],  # 'YYYY-MM-DD'
            float(b["open"]),
            float(b["high"]),
            float(b["low"]),
            float(b["close"]),
            float(b["volume"]),
        )
        for b in bars
    ]

    conn.executemany(
        """
        INSERT OR REPLACE INTO daily_bars
            (symbol, trade_date, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        rows,
    )

    # 4) Show coverage for this symbol
    min_date, max_date, n = conn.execute(
        """
        SELECT
            MIN(trade_date),
            MAX(trade_date),
            COUNT(*)
        FROM daily_bars
        WHERE symbol = ?
        """,
        [symbol_u],
    ).fetchone()

    conn.close()

    print(
        f"[{symbol_u}] stored {len(rows)} bars; "
        f"coverage now {min_date} → {max_date} ({n} rows total)"
    )


# --- Script entrypoint -------------------------------------------


async def main() -> None:
    """
    Define the bootstrap universe + date ranges here.

    You can edit this list as you go (add more symbols, extend dates, etc.).
    """
    universe = [
        # symbol, start, end
        ("AAPL", date(2020, 1, 1), date(2024, 11, 27)),
        ("MSFT", date(2020, 1, 1), date(2024, 11, 27)),
        # add more as needed:
        # ("NVDA", date(2020, 1, 1), date(2024, 11, 27)),
    ]

    for sym, start, end in universe:
        try:
            await fetch_and_store_symbol(sym, start, end)
        except Exception as e:
            print(f"[{sym}] ERROR during bootstrap: {e}")


if __name__ == "__main__":
    asyncio.run(main())