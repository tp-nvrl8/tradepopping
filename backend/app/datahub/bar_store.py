import os
from datetime import datetime, date, timezone
from typing import List, Optional

import duckdb

from .polygon_client import PriceBarDTO


def _get_duckdb_path() -> str:
    """
    Resolve the DuckDB path from TP_DUCKDB_PATH env var, with a default
    that works inside the backend container.
    """
    path = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb").strip()
    if not path:
        path = "/data/tradepopping.duckdb"
    return path


def _get_connection() -> duckdb.DuckDBPyConnection:
    """
    Return a DuckDB connection to the configured file.
    DuckDB will create the file if it does not exist.
    """
    db_path = _get_duckdb_path()
    conn = duckdb.connect(db_path, read_only=False)
    return conn


def _init_schema() -> None:
    """
    Ensure the daily_bars table (our simple daily OHLCV 'lake') exists.
    """
    conn = _get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_bars (
            symbol TEXT NOT NULL,
            trade_date DATE NOT NULL,
            open DOUBLE,
            high DOUBLE,
            low DOUBLE,
            close DOUBLE,
            volume DOUBLE,
            PRIMARY KEY(symbol, trade_date)
        );
        """
    )
    conn.close()


# Initialize schema at import time
_init_schema()


def upsert_daily_bars(symbol: str, bars: List[PriceBarDTO]) -> None:
    """
    Insert or replace daily bars for a given symbol.
    - trade_date is derived from the bar's "time" (ISO string, UTC)
    - Uses INSERT OR REPLACE semantics on the PRIMARY KEY(symbol, trade_date)
    """
    if not bars:
        return

    conn = _get_connection()
    try:
        rows = []
        for bar in bars:
            # bar["time"] is ISO-8601; parse and take date
            t_str = bar["time"]
            dt = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
            trade_date = dt.date()

            rows.append(
                (
                    symbol.upper(),
                    trade_date,
                    float(bar["open"]),
                    float(bar["high"]),
                    float(bar["low"]),
                    float(bar["close"]),
                    float(bar["volume"]),
                )
            )

        conn.executemany(
            """
            INSERT OR REPLACE INTO daily_bars
            (symbol, trade_date, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            rows,
        )
    finally:
        conn.close()


def read_daily_bars(
    symbol: str,
    start: date,
    end: date,
) -> List[PriceBarDTO]:
    """
    Read daily bars for a symbol in [start, end] inclusive from the lake.
    Returns a list of PriceBarDTO with ISO datetime strings at midnight UTC.
    If no rows exist, returns an empty list.
    """
    conn = _get_connection()
    try:
        symbol_up = symbol.upper()
        result = conn.execute(
            """
            SELECT
                symbol,
                trade_date,
                open,
                high,
                low,
                close,
                volume
            FROM daily_bars
            WHERE symbol = ?
              AND trade_date BETWEEN ? AND ?
            ORDER BY trade_date ASC;
            """,
            [symbol_up, start, end],
        ).fetchall()

        bars: List[PriceBarDTO] = []
        for row in result:
            _, trade_date, o, h, l, c, v = row

            # Convert date -> ISO datetime at midnight UTC
            dt = datetime(
                trade_date.year,
                trade_date.month,
                trade_date.day,
                0,
                0,
                0,
                tzinfo=timezone.utc,
            )

            bars.append(
                PriceBarDTO(
                    time=dt.isoformat(),
                    open=float(o),
                    high=float(h),
                    low=float(l),
                    close=float(c),
                    volume=float(v),
                )
            )

        return bars
    finally:
        conn.close()
