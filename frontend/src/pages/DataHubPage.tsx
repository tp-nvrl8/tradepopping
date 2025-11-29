import React, { useEffect, useState } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";
import { apiClient } from "../api";

// iPad-friendly error surface
// (keeps us from staring at a blank white screen)
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
  time: string; // ISO string from backend
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  // Per-source test state
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, DataSourceTestResponse | null>
  >({});

  // Polygon OHLCV section
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2024-01-02");
  const [end, setEnd] = useState("2024-01-31");
  const [bars, setBars] = useState<PriceBarDTO[]>([]);
  const [barsLoading, setBarsLoading] = useState(false);
  const [barsError, setBarsError] = useState<string | null>(null);

  // FMP filter controls (user editable)
  const [minMarketCap, setMinMarketCap] = useState<string>("50000000"); // 50M
  const [maxMarketCap, setMaxMarketCap] = useState<string>("5000000000"); // 5B
  const [exchanges, setExchanges] = useState<string>("NYSE,NASDAQ,AMEX");

  // FMP universe ingest + stats
  const [ingestingUniverse, setIngestingUniverse] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] =
    useState<UniverseIngestResult | null>(null);

  const [universeStats, setUniverseStats] = useState<UniverseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Load data source status + universe stats on mount
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Parse numeric caps from the text boxes
    const minCapNum = Number(minMarketCap || "0");
    const maxCapNum = maxMarketCap ? Number(maxMarketCap) : NaN;

    const payload = {
      min_market_cap:
        Number.isFinite(minCapNum) && minCapNum > 0 ? minCapNum : 0,
      max_market_cap:
        Number.isFinite(maxCapNum) && maxCapNum > 0 ? maxCapNum : null,
      exchanges: exchanges || "NYSE,NASDAQ,AMEX",
      country: "US",
      is_etf: false,
      is_fund: false,
      is_actively_trading: true,
      include_all_share_classes: false,
    };

    try {
      const res = await apiClient.post<UniverseIngestResult>(
        "/datalake/fmp/universe/ingest",
        payload
      );
      setIngestResult(res.data);
      // Refresh stats after ingest
      await fetchUniverseStats();
    } catch (err) {
      console.error("Failed to ingest FMP universe", err);
      setIngestError("Failed to ingest symbol universe from FMP.");
    } finally {
      setIngestingUniverse(false);
    }
  };

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
            Connect data sources, test API keys, ingest universes, and inspect
            raw OHLCV windows.
          </p>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col overflow-y-auto items-center">
          <div className="w-full max-w-5xl px-4 py-4 space-y-4">
            {/* Data sources overview */}
            <section className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Data Sources
                </h2>
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
            </section>

            {/* FMP Universe ingest + stats */}
            <section className="rounded-md border border-slate-800 bg-slate-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    FMP Symbol Universe → DuckDB
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Pull the FMP symbol universe (with market cap, sector,
                    industry) into the data lake.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleIngestUniverse}
                  disabled={ingestingUniverse}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
                >
                  {ingestingUniverse ? "Ingesting…" : "Ingest FMP Universe"}
                </button>
              </div>

              {/* Filter controls */}
              <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Min market cap (USD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    type="number"
                    inputMode="numeric"
                    value={minMarketCap}
                    onChange={(e) => setMinMarketCap(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-0.5 text-slate-400">
                    Max market cap (USD)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    type="number"
                    inputMode="numeric"
                    value={maxMarketCap}
                    onChange={(e) => setMaxMarketCap(e.target.value)}
                  />
                </div>
                <div className="flex flex-col min-w-[180px]">
                  <label className="mb-0.5 text-slate-400">
                    Exchanges (comma-separated)
                  </label>
                  <input
                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={exchanges}
                    onChange={(e) => setExchanges(e.target.value)}
                    placeholder="NYSE,NASDAQ,AMEX"
                  />
                </div>
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

                      {/* Type breakdown (equity vs ETF) */}
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
            </section>

            {/* Polygon OHLCV fetcher */}
            <section className="rounded-md border border-slate-800 bg-slate-900/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Polygon Daily OHLCV Window
                </h2>
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
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
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
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DataHubPage;