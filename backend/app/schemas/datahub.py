# backend/app/schemas/datahub.py
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Data sources (for Dev Tools + DataHub)
# ---------------------------------------------------------------------------

class DataSourceStatus(BaseModel):
    id: str
    name: str
    enabled: bool
    has_api_key: bool
    last_success: Optional[datetime] = None
    last_error: Optional[str] = None


class DataSourceTestResponse(BaseModel):
    id: str
    name: str
    status: str  # "ok" | "error"
    has_api_key: bool
    message: str


# ---------------------------------------------------------------------------
# Polygon OHLCV demo
# ---------------------------------------------------------------------------

class PriceBarDTO(BaseModel):
    time: str  # ISO string
    open: float
    high: float
    low: float
    close: float
    volume: float


# ---------------------------------------------------------------------------
# FMP universe
# ---------------------------------------------------------------------------

class UniverseIngestResult(BaseModel):
    source: str  # "fmp"
    symbols_received: int
    rows_upserted: int


class UniverseStats(BaseModel):
    total_symbols: int
    by_exchange: Dict[str, int]
    by_type: Dict[str, int]
    by_sector: Dict[str, int]
    by_cap_bucket: Dict[str, int]


class UniverseRow(BaseModel):
    symbol: str
    name: str
    exchange: str
    sector: Optional[str]
    industry: Optional[str]
    market_cap: float
    price: float
    is_etf: bool
    is_actively_trading: bool


class UniverseBrowseResponse(BaseModel):
    items: List[UniverseRow]
    total_items: int
    page: int
    page_size: int
    total_pages: int
    sectors: List[str]
    exchanges: List[str]
    min_market_cap: Optional[float]
    max_market_cap: Optional[float]


# ---------------------------------------------------------------------------
# EODHD window ingest + job status
# ---------------------------------------------------------------------------

class EodhdIngestResponse(BaseModel):
    requested_start: str
    requested_end: str
    universe_symbols_considered: int
    symbols_selected: int
    symbols_attempted: int
    symbols_succeeded: int
    symbols_failed: int
    rows_observed_after_ingest: int
    failed_symbols: List[str]
    job_id: str
    job_state: str  # "running" | "succeeded" | "failed"


class EodhdJobStatus(BaseModel):
    id: str
    created_at: str
    started_at: Optional[str]
    finished_at: Optional[str]
    state: str  # "running" | "succeeded" | "failed"
    requested_start: str
    requested_end: str
    universe_symbols_considered: int
    symbols_attempted: int
    symbols_succeeded: int
    symbols_failed: int
    last_error: Optional[str]