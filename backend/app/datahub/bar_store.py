"""DuckDB-backed cache for daily OHLCV bars."""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import List, TypedDict

import duckdb


class BarStoreError(Exception):
    """Errors raised by the bar store layer."""


class BarRecord(TypedDict):
    symbol: str
    bar_date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    source: str


def _get_connection() -> duckdb.DuckDBPyConnection:
    """Create a DuckDB connection and ensure schema exists."""

    data_dir = os.environ.get("TP_DATA_DIR", "/data")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "tradepopping.duckdb")

    con = duckdb.connect(db_path)
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_bars(
          symbol TEXT,
          bar_date DATE,
          open DOUBLE,
          high DOUBLE,
          low DOUBLE,
          close DOUBLE,
          volume DOUBLE,
          source TEXT,
          ingested_at TIMESTAMP DEFAULT current_timestamp
        );
        """
    )
    return con


def _parse_bar_date(time_value: str) -> date:
    """Parse an ISO timestamp string into a date object."""

    normalized = time_value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).date()


def upsert_daily_bars(symbol: str, bars: List[dict], source: str = "polygon") -> int:
    """Insert or replace daily bars for a symbol within a date range."""

    if not bars:
        return 0

    con = None
    try:
        con = _get_connection()
        con.execute("BEGIN")

        first_date = _parse_bar_date(bars[0]["time"])
        last_date = _parse_bar_date(bars[-1]["time"])

        con.execute(
            """
            DELETE FROM daily_bars
            WHERE symbol = ?
              AND bar_date BETWEEN ? AND ?
              AND source = ?;
            """,
            [symbol, first_date, last_date, source],
        )

        insert_values = [
            (
                symbol,
                _parse_bar_date(bar["time"]),
                bar["open"],
                bar["high"],
                bar["low"],
                bar["close"],
                bar["volume"],
                source,
            )
            for bar in bars
        ]

        con.executemany(
            """
            INSERT INTO daily_bars(symbol, bar_date, open, high, low, close, volume, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """,
            insert_values,
        )

        con.execute("COMMIT")
        return len(insert_values)
    except Exception as exc:  # noqa: BLE001
        try:
            if con is not None:
                con.execute("ROLLBACK")
        except Exception:
            pass
        raise BarStoreError(str(exc)) from exc


def read_daily_bars(symbol: str, start: date, end: date, source: str = "polygon") -> list[dict]:
    """Read cached daily bars from DuckDB."""

    try:
        con = _get_connection()
        result = con.execute(
            """
            SELECT symbol, bar_date, open, high, low, close, volume
            FROM daily_bars
            WHERE symbol = ?
              AND bar_date BETWEEN ? AND ?
              AND source = ?
            ORDER BY bar_date ASC;
            """,
            [symbol, start, end, source],
        ).fetchall()

        return [
            {
                "symbol": row[0],
                "bar_date": row[1],
                "open": row[2],
                "high": row[3],
                "low": row[4],
                "close": row[5],
                "volume": row[6],
            }
            for row in result
        ]
    except Exception as exc:  # noqa: BLE001
        raise BarStoreError(str(exc)) from exc
