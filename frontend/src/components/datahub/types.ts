// frontend/src/components/datahub/types.ts
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
  status: "ok" | "error";
  has_api_key: boolean;
  message: string;
}

export interface PriceBarDTO {
  time: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// FMP universe ingest result
export interface UniverseIngestResult {
  source: string; // "fmp"
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

// Universe browsing
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
  items: UniverseRow[];
  total_items: number;
  page: number;
  page_size: number;
  total_pages: number;
  sectors: string[];
  exchanges: string[];
  min_market_cap: number | null;
  max_market_cap: number | null;
}

// EODHD ingest + job status
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
  job_state: "running" | "succeeded" | "failed";
}

export interface EodhdJobStatus {
  id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  state: "running" | "succeeded" | "failed";
  requested_start: string;
  requested_end: string;
  universe_symbols_considered: number;
  symbols_attempted: number;
  symbols_succeeded: number;
  symbols_failed: number;
  last_error: string | null;
}