import React, { useEffect, useState, ReactNode } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";
import { apiClient } from "../api";

// iPad-friendly error surface (avoids blank white screen)
window.onerror = function (msg) {
  document.body.innerHTML =
    "<pre style='color:red;font-size:20px;padding:20px;white-space:pre-wrap'>" +
    msg +
    "</pre>";
};

interface DataSourceStatus {
  id: string;
  name: string;
  enabled: boolean;
  has_api_key: boolean;
  last_success: string | null;
  last_error: string | null;
}

interface DataSourceTestResponse {
  id: string;
  name: string;
  status: string; // "ok" | "error"
  has_api_key: boolean;
  message: string;
}

interface PriceBarDTO {
  time: string; // ISO from backend
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // backend MAY include more optional fields (vwap, turnover, etc.)
  // which we just ignore in the UI unless we choose to show them.
}

interface UniverseIngestResult {
  source: string; // "fmp"
  symbols_received: number;
  rows_upserted: number;
}

interface UniverseStats {
  total_symbols: number;
  by_exchange: Record<string, number>;
  by_type: Record<string, number>;
  by_sector: Record<string, number>;
  by_cap_bucket: Record<string, number>;
}

// NEW: Universe browser row + page
interface UniverseRow {
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

interface UniverseBrowseResponse {
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

interface EodhdIngestResponse {
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

interface EodhdJobStatus {
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

// --- Collapsible section helper with localStorage persistence ---

interface CollapsibleSectionProps {
  storageKey: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  storageKey,
  title,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "true") return true;
      if (raw === "false") return false;
      return defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </span>
        <span className="text-slate-400 text-xs font-mono">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </section>
  );
};

// Simple sparkline renderer for close prices only
const PriceSparkline: React.FC<{ bars: PriceBarDTO[] }> = ({ bars }) => {
  if (!bars.length) {
    return (
      <div className="text-[10px] text-slate-500">No data to preview.</div>
    );
  }

  const width = 220;
  const height = 60;
  const padding = 6;

  const closes = bars.map((b) => b.close);
  let min = Math.min(...closes);
  let max = Math.max(...closes);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const scaleX = (index: number, length: number) =>
    length <= 1
      ? padding + usableWidth / 2
      : padding + (index / (length - 1)) * usableWidth;

  const scaleY = (value: number) => {
    const t = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, t));
    return padding + (1 - clamped) * usableHeight;
  };

  let d = "";
  for (let i = 0; i < closes.length; i++) {
    const x = scaleX(i, closes.length);
    const y = scaleY(closes[i]);
    d += d ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x={0} y={0} width={width} height={height} rx={6} fill="#020617" />
      <path d={d} fill="none" stroke="#38bdf8" strokeWidth={1.6} />
      <rect
        x={padding}
        y={padding}
        width={usableWidth}
        height={usableHeight}
        fill="none"
        stroke="#0f172a"
        strokeWidth={0.9}
        rx={4}
      />
    </svg>
  );
};

const DataHubPage: React.FC = () => {
  const tokens = useUiScopedTokens(["global", "page:datahub"]);

  // --- Data source status ---
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, DataSourceTestResponse | null>
  >({});

  // --- Polygon OHLCV demo (live from Polygon) ---
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2024-01-02");
  const [end, setEnd] = useState("2024-01-31");
  const [bars, setBars] = useState<PriceBarDTO[]>([]);
  const [barsLoading, setBarsLoading] = useState(false);
  const [barsError, setBarsError] = useState<string | null>(null);

  // --- Cached daily bars (from DuckDB, no external call) ---
  const [cachedSymbol, setCachedSymbol] = useState("AAPL");
  const [cachedStart, setCachedStart] = useState("2024-01-02");
  const [cachedEnd, setCachedEnd] = useState("2024-01-31");
  const [cachedBars, setCachedBars] = useState<PriceBarDTO[]>([]);
  const [cachedLoading, setCachedLoading] = useState(false);
  const [cachedError, setCachedError] = useState<string | null>(null);

  // --- FMP universe ingest + stats ---
  const [ingestingUniverse, setIngestingUniverse] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] =
    useState<UniverseIngestResult | null>(null);

  const [universeStats, setUniverseStats] = useState<UniverseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // FMP universe filters (for screener)
  const [fmpMinCap, setFmpMinCap] = useState("50000000");
  const [fmpMaxCap, setFmpMaxCap] = useState("");
  const [fmpExchanges, setFmpExchanges] = useState("NYSE,NASDAQ");
  const [fmpIncludeEtfs, setFmpIncludeEtfs] = useState(false);
  const [fmpActiveOnly, setFmpActiveOnly] = useState(true);
  const [fmpLimit, setFmpLimit] = useState("5000");

  // --- NEW: Universe browser UI state ---
  const [browserPage, setBrowserPage] = useState(1);
  const [browserPageSize, setBrowserPageSize] = useState(50);
  const [browserSearch, setBrowserSearch] = useState("");
  const [browserSector, setBrowserSector] = useState<string>("");
  const [browserMinCap, setBrowserMinCap] = useState("");
  const [browserMaxCap, setBrowserMaxCap] = useState("");
  const [browserSortBy, setBrowserSortBy] =
    useState<"symbol" | "name" | "sector" | "exchange" | "market_cap" | "price">(
      "symbol"
    );
  const [browserSortDir, setBrowserSortDir] =
    useState<"asc" | "desc">("asc");
  const [browserData, setBrowserData] =
    useState<UniverseBrowseResponse | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);

  // --- EODHD window ingest ---
  const [eodStart, setEodStart] = useState("2024-01-02");
  const [eodEnd, setEodEnd] = useState("2024-01-31");
  const [eodMinCap, setEodMinCap] = useState("50000000"); // 50M
  const [eodMaxCap, setEodMaxCap] = useState("");
  const [eodExchanges, setEodExchanges] = useState("NYSE,NASDAQ");
  const [eodIncludeEtfs, setEodIncludeEtfs] = useState(false);
  const [eodActiveOnly, setEodActiveOnly] = useState(true);
  const [eodMaxSymbols, setEodMaxSymbols] = useState("25");

  const [eodLoading, setEodLoading] = useState(false);
  const [eodError, setEodError] = useState<string | null>(null);
  const [eodResult, setEodResult] = useState<EodhdIngestResponse | null>(null);

  // Background-style job status for EODHD ingest
  const [eodJobStatus, setEodJobStatus] = useState<EodhdJobStatus | null>(null);
  const [eodJobRefreshing, setEodJobRefreshing] = useState(false);

  // --- On mount: load sources + universe stats + initial browser page ---
  useEffect(() => {
    const loadSources = async () => {
      try {
        setSourcesLoading(true);
        setSourcesError(null);
        const res = await apiClient.get<DataSourceStatus[]>("/data/sources");
        setSources(res.data);
      } catch (err) {
        console.error("Failed to load data sources", err);
        setSourcesError("Could not load data sources. Check backend logs.");
      } finally {
        setSourcesLoading(false);
      }
    };

    loadSources();
    void fetchUniverseStats();
    void fetchUniverseBrowse(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Handlers ---

  const handleTestSource = async (sourceId: string) => {
    setTestingSourceId(sourceId);
    setTestResults((prev) => ({ ...prev, [sourceId]: null }));
    try {
      const res = await apiClient.post<DataSourceTestResponse>(
        "/data/sources/test",
        { source_id: sourceId }
      );
      setTestResults((prev) => ({ ...prev, [sourceId]: res.data }));
    } catch (err) {
      console.error(`Failed to test source ${sourceId}`, err);
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: {
          id: sourceId,
          name: sourceId,
          status: "error",
          has_api_key: false,
          message: "Test call failed. Check console / backend.",
        },
      }));
    } finally {
      setTestingSourceId(null);
    }
  };

  const handleFetchBars = async () => {
    if (!symbol.trim()) return;
    setBars([]);
    setBarsError(null);
    setBarsLoading(true);

    try {
      const res = await apiClient.get<PriceBarDTO[]>(
        "/datahub/polygon/daily-ohlcv",
        {
          params: {
            symbol: symbol.trim().toUpperCase(),
            start,
            end,
          },
        }
      );
      setBars(res.data);
    } catch (err) {
      console.error("Failed to fetch polygon OHLCV", err);
      setBarsError("Failed to fetch OHLCV from Polygon. Check backend logs.");
    } finally {
      setBarsLoading(false);
    }
  };

  const handleFetchCachedBars = async () => {
    if (!cachedSymbol.trim()) return;
    setCachedBars([]);
    setCachedError(null);
    setCachedLoading(true);

    try {
      const res = await apiClient.get<PriceBarDTO[]>(
        "/datalake/bars/cached",
        {
          params: {
            symbol: cachedSymbol.trim().toUpperCase(),
            start: cachedStart,
            end: cachedEnd,
          },
        }
      );
      setCachedBars(res.data);
    } catch (err) {
      console.error("Failed to fetch cached bars", err);
      setCachedError(
        "Failed to read cached bars from DuckDB. Did you ingest this symbol?"
      );
    } finally {
      setCachedLoading(false);
    }
  };

  const fetchUniverseStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const res = await apiClient.get<UniverseStats>("/datalake/universe/stats");
      setUniverseStats(res.data);
    } catch (err) {
      console.error("Failed to load universe stats", err);
      setStatsError("Failed to load universe stats. Check backend logs.");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleIngestUniverse = async () => {
    setIngestingUniverse(true);
    setIngestError(null);
    setIngestResult(null);
    try {
      const minCap = parseInt(fmpMinCap || "0", 10);
      const maxCap =
        fmpMaxCap.trim().length > 0 ? parseInt(fmpMaxCap, 10) : null;
      const limit = parseInt(fmpLimit || "0", 10) || 0;

      const exchangesParam = fmpExchanges
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .join(",");

      const params: Record<string, any> = {
        min_market_cap: minCap,
        exchanges: exchangesParam,
        limit,
        include_etfs: fmpIncludeEtfs,
        active_only: fmpActiveOnly,
      };
      if (maxCap !== null) {
        params.max_market_cap = maxCap;
      }

      const res = await apiClient.post<UniverseIngestResult>(
        "/datalake/fmp/universe/ingest",
        {},
        { params }
      );
      setIngestResult(res.data);
      await fetchUniverseStats();
      // Refresh browser view as well
      await fetchUniverseBrowse(1);
    } catch (err) {
      console.error("Failed to ingest FMP universe", err);
      setIngestError("Failed to ingest symbol universe from FMP.");
    } finally {
      setIngestingUniverse(false);
    }
  };

  // --- Universe browser fetcher ---

  const fetchUniverseBrowse = async (pageOverride?: number) => {
    const pageToLoad = pageOverride ?? browserPage;
    setBrowserLoading(true);
    setBrowserError(null);

    try {
      const params: Record<string, any> = {
        page: pageToLoad,
        page_size: browserPageSize,
        sort_by: browserSortBy,
        sort_dir: browserSortDir,
      };

      if (browserSearch.trim()) {
        params.search = browserSearch.trim();
      }
      if (browserSector) {
        params.sector = browserSector;
      }
      if (browserMinCap.trim()) {
        params.min_market_cap = parseInt(
          browserMinCap.replace(/,/g, ""),
          10
        );
      }
      if (browserMaxCap.trim()) {
        params.max_market_cap = parseInt(
          browserMaxCap.replace(/,/g, ""),
          10
        );
      }

      const res = await apiClient.get<UniverseBrowseResponse>(
        "/datalake/universe/browse",
        { params }
      );
      setBrowserData(res.data);
      setBrowserPage(res.data.page);
    } catch (err) {
      console.error("Failed to load universe browser page", err);
      setBrowserError(
        "Failed to load universe browser. Check backend logs."
      );
    } finally {
      setBrowserLoading(false);
    }
  };

  const refreshEodJobStatus = async () => {
    setEodJobRefreshing(true);
    try {
      const res = await apiClient.get<EodhdJobStatus>(
        "/datalake/eodhd/jobs/latest"
      );
      setEodJobStatus(res.data);
    } catch (err) {
      console.error("Failed to refresh EODHD job status", err);
    } finally {
      setEodJobRefreshing(false);
    }
  };

  const handleIngestEodhdWindow = async () => {
    setEodLoading(true);
    setEodError(null);
    setEodResult(null);

    try {
      const minCap = parseInt(eodMinCap || "0", 10);
      const maxCap =
        eodMaxCap.trim().length > 0 ? parseInt(eodMaxCap, 10) : null;
      const maxSymbols = parseInt(eodMaxSymbols || "0", 10) || 0;

      const payload = {
        start: eodStart,
        end: eodEnd,
        min_market_cap: minCap,
        max_market_cap: maxCap,
        exchanges: eodExchanges
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        include_etfs: eodIncludeEtfs,
        active_only: eodActiveOnly,
        max_symbols: maxSymbols,
      };

      const res = await apiClient.post<EodhdIngestResponse>(
        "/datalake/eodhd/ingest-window",
        payload
      );
      setEodResult(res.data);

      // Snapshot job info from the response
      setEodJobStatus((prev) => ({
        id: res.data.job_id,
        created_at: prev?.created_at ?? new Date().toISOString(),
        started_at: prev?.started_at ?? new Date().toISOString(),
        finished_at: new Date().toISOString(),
        state: res.data.job_state,
        requested_start: res.data.requested_start,
        requested_end: res.data.requested_end,
        universe_symbols_considered: res.data.universe_symbols_considered,
        symbols_attempted: res.data.symbols_attempted,
        symbols_succeeded: res.data.symbols_succeeded,
        symbols_failed: res.data.symbols_failed,
        last_error:
          res.data.symbols_failed > 0
            ? "Some symbols failed during ingest."
            : null,
      }));

      // Also sync from backend registry (most recent job)
      void refreshEodJobStatus();
    } catch (err) {
      console.error("Failed to ingest EODHD window", err);
      setEodError(
        "Failed to ingest EODHD bars for that window. Check backend logs."
      );
    } finally {
      setEodLoading(false);
    }
  };

  // --- Render ---

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"
      style={{
        background: tokens.surface,
        color: tokens.textPrimary,
      }}
    >
      {/* Header */}
      <header
        className="border-b border-slate-800 px-4 py-3 flex items-center justify-between"
        style={{ borderColor: tokens.border }}
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Data Hub</h1>
          <p className="text-xs text-slate-400">
            Connect data sources, test API keys, ingest universes, browse
            symbols, and inspect raw OHLCV windows.
          </p>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col overflow-y-auto items-center">
          <div className="w-full max-w-5xl px-4 py-4 space-y-4">
            {/* Data sources overview */}
            <CollapsibleSection
              storageKey="tp_datahub_section_sources"
              title="Data Sources"
              defaultOpen={true}
            >
              <div className="flex items-center justify-between mb-1">
                {sourcesLoading && (
                  <span className="text-[11px] text-slate-500">Loading...</span>
                )}
              </div>

              {sourcesError ? (
                <div className="text-[11px] text-amber-400">
                  {sourcesError}
                </div>
              ) : sources.length === 0 ? (
                <div className="text-[11px] text-slate-500">
                  No data sources reported. Check backend configuration.
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((src) => {
                    const test = testResults[src.id] ?? null;
                    const isTesting = testingSourceId === src.id;

                    return (
                      <div
                        key={src.id}
                        className="text-[11px] border-b border-slate-800/40 pb-2 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-200">
                              {src.name}
                            </div>
                            <div className="text-slate-500">
                              Env key present:{" "}
                              <span className="font-mono">
                                {src.has_api_key ? "yes" : "no"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div
                              className={
                                src.enabled
                                  ? "inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/60"
                                  : "inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600/60"
                              }
                            >
                              {src.enabled ? "ENABLED" : "DISABLED"}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTestSource(src.id)}
                              disabled={isTesting || !src.has_api_key}
                              className="px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold"
                            >
                              {isTesting ? "Testing…" : "Test source"}
                            </button>
                          </div>
                        </div>

                        {test && (
                          <div className="mt-1 flex items-center gap-2 text-[10px]">
                            <span
                              className={
                                test.status === "ok"
                                  ? "px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/60"
                                  : "px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/60"
                              }
                            >
                              {test.status.toUpperCase()}
                            </span>
                            <span className="text-slate-300">
                              {test.message}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleSection>

            {/* FMP Universe ingest + stats */}
            <CollapsibleSection
              storageKey="tp_datahub_section_fmp_universe"
              title="FMP Symbol Universe → DuckDB"
              defaultOpen={true}
            >
              <p className="text-[11px] text-slate-400 mb-2">
                Pull the FMP symbol universe (with market cap, sector,
                industry) into the data lake using the company screener
                filters below.
              </p>

              {/* FMP screener controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] mb-2">
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Min market cap (USD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={fmpMinCap}
                    onChange={(e) =>
                      setFmpMinCap(e.target.value.replace(/,/g, ""))
                    }
                    placeholder="50000000"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Max market cap (optional)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={fmpMaxCap}
                    onChange={(e) =>
                      setFmpMaxCap(e.target.value.replace(/,/g, ""))
                    }
                    placeholder=""
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Exchanges (comma-separated)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={fmpExchanges}
                    onChange={(e) => setFmpExchanges(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Max symbols (limit)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={fmpLimit}
                    onChange={(e) =>
                      setFmpLimit(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="5000"
                  />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={fmpIncludeEtfs}
                      onChange={(e) => setFmpIncludeEtfs(e.target.checked)}
                    />
                    <span className="text-[11px]">Include ETFs</span>
                  </label>
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={fmpActiveOnly}
                      onChange={(e) => setFmpActiveOnly(e.target.checked)}
                    />
                    <span className="text-[11px]">Active only</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleIngestUniverse}
                  disabled={ingestingUniverse}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
                >
                  {ingestingUniverse ? "Ingesting…" : "Ingest FMP Universe"}
                </button>
              </div>

              {ingestError && (
                <div className="text-[11px] text-amber-400 mt-1">
                  {ingestError}
                </div>
              )}

              {ingestResult && (
                <div className="mt-1 text-[11px] text-slate-300">
                  <div>
                    Source:{" "}
                    <span className="font-semibold uppercase">
                      {ingestResult.source}
                    </span>
                  </div>
                  <div>
                    Symbols received:{" "}
                    <span className="font-semibold">
                      {ingestResult.symbols_received}
                    </span>
                  </div>
                  <div>
                    Rows upserted:{" "}
                    <span className="font-semibold">
                      {ingestResult.rows_upserted}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-2 border-t border-slate-800 pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Universe Stats
                  </span>
                  <button
                    type="button"
                    onClick={fetchUniverseStats}
                    disabled={statsLoading}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-[10px]"
                  >
                    {statsLoading ? "Refreshing…" : "Refresh stats"}
                  </button>
                </div>
                {statsError && (
                  <div className="text-[11px] text-amber-400">{statsError}</div>
                )}
                {universeStats && !statsError && (
                  <div className="text-[11px] text-slate-300 space-y-2">
                    <div>
                      Total symbols:{" "}
                      <span className="font-semibold">
                        {universeStats.total_symbols}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-6">
                      {/* Exchange breakdown */}
                      <div>
                        <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                          By exchange
                        </div>
                        <ul className="space-y-0.5">
                          {Object.entries(universeStats.by_exchange).map(
                            ([exch, count]) => (
                              <li key={exch}>
                                <span className="font-mono text-slate-400">
                                  {exch}:
                                </span>{" "}
                                <span className="font-semibold">{count}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      {/* Type breakdown */}
                      <div>
                        <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                          By type
                        </div>
                        <ul className="space-y-0.5">
                          {Object.entries(universeStats.by_type).map(
                            ([t, count]) => (
                              <li key={t}>
                                <span className="font-mono text-slate-400">
                                  {t}:
                                </span>{" "}
                                <span className="font-semibold">{count}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      {/* Sector breakdown */}
                      <div>
                        <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                          By sector
                        </div>
                        <ul className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                          {Object.entries(universeStats.by_sector).map(
                            ([sector, count]) => (
                              <li key={sector}>
                                <span className="font-mono text-slate-400">
                                  {sector}:
                                </span>{" "}
                                <span className="font-semibold">{count}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      {/* Cap buckets */}
                      <div>
                        <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                          By cap bucket
                        </div>
                        <ul className="space-y-0.5">
                          {Object.entries(universeStats.by_cap_bucket).map(
                            ([bucket, count]) => (
                              <li key={bucket}>
                                <span className="font-mono text-slate-400">
                                  {bucket}:
                                </span>{" "}
                                <span className="font-semibold">{count}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* NEW: Universe Browser */}
            <CollapsibleSection
              storageKey="tp_datahub_section_universe_browser"
              title="Universe Browser (symbols & caps)"
              defaultOpen={true}
            >
              <p className="text-[11px] text-slate-400 mb-2">
                Browse the stored symbol universe with paging, search, sector
                and cap filters. This is your “truth table” for what&apos;s
                tradable in TradePopping.
              </p>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] mb-2">
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Search</label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={browserSearch}
                    onChange={(e) => setBrowserSearch(e.target.value)}
                    placeholder="Symbol or name"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Sector</label>
                  <select
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={browserSector}
                    onChange={(e) => setBrowserSector(e.target.value)}
                  >
                    <option value="">All</option>
                    {browserData?.sectors.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Min market cap (USD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={browserMinCap}
                    onChange={(e) =>
                      setBrowserMinCap(e.target.value.replace(/,/g, ""))
                    }
                    placeholder={
                      browserData?.min_market_cap
                        ? Math.round(browserData.min_market_cap).toString()
                        : ""
                    }
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Max market cap (USD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={browserMaxCap}
                    onChange={(e) =>
                      setBrowserMaxCap(e.target.value.replace(/,/g, ""))
                    }
                    placeholder={
                      browserData?.max_market_cap
                        ? Math.round(browserData.max_market_cap).toString()
                        : ""
                    }
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Sort by</label>
                  <select
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={browserSortBy}
                    onChange={(e) =>
                      setBrowserSortBy(
                        e.target.value as
                          | "symbol"
                          | "name"
                          | "sector"
                          | "exchange"
                          | "market_cap"
                          | "price"
                      )
                    }
                  >
                    <option value="symbol">Symbol</option>
                    <option value="name">Name</option>
                    <option value="sector">Sector</option>
                    <option value="exchange">Exchange</option>
                    <option value="market_cap">Market cap</option>
                    <option value="price">Price</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Sort direction</label>
                  <select
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={browserSortDir}
                    onChange={(e) =>
                      setBrowserSortDir(e.target.value as "asc" | "desc")
                    }
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Rows per page</label>
                  <select
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={browserPageSize}
                    onChange={(e) =>
                      setBrowserPageSize(parseInt(e.target.value, 10))
                    }
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => fetchUniverseBrowse(1)}
                  disabled={browserLoading}
                  className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
                >
                  {browserLoading ? "Loading…" : "Apply filters"}
                </button>
                {browserData && (
                  <span className="text-[11px] text-slate-400">
                    {browserData.total_items.toLocaleString()} symbols • page{" "}
                    <span className="font-mono">
                      {browserData.page}/{browserData.total_pages}
                    </span>
                  </span>
                )}
              </div>

              {browserError && (
                <div className="text-[11px] text-amber-400 mb-1">
                  {browserError}
                </div>
              )}

              {browserData && browserData.items.length > 0 && (
                <>
                  <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-md">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-900/80 sticky top-0 z-10">
                        <tr className="text-left text-slate-300">
                          <th className="px-2 py-1 border-b border-slate-800">
                            Symbol
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800">
                            Name
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800">
                            Exchange
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800">
                            Sector
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Market cap
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Price
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800">
                            Type
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800">
                            Active
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {browserData.items.map((row) => (
                          <tr
                            key={row.symbol}
                            className="odd:bg-slate-950 even:bg-slate-900/40"
                          >
                            <td className="px-2 py-1 border-b border-slate-900/40 font-mono">
                              {row.symbol}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              {row.name}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              {row.exchange}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              {row.sector ?? "UNKNOWN"}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {row.market_cap.toLocaleString()}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {row.price.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              {row.is_etf ? "ETF" : "EQUITY"}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              {row.is_actively_trading ? "Yes" : "No"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      Rows{" "}
                      {browserData.items.length > 0 && (
                        <>
                          <span className="font-mono">
                            {1 + (browserData.page - 1) * browserData.page_size}
                          </span>{" "}
                          –{" "}
                          <span className="font-mono">
                            {Math.min(
                              browserData.page * browserData.page_size,
                              browserData.total_items
                            )}
                          </span>
                        </>
                      )}{" "}
                      of{" "}
                      <span className="font-mono">
                        {browserData.total_items.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          browserLoading || browserData.page <= 1
                        }
                        onClick={() =>
                          fetchUniverseBrowse(browserData.page - 1)
                        }
                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={
                          browserLoading ||
                          browserData.page >= browserData.total_pages
                        }
                        onClick={() =>
                          fetchUniverseBrowse(browserData.page + 1)
                        }
                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!browserLoading &&
                !browserError &&
                browserData &&
                browserData.items.length === 0 && (
                  <div className="text-[11px] text-slate-500">
                    No symbols match the current filters.
                  </div>
                )}
            </CollapsibleSection>

            {/* EODHD window ingest */}
            <CollapsibleSection
              storageKey="tp_datahub_section_eodhd_window"
              title="EODHD Bars → Daily Window Ingest"
              defaultOpen={true}
            >
              <p className="text-[11px] text-slate-400 mb-2">
                Use the FMP symbol universe in DuckDB to bulk-ingest daily bars
                from EODHD for a specific date range. This runs as a tracked
                “job” so you can inspect the latest ingest status.
              </p>

              {/* Controls row */}
              <div className="mt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Start date</label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={eodStart}
                    onChange={(e) => setEodStart(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">End date</label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={eodEnd}
                    onChange={(e) => setEodEnd(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Min market cap (USD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={eodMinCap}
                    onChange={(e) =>
                      setEodMinCap(e.target.value.replace(/,/g, ""))
                    }
                    placeholder="50000000"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Max market cap (optional)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={eodMaxCap}
                    onChange={(e) =>
                      setEodMaxCap(e.target.value.replace(/,/g, ""))
                    }
                    placeholder=""
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Exchanges (comma-separated)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={eodExchanges}
                    onChange={(e) => setEodExchanges(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Max symbols</label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={eodMaxSymbols}
                    onChange={(e) =>
                      setEodMaxSymbols(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="25"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={eodIncludeEtfs}
                      onChange={(e) => setEodIncludeEtfs(e.target.checked)}
                    />
                    <span className="text-[11px]">Include ETFs</span>
                  </label>
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={eodActiveOnly}
                      onChange={(e) => setEodActiveOnly(e.target.checked)}
                    />
                    <span className="text-[11px]">Active only</span>
                  </label>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleIngestEodhdWindow}
                  disabled={eodLoading}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
                >
                  {eodLoading ? "Ingesting window…" : "Ingest EODHD window"}
                </button>
                <div className="flex items-center gap-2">
                  {eodLoading && (
                    <span className="text-[11px] text-slate-500">
                      Talking to EODHD and DuckDB…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={refreshEodJobStatus}
                    disabled={eodJobRefreshing}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-[10px]"
                  >
                    {eodJobRefreshing ? "Refreshing…" : "Refresh job status"}
                  </button>
                </div>
              </div>

              {eodError && (
                <div className="text-[11px] text-amber-400 mt-1">{eodError}</div>
              )}

              {eodResult && (
                <div className="mt-2 text-[11px] text-slate-300 border border-slate-800 rounded-md p-2 bg-slate-950/40">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-200">
                        Latest EODHD ingest
                      </span>
                      <span className="font-mono text-slate-400">
                        {eodResult.requested_start} →{" "}
                        {eodResult.requested_end}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {eodJobStatus && (
                        <span className="text-[10px]">
                          Job{" "}
                          <span className="font-mono">
                            {eodJobStatus.id.slice(0, 8)}…
                          </span>{" "}
                          <span
                            className={
                              eodJobStatus.state === "succeeded"
                                ? "text-emerald-300"
                                : eodJobStatus.state === "running"
                                ? "text-sky-300"
                                : "text-rose-300"
                            }
                          >
                            ({eodJobStatus.state})
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <div className="text-slate-400 text-[10px]">
                        Universe symbols
                      </div>
                      <div className="font-semibold">
                        {eodResult.universe_symbols_considered}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">
                        Symbols attempted
                      </div>
                      <div className="font-semibold">
                        {eodResult.symbols_attempted}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">
                        Succeeded / Failed
                      </div>
                      <div className="font-semibold">
                        {eodResult.symbols_succeeded} /{" "}
                        {eodResult.symbols_failed}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">
                        Rows observed
                      </div>
                      <div className="font-semibold">
                        {eodResult.rows_observed_after_ingest.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {eodResult.failed_symbols.length > 0 && (
                    <div className="mt-1 text-[10px] text-amber-300">
                      Failed symbols: {eodResult.failed_symbols.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </CollapsibleSection>

            {/* NEW: Cached daily bars inspector (DuckDB only) */}
            <CollapsibleSection
              storageKey="tp_datahub_section_cached_bars"
              title="Cached Daily Bars (DuckDB)"
              defaultOpen={false}
            >
              <p className="text-[11px] text-slate-400 mb-2">
                Inspect what&apos;s currently stored in the{" "}
                <span className="font-mono">daily_bars</span> table for a
                symbol and date window. This does <span className="font-semibold">
                  not
                </span>{" "}
                call EODHD – it only reads from DuckDB.
              </p>

              <div className="flex flex-wrap gap-2 items-end text-[11px]">
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Symbol</label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={cachedSymbol}
                    onChange={(e) => setCachedSymbol(e.target.value)}
                    placeholder="AAPL"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Start (YYYY-MM-DD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={cachedStart}
                    onChange={(e) => setCachedStart(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    End (YYYY-MM-DD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={cachedEnd}
                    onChange={(e) => setCachedEnd(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchCachedBars}
                  disabled={cachedLoading}
                  className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
                >
                  {cachedLoading ? "Loading cached…" : "Load cached bars"}
                </button>
              </div>

              {cachedError && (
                <div className="text-[11px] text-amber-400 mt-1">
                  {cachedError}
                </div>
              )}

              {cachedBars.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <div>
                      Found{" "}
                      <span className="font-semibold text-slate-200">
                        {cachedBars.length}
                      </span>{" "}
                      cached bars for{" "}
                      <span className="font-semibold text-slate-200">
                        {cachedSymbol.toUpperCase()}
                      </span>
                      .
                    </div>
                    <div className="font-mono">
                      {cachedBars[0].time.slice(0, 10)} →{" "}
                      {
                        cachedBars[cachedBars.length - 1].time.slice(0, 10)
                      }
                    </div>
                  </div>

                  <div className="mt-2">
                    <PriceSparkline bars={cachedBars} />
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto border border-slate-800 rounded-md">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-900/80">
                        <tr className="text-left text-slate-300">
                          <th className="px-2 py-1 border-b border-slate-800">
                            Date
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Open
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            High
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Low
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Close
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Volume
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cachedBars.map((bar) => (
                          <tr
                            key={bar.time}
                            className="odd:bg-slate-950 even:bg-slate-900/40"
                          >
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              {bar.time.slice(0, 10)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.open.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.high.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.low.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.close.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.volume.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!cachedLoading &&
                !cachedError &&
                cachedBars.length === 0 && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    No cached bars for that symbol / window yet. Try ingesting
                    from EODHD first, then reload.
                  </div>
                )}
            </CollapsibleSection>

            {/* Polygon OHLCV fetcher */}
            <CollapsibleSection
              storageKey="tp_datahub_section_polygon_ohlcv"
              title="Polygon Daily OHLCV Window"
              defaultOpen={false}
            >
              <div className="flex items-center justify-between mb-1">
                {barsLoading && (
                  <span className="text-[11px] text-slate-500">
                    Fetching bars…
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-end text-[11px]">
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">Symbol</label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="AAPL"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Start (YYYY-MM-DD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    End (YYYY-MM-DD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchBars}
                  disabled={barsLoading}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
                >
                  Fetch OHLCV
                </button>
              </div>

              {barsError && (
                <div className="text-[11px] text-amber-400">{barsError}</div>
              )}

              {bars.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <div>
                      Received{" "}
                      <span className="font-semibold text-slate-200">
                        {bars.length}
                      </span>{" "}
                      bars for{" "}
                      <span className="font-semibold text-slate-200">
                        {symbol.toUpperCase()}
                      </span>
                      .
                    </div>
                    <div className="font-mono">
                      {bars[0].time.slice(0, 10)} →{" "}
                      {bars[bars.length - 1].time.slice(0, 10)}
                    </div>
                  </div>

                  <div className="mt-2">
                    <PriceSparkline bars={bars} />
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto border border-slate-800 rounded-md">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-900/80">
                        <tr className="text-left text-slate-300">
                          <th className="px-2 py-1 border-b border-slate-800">
                            Date
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Open
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            High
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Low
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Close
                          </th>
                          <th className="px-2 py-1 border-b border-slate-800 text-right">
                            Volume
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bars.map((bar) => (
                          <tr
                            key={bar.time}
                            className="odd:bg-slate-950 even:bg-slate-900/40"
                          >
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              {bar.time.slice(0, 10)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.open.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.high.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.low.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.close.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                              {bar.volume.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CollapsibleSection>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DataHubPage;