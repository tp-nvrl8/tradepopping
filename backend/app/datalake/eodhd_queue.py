# backend/app/datalake/eodhd_queue.py

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import duckdb

TP_DUCKDB_PATH = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb")
TABLE = "eodhd_ingest_queue"


def _get_conn() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(TP_DUCKDB_PATH)


def ensure_schema() -> None:
    """
    Ensure the queue table exists and is forward-migrated.

    Adds:
      - created_at TIMESTAMP (for debugging / audit)
    """
    con = _get_conn()
    try:
        con.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TABLE} (
                job_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                window_start DATE NOT NULL,
                window_end DATE NOT NULL,

                state TEXT NOT NULL, -- 'pending' | 'running' | 'succeeded' | 'failed'
                attempts INTEGER NOT NULL,
                created_at TIMESTAMP,
                last_attempt_at TIMESTAMP,
                last_error TEXT,

                PRIMARY KEY (job_id, symbol, window_start, window_end)
            )
            """
        )

        # Forward-migrate: created_at column (if table existed previously without it)
        cols = con.execute(
            f"""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = '{TABLE}'
            """
        ).fetchall()
        col_names = {c[0] for c in cols}

        if "created_at" not in col_names:
            con.execute(f"ALTER TABLE {TABLE} ADD COLUMN created_at TIMESTAMP")
            # backfill best-effort
            con.execute(f"UPDATE {TABLE} SET created_at = NOW() WHERE created_at IS NULL")

    finally:
        con.close()


ensure_schema()


def enqueue(*, job_id: str, items: List[Tuple[str, date, date]]) -> int:
    """
    Insert queue items. Ignores duplicates by primary key.
    """
    if not items:
        return 0

    ensure_schema()
    con = _get_conn()
    try:
        con.execute("BEGIN")
        now = datetime.utcnow()

        for sym, ws, we in items:
            con.execute(
                f"""
                INSERT OR IGNORE INTO {TABLE}
                (job_id, symbol, window_start, window_end, state, attempts, created_at, last_attempt_at, last_error)
                VALUES (?, ?, ?, ?, 'pending', 0, ?, NULL, NULL)
                """,
                [job_id, sym.upper(), ws, we, now],
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

    return len(items)


def reset_stale_running_to_pending(job_id: str, *, stale_minutes: int = 10) -> int:
    """
    If a worker crashed, 'running' items can be stranded.
    Only reset 'running' items that have been running longer than stale_minutes.
    """
    ensure_schema()
    con = _get_conn()
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=int(stale_minutes))

        con.execute(
            f"""
            UPDATE {TABLE}
            SET state = 'pending'
            WHERE job_id = ?
              AND state = 'running'
              AND (
                last_attempt_at IS NULL
                OR last_attempt_at < ?
              )
            """,
            [job_id, cutoff],
        )

        # DuckDB may not reliably return rowcount; return 0 for now
        return 0
    finally:
        con.close()


def pop_next(*, job_id: str, max_attempts: int = 5) -> Optional[Dict[str, object]]:
    """
    Get next pending/failed item and mark it running.

    NOTE: assumes single worker per job (good for now).
    """
    ensure_schema()
    con = _get_conn()
    try:
        con.execute("BEGIN")

        row = con.execute(
            f"""
            SELECT symbol, window_start, window_end, attempts
            FROM {TABLE}
            WHERE job_id = ?
              AND state IN ('pending', 'failed')
              AND attempts < ?
            ORDER BY
              CASE WHEN state = 'pending' THEN 0 ELSE 1 END,
              attempts ASC,
              symbol ASC
            LIMIT 1
            """,
            [job_id, int(max_attempts)],
        ).fetchone()

        if row is None:
            con.execute("COMMIT")
            return None

        symbol, ws, we, attempts = row
        now = datetime.utcnow()

        con.execute(
            f"""
            UPDATE {TABLE}
            SET
              state = 'running',
              attempts = ?,
              last_attempt_at = ?,
              last_error = NULL
            WHERE job_id = ?
              AND symbol = ?
              AND window_start = ?
              AND window_end = ?
            """,
            [int(attempts) + 1, now, job_id, symbol, ws, we],
        )

        con.execute("COMMIT")

        return {
            "symbol": str(symbol),
            "window_start": ws,
            "window_end": we,
            "attempts": int(attempts) + 1,
        }

    except Exception:
        try:
            con.execute("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        con.close()


def mark_succeeded(job_id: str, symbol: str, ws: date, we: date) -> None:
    con = _get_conn()
    try:
        con.execute(
            f"""
            UPDATE {TABLE}
            SET state='succeeded', last_error=NULL
            WHERE job_id = ? AND symbol = ? AND window_start = ? AND window_end = ?
            """,
            [job_id, symbol.upper(), ws, we],
        )
    finally:
        con.close()


def mark_failed(job_id: str, symbol: str, ws: date, we: date, err: str) -> None:
    con = _get_conn()
    try:
        con.execute(
            f"""
            UPDATE {TABLE}
            SET state='failed', last_error=?
            WHERE job_id = ? AND symbol = ? AND window_start = ? AND window_end = ?
            """,
            [err[:500], job_id, symbol.upper(), ws, we],
        )
    finally:
        con.close()


def get_counts(job_id: str) -> Dict[str, int]:
    con = _get_conn()
    try:
        rows = con.execute(
            f"""
            SELECT state, COUNT(*)::INTEGER
            FROM {TABLE}
            WHERE job_id = ?
            GROUP BY state
            """,
            [job_id],
        ).fetchall()
    finally:
        con.close()

    out = {"pending": 0, "running": 0, "succeeded": 0, "failed": 0, "total": 0}
    for state, cnt in rows:
        if state in out:
            out[state] = int(cnt)
        out["total"] += int(cnt)
    return out
