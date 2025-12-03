# backend/app/datalake/ingest_jobs.py

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Optional, TypedDict, Dict, Any

import duckdb
from uuid import uuid4

# Re-use the same DuckDB path as the rest of the datalake
TP_DUCKDB_PATH = os.getenv(
    "TP_DUCKDB_PATH",
    "/app/data/tradepopping_bars.duckdb",
)

TABLE_NAME = "eodhd_ingest_jobs"


class IngestJobRow(TypedDict):
  id: str
  created_at: datetime
  started_at: Optional[datetime]
  finished_at: Optional[datetime]
  state: str  # "running" | "succeeded" | "failed"
  requested_start: date
  requested_end: date
  universe_symbols_considered: int
  symbols_attempted: int
  symbols_succeeded: int
  symbols_failed: int
  last_error: Optional[str]


def _get_conn(read_only: bool = False) -> duckdb.DuckDBPyConnection:
  return duckdb.connect(TP_DUCKDB_PATH, read_only=read_only)


def _ensure_schema() -> None:
  """
  Make sure the eodhd_ingest_jobs table exists.
  """
  con = _get_conn(read_only=False)
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


# Ensure table exists on import
_ensure_schema()


def create_ingest_job(
  requested_start: date,
  requested_end: date,
  universe_symbols_considered: int,
) -> str:
  """
  Create a new ingest job row in 'running' state and return its id.
  """
  job_id = uuid4().hex
  now = datetime.utcnow()

  con = _get_conn(read_only=False)
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
      (
        job_id,
        now,
        now,           # started_at
        None,          # finished_at
        "running",
        requested_start,
        requested_end,
        int(universe_symbols_considered),
        0,             # symbols_attempted
        0,             # symbols_succeeded
        0,             # symbols_failed
        None,          # last_error
      ),
    )
  finally:
    con.close()

  return job_id


def update_ingest_job_progress(
  job_id: str,
  symbols_attempted: int,
  symbols_succeeded: int,
  symbols_failed: int,
) -> None:
  """
  Update symbol counters for an existing job. Can be called inside the loop
  if we later want live progress.
  """
  con = _get_conn(read_only=False)
  try:
    con.execute(
      f"""
      UPDATE {TABLE_NAME}
      SET
        symbols_attempted = ?,
        symbols_succeeded = ?,
        symbols_failed    = ?
      WHERE id = ?
      """,
      (
        int(symbols_attempted),
        int(symbols_succeeded),
        int(symbols_failed),
        job_id,
      ),
    )
  finally:
    con.close()


def finalize_ingest_job(
  job_id: str,
  state: str,
  symbols_attempted: int,
  symbols_succeeded: int,
  symbols_failed: int,
  last_error: Optional[str] = None,
) -> None:
  """
  Mark a job as finished (succeeded or failed) and lock in final stats.
  """
  now = datetime.utcnow()
  con = _get_conn(read_only=False)
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
      (
        now,
        state,
        int(symbols_attempted),
        int(symbols_succeeded),
        int(symbols_failed),
        last_error,
        job_id,
      ),
    )
  finally:
    con.close()


def get_latest_ingest_job() -> Optional[IngestJobRow]:
  """
  Return the most recent job (by created_at) or None.
  """
  con = _get_conn(read_only=True)
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

    if not row:
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

    return IngestJobRow(
      id=id_,
      created_at=created_at,
      started_at=started_at,
      finished_at=finished_at,
      state=state,
      requested_start=requested_start,
      requested_end=requested_end,
      universe_symbols_considered=int(universe_symbols_considered),
      symbols_attempted=int(symbols_attempted),
      symbols_succeeded=int(symbols_succeeded),
      symbols_failed=int(symbols_failed),
      last_error=last_error,
    )
  finally:
    con.close()