import React, { useEffect, useState } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";
import { apiClient } from "../api";

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

// Simple sparkline renderer for close prices only
const PriceSparkline: React.FC<{ bars: PriceBarDTO[] }> = ({ bars }) => {
  if (!bars.length) {
    return (
      <div className="text-[10px] text-slate-500">
        No data to preview.
      </div>
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
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={6}
        fill="#020617"
      />
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

  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2024-01-02");
  const [end, setEnd] = useState("2024-01-31");
  const [bars, setBars] = useState<PriceBarDTO[]>([]);
  const [barsLoading, setBarsLoading] = useState(false);
  const [barsError, setBarsError] = useState<string | null>(null);

  // Load data source status on mount
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
          <h1 className="text-lg font-semibold tracking-tight">
            Data Hub
          </h1>
          <p className="text-xs text-slate-400">
            Connect data sources, test API keys, and inspect raw OHLCV windows.
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
                  <span className="text-[11px] text-slate-500">
                    Loading...
                  </span>
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