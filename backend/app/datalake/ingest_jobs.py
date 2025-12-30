# backend/app/datalake/ingest_jobs.py

from __future__ import annotations

import os
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

import duckdb

TP_DUCKDB_PATH = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb")

TABLE_NAME = "eodhd_ingest_jobs"
ITEMS_TABLE = "eodhd_ingest_job_items"

ItemState = Literal["pending", "running", "succeeded", "failed"]


def _get_conn() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(TP_DUCKDB_PATH)


def _ensure_schema() -> None:
    con = _get_conn()
    try:
        con.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
                id TEXT PRIMARY KEY,
                created_at TIMESTAMP NOT NULL,
                started_at TIMESTAMP,
                finished_at TIMESTAMP,
                state TEXT NOT NULL, -- 'running' | 'succeeded' | 'failed'

                requested_start DATE NOT NULL,
                requested_end DATE NOT NULL,
                universe_symbols_considered INTEGER NOT NULL,

                symbols_attempted INTEGER NOT NULL,
                symbols_succeeded INTEGER NOT NULL,
                symbols_failed INTEGER NOT NULL,

                last_error TEXT
            )
            """
        )

        # NEW: per-symbol items so we can resume + show real progress
        con.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {ITEMS_TABLE} (
                job_id TEXT NOT NULL,
                symbol TEXT NOT NULL,

                state TEXT NOT NULL, -- 'pending' | 'running' | 'succeeded' | 'failed'
                attempts INTEGER NOT NULL,
                last_error TEXT,

                updated_at TIMESTAMP NOT NULL,

                PRIMARY KEY (job_id, symbol)
            )
            """
        )
    finally:
        con.close()


_ensure_schema()


# -------------------------
# Jobs (existing + fixed)
# -------------------------


def create_ingest_job(
    *,
    requested_start: date,
    requested_end: date,
    universe_symbols_considered: int,
    symbols_attempted: int = 0,
    symbols_succeeded: int = 0,
    symbols_failed: int = 0,
    last_error: Optional[str] = None,
) -> str:
    _ensure_schema()
    job_id = str(uuid.uuid4())
    now = datetime.utcnow()

    con = _get_conn()
    try:
        con.execute(
            f"""
            INSERT INTO {TABLE_NAME} (
                id,
                created_at,
                started_at,
                finished_at,
                state,
                requested_start,
                requested_end,
                universe_symbols_considered,
                symbols_attempted,
                symbols_succeeded,
                symbols_failed,
                last_error
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                job_id,
                now,
                now,
                None,
                "running",
                requested_start,
                requested_end,
                int(universe_symbols_considered),
                int(symbols_attempted),
                int(symbols_succeeded),
                int(symbols_failed),
                last_error,
            ],
        )
    finally:
        con.close()

    return job_id


def update_ingest_job_progress(
    job_id: str,
    *,
    state: Optional[str] = None,  # usually "running"
    universe_symbols_considered: Optional[int] = None,
    symbols_attempted: int,
    symbols_succeeded: int,
    symbols_failed: int,
    last_error: Optional[str] = None,
) -> None:
    """
    Update counters while job is still running.
    Does NOT set finished_at.
    """
    _ensure_schema()

    sets = []
    params = []

    if state is not None:
        sets.append("state = ?")
        params.append(state)

    if universe_symbols_considered is not None:
        sets.append("universe_symbols_considered = ?")
        params.append(int(universe_symbols_considered))

    sets.extend(
        [
            "symbols_attempted = ?",
            "symbols_succeeded = ?",
            "symbols_failed = ?",
            "last_error = ?",
        ]
    )
    params.extend(
        [
            int(symbols_attempted),
            int(symbols_succeeded),
            int(symbols_failed),
            last_error,
        ]
    )

    params.append(job_id)

    con = _get_conn()
    try:
        con.execute(
            f"""
            UPDATE {TABLE_NAME}
            SET {", ".join(sets)}
            WHERE id = ?
            """,
            params,
        )
    finally:
        con.close()


def update_ingest_job(
    job_id: str,
    *,
    state: str,
    symbols_attempted: int,
    symbols_succeeded: int,
    symbols_failed: int,
    last_error: Optional[str] = None,
) -> None:
    """
    Final update (or running update) for a job.

    IMPORTANT FIX:
    - finished_at is ONLY set when state != 'running'
    """
    _ensure_schema()
    now = datetime.utcnow()

    con = _get_conn()
    try:
        if state == "running":
            con.execute(
                f"""
                UPDATE {TABLE_NAME}
                SET
                    state = ?,
                    symbols_attempted = ?,
                    symbols_succeeded = ?,
                    symbols_failed = ?,
                    last_error = ?
                WHERE id = ?
                """,
                [
                    state,
                    int(symbols_attempted),
                    int(symbols_succeeded),
                    int(symbols_failed),
                    last_error,
                    job_id,
                ],
            )
        else:
            con.execute(
                f"""
                UPDATE {TABLE_NAME}
                SET
                    finished_at = ?,
                    state = ?,
                    symbols_attempted = ?,
                    symbols_succeeded = ?,
                    symbols_failed = ?,
                    last_error = ?
                WHERE id = ?
                """,
                [
                    now,
                    state,
                    int(symbols_attempted),
                    int(symbols_succeeded),
                    int(symbols_failed),
                    last_error,
                    job_id,
                ],
            )
    finally:
        con.close()


def get_latest_ingest_job() -> Optional[Dict[str, Any]]:
    _ensure_schema()
    con = _get_conn()
    try:
        row = con.execute(
            f"""
            SELECT
                id,
                created_at,
                started_at,
                finished_at,
                state,
                requested_start,
                requested_end,
                universe_symbols_considered,
                symbols_attempted,
                symbols_succeeded,
                symbols_failed,
                last_error
            FROM {TABLE_NAME}
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
    finally:
        con.close()

    return _row_to_job_dict(row)


def get_ingest_job(job_id: str) -> Optional[Dict[str, Any]]:
    _ensure_schema()
    con = _get_conn()
    try:
        row = con.execute(
            f"""
            SELECT
                id,
                created_at,
                started_at,
                finished_at,
                state,
                requested_start,
                requested_end,
                universe_symbols_considered,
                symbols_attempted,
                symbols_succeeded,
                symbols_failed,
                last_error
            FROM {TABLE_NAME}
            WHERE id = ?
            """,
            [job_id],
        ).fetchone()
    finally:
        con.close()

    return _row_to_job_dict(row)


def _row_to_job_dict(row) -> Optional[Dict[str, Any]]:
    if row is None:
        return None

    (
        id_,
        created_at,
        started_at,
        finished_at,
        state,
        requested_start,
        requested_end,
        universe_symbols_considered,
        symbols_attempted,
        symbols_succeeded,
        symbols_failed,
        last_error,
    ) = row

    def _iso(dt):
        return dt.isoformat() if dt is not None else None

    return {
        "id": id_,
        "created_at": _iso(created_at),
        "started_at": _iso(started_at),
        "finished_at": _iso(finished_at),
        "state": state,
        "requested_start": requested_start.isoformat(),
        "requested_end": requested_end.isoformat(),
        "universe_symbols_considered": int(universe_symbols_considered),
        "symbols_attempted": int(symbols_attempted),
        "symbols_succeeded": int(symbols_succeeded),
        "symbols_failed": int(symbols_failed),
        "last_error": last_error,
    }


# -------------------------
# NEW: per-symbol items
# -------------------------


def create_job_items(job_id: str, symbols: List[str]) -> None:
    """
    Initialize job items (pending) for each symbol. Safe if called once.
    """
    _ensure_schema()
    now = datetime.utcnow()

    records = []
    for s in symbols:
        records.append((job_id, s.upper(), "pending", 0, None, now))

    con = _get_conn()
    try:
        con.execute("BEGIN")
        con.executemany(
            f"""
            INSERT OR IGNORE INTO {ITEMS_TABLE}
                (job_id, symbol, state, attempts, last_error, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
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


def set_item_state(
    job_id: str,
    symbol: str,
    *,
    state: ItemState,
    inc_attempt: bool = False,
    last_error: Optional[str] = None,
) -> None:
    _ensure_schema()
    now = datetime.utcnow()

    con = _get_conn()
    try:
        if inc_attempt:
            con.execute(
                f"""
                UPDATE {ITEMS_TABLE}
                SET
                    state = ?,
                    attempts = attempts + 1,
                    last_error = ?,
                    updated_at = ?
                WHERE job_id = ? AND symbol = ?
                """,
                [state, last_error, now, job_id, symbol.upper()],
            )
        else:
            con.execute(
                f"""
                UPDATE {ITEMS_TABLE}
                SET
                    state = ?,
                    last_error = ?,
                    updated_at = ?
                WHERE job_id = ? AND symbol = ?
                """,
                [state, last_error, now, job_id, symbol.upper()],
            )
    finally:
        con.close()


def get_job_progress(job_id: str) -> Dict[str, Any]:
    """
    Returns pending/running/succeeded/failed counts + pct.
    """
    _ensure_schema()
    con = _get_conn()
    try:
        totals = con.execute(
            f"""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN state = 'running' THEN 1 ELSE 0 END) AS running,
                SUM(CASE WHEN state = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
                SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) AS failed
            FROM {ITEMS_TABLE}
            WHERE job_id = ?
            """,
            [job_id],
        ).fetchone()
    finally:
        con.close()

    total, pending, running, succeeded, failed = [int(x or 0) for x in totals]
    done = succeeded + failed
    pct = (done / total * 100.0) if total > 0 else 0.0

    job = get_ingest_job(job_id)
    state = job["state"] if job else "unknown"

    return {
        "job_id": job_id,
        "state": state,
        "total": total,
        "pending": pending,
        "running": running,
        "succeeded": succeeded,
        "failed": failed,
        "pct_complete": pct,
    }


def list_symbols_for_resume(job_id: str) -> List[str]:
    """
    Resume logic: retry only pending + failed.
    """
    _ensure_schema()
    con = _get_conn()
    try:
        rows = con.execute(
            f"""
            SELECT symbol
            FROM {ITEMS_TABLE}
            WHERE job_id = ?
              AND state IN ('pending','failed')
            ORDER BY symbol
            """,
            [job_id],
        ).fetchall()
    finally:
        con.close()

    return [r[0] for r in rows]
