# backend/app/datalake/bar_store.py

"""
Simple DuckDB-backed cache for daily OHLCV bars.

- Stores one hot table: daily_bars
- Stores one cold table: daily_bars_archive
- Keyed by (symbol, trade_date)
- Used as a write-through cache for EODHD daily OHLCV.
"""

from __future__ import annotations

import asyncio
import os
from datetime import date, datetime
from typing import List, Optional, Sequence

import duckdb
from app.datalake.eodhd_client import PriceBarDTO, fetch_eodhd_daily_ohlcv

TP_DUCKDB_PATH: str = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb")

_db_dir = os.path.dirname(TP_DUCKDB_PATH)
if _db_dir:
    os.makedirs(_db_dir, exist_ok=True)


def _get_connection(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(TP_DUCKDB_PATH, read_only=read_only)


def _ensure_schema() -> None:
    """
    Create hot + archive tables if they do not exist.
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

        # Archive table: same schema, separate storage “tier”
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_bars_archive (
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


_ensure_schema()


# ---------------------------------------------------------------------------
# Hot-path API
# ---------------------------------------------------------------------------


def upsert_daily_bars(symbol: str, bars: Sequence[PriceBarDTO]) -> int:
    if not bars:
        return 0

    symbol = symbol.upper()
    records = []

    for b in bars:
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
    _ensure_schema()
    bars = await fetch_eodhd_daily_ohlcv(symbol=symbol, start=start, end=end)
    upsert_daily_bars(symbol, bars)


# ---------------------------------------------------------------------------
# NEW: Archiving / retention
# ---------------------------------------------------------------------------


def archive_old_daily_bars(*, cutoff_date: date) -> Dict[str, int]:
    """
    Move rows older than cutoff_date from daily_bars -> daily_bars_archive.

    - Archives rows with trade_date < cutoff_date
    - Uses INSERT OR REPLACE to be idempotent
    - Deletes from hot table after copy
    """
    _ensure_schema()

    con = _get_connection(read_only=False)
    try:
        # Count what will be moved
        to_move = con.execute(
            "SELECT COUNT(*) FROM daily_bars WHERE trade_date < ?",
            [cutoff_date],
        ).fetchone()[0]
        to_move = int(to_move or 0)

        if to_move == 0:
            return {"archived": 0, "deleted_from_hot": 0}

        con.execute("BEGIN")

        # Copy to archive
        con.execute(
            """
            INSERT OR REPLACE INTO daily_bars_archive
            SELECT *
            FROM daily_bars
            WHERE trade_date < ?
            """,
            [cutoff_date],
        )

        # Delete from hot
        con.execute(
            "DELETE FROM daily_bars WHERE trade_date < ?",
            [cutoff_date],
        )

        con.execute("COMMIT")
        return {"archived": to_move, "deleted_from_hot": to_move}

    except Exception:
        try:
            con.execute("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        con.close()
