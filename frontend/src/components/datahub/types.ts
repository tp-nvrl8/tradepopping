// frontend/src/components/datahub/types.ts

// ---------- Data sources ----------

export interface DataSourceStatus {
  id: string;
  name: string;
  enabled: boolean;
  has_api_key: boolean;
  last_success: string | null;
  last_error: string | null;
}

export interface DataSourceTestResponse {
  id: string;
  name: string;
  status: "ok" | "error" | string;
  has_api_key: boolean;
  message: string;
}

// ---------- Polygon / OHLCV preview ----------

export interface PriceBarDTO {
  time: string; // ISO date string from backend
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---------- FMP universe ingest + stats ----------

export interface UniverseIngestResult {
  source: string; // e.g. "fmp"
  symbols_received: number;
  rows_upserted: number;
}

export interface UniverseStats {
  total_symbols: number;
  by_exchange: Record<string, number>;
  by_type: Record<string, number>;
  by_sector: Record<string, number>;
  by_cap_bucket: Record<string, number>;
}

// ---------- Universe browser ----------

export interface UniverseRow {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  market_cap: number;
  price: number;
  is_etf: boolean;
  is_actively_trading: boolean;
}

export interface UniverseBrowseResponse {
  total_count: number;
  page: number;
  page_size: number;
  symbols: UniverseRow[];
}
// ---------- EODHD ingest + job status ----------

export type JobState = "running" | "succeeded" | "failed";

export interface EodhdIngestResponse {
  requested_start: string;
  requested_end: string;
  universe_symbols_considered: number;
  symbols_selected: number;
  symbols_attempted: number;
  symbols_succeeded: number;
  symbols_failed: number;
  rows_observed_after_ingest: number;
  failed_symbols: string[];
  job_id: string;
  job_state: JobState;
}

export interface EodhdJobStatus {
  id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  state: JobState;
  requested_start: string;
  requested_end: string;
  universe_symbols_considered: number;
  symbols_attempted: number;
  symbols_succeeded: number;
  symbols_failed: number;
  last_error: string | null;
}