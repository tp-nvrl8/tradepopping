# backend/app/datalake/ingest_jobs.py

from __future__ import annotations

import os
import uuid
from datetime import datetime, date
from typing import Any, Dict, Optional

import duckdb

# backend/app/datalake/ingest_jobs.py

TP_DUCKDB_PATH = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb")

TABLE_NAME = "eodhd_ingest_jobs"

def _get_conn() -> duckdb.DuckDBPyConnection:
    """
    Single config for all DuckDB connections in this process.
    """
    return duckdb.connect(TP_DUCKDB_PATH)




def _ensure_schema() -> None:
    """
    Make sure the eodhd_ingest_jobs table exists.
    Safe to call many times.
    """
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
    finally:
        con.close()


# Create table on import
_ensure_schema()


def create_ingest_job(
    *,
    requested_start: date,
    requested_end: date,
    universe_symbols_considered: int,
) -> str:
    """
    Insert a new 'running' ingest job row and return its id.
    """
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
                now,        # started_at = now
                None,       # finished_at
                "running",  # state
                requested_start,
                requested_end,
                int(universe_symbols_considered),
                0,  # symbols_attempted
                0,  # symbols_succeeded
                0,  # symbols_failed
                None,
            ],
        )
    finally:
        con.close()

    return job_id


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
    Update an existing job with final stats + state.
    """
    _ensure_schema()
    now = datetime.utcnow()

    con = _get_conn()
    try:
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
    """
    Return the most recent job as a plain dict, or None if no jobs.
    """
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