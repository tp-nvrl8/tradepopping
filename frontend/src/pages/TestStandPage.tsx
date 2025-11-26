// frontend/src/pages/TestStandPage.tsx

import React, { useEffect, useState } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";

import { fetchLabIdeas } from "../api/lab";
import type { LabIdea } from "../lab/types";

import IdeaListSidebar from "../lab-components/IdeaListSidebar";

import {
  computeIdeaIndicatorMatrix,
  type IdeaIndicatorMatrix,
} from "../indicators/ideaIndicatorMatrix";
import type {
  IndicatorRuntimeContext,
  PriceBar,
} from "../indicators/indicatorRuntime";
import { apiClient } from "../api";

// Match the DTO shape returned by the backend /api/datahub/polygon/daily-ohlcv
interface PriceBarDTO {
  time: string; // ISO string from backend
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TestStandPage: React.FC = () => {
  const tokens = useUiScopedTokens(["global", "page:teststand"]);

  const [ideas, setIdeas] = useState<LabIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [matrix, setMatrix] = useState<IdeaIndicatorMatrix | null>(null);
  const [running, setRunning] = useState(false);

  // === Symbol + date-range state for real data ===
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2024-10-01");
  const [end, setEnd] = useState("2024-11-30");
  const [bars, setBars] = useState<PriceBarDTO[] | null>(null);
  const [barsError, setBarsError] = useState<string | null>(null);

  // Load ideas (same backend as Lab)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadingIdeas(true);
        setLoadError(null);
        const remote = await fetchLabIdeas();
        if (cancelled) return;

        setIdeas(remote);
        setSelectedIdeaId(remote[0]?.meta.id ?? null);
      } catch (err) {
        console.error("Failed to load ideas for Test Stand", err);
        if (!cancelled) {
          setLoadError(
            "Could not load ideas. Create ideas in Strategy Lab first."
          );
          setIdeas([]);
        }
      } finally {
        if (!cancelled) setLoadingIdeas(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIdea =
    ideas.find((i) => i.meta.id === selectedIdeaId) ?? null;

  /**
   * Fetch daily OHLCV from backend (Polygon) for the
   * current symbol + date range, and return normalized PriceBar[]
   * that the indicator engine expects.
   */
  const fetchPriceBarsForTest = async (): Promise<PriceBar[]> => {
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      throw new Error("Symbol is required.");
    }

    setBarsError(null);

    const res = await apiClient.get<PriceBarDTO[]>(
      "/datahub/polygon/daily-ohlcv",
      {
        params: {
          symbol: trimmedSymbol,
          start,
          end,
        },
      }
    );

    const dtoBars = res.data;
    setBars(dtoBars);

    if (!dtoBars.length) {
      throw new Error(
        "No bars returned for that symbol/date range. Check weekends/holidays."
      );
    }

    // Map DTO into the indicator runtime's PriceBar shape
    const mapped: PriceBar[] = dtoBars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      // shortVolume and darkPoolVolume can be added later from other sources
    }));

    return mapped;
  };

  const handleRunTest = async () => {
    if (!selectedIdea) return;

    setRunning(true);
    setBarsError(null);
    setMatrix(null);

    try {
      // 1) Fetch real bars from Polygon via backend
      const barsForTest = await fetchPriceBarsForTest();

      // 2) Build runtime context using chosen symbol + timeframe
      const ctx: IndicatorRuntimeContext = {
        symbol: symbol.trim().toUpperCase(),
        timeframe: "1d", // later: make this selectable
      };

      // 3) Compute full indicator matrix for this idea on these bars
      const m = computeIdeaIndicatorMatrix(selectedIdea, barsForTest, ctx);
      setMatrix(m);
    } catch (err: any) {
      console.error("Error running test stand", err);
      setBarsError(
        err?.message ??
          "Error running test. Check console/backend for details."
      );
    } finally {
      setRunning(false);
    }
  };

  const allPanelsClosed = false; // in case you later add collapsible panels

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
            Test Stand
          </h1>
          <p className="text-xs text-slate-400">
            Play your ideas through real price history to see how their
            indicators behave.
          </p>
          {loadError && (
            <p className="text-[10px] text-amber-400 mt-1">{loadError}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 text-xs">
          {/* Symbol + date controls in header */}
          <div className="flex flex-wrap gap-2 items-center justify-end">
            <label className="flex flex-col text-[11px] text-right">
              <span className="text-slate-400 mb-0.5">Symbol</span>
              <input
                className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500 w-24"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="AAPL"
              />
            </label>
            <label className="flex flex-col text-[11px] text-right">
              <span className="text-slate-400 mb-0.5">Start</span>
              <input
                type="date"
                className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="flex flex-col text-[11px] text-right">
              <span className="text-slate-400 mb-0.5">End</span>
              <input
                type="date"
                className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleRunTest}
            disabled={!selectedIdea || running || loadingIdeas}
            className="mt-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold"
          >
            {running ? "Running…" : "Run Test (Polygon daily)"}
          </button>
        </div>
      </header>

      {/* Main row */}
      <div
        className={`flex-1 flex overflow-hidden ${
          allPanelsClosed ? "justify-center" : ""
        }`}
      >
        {/* Left: idea list (reuse same sidebar as Lab) */}
        <aside className="border-r border-slate-800 bg-slate-950/80 flex flex-col w-72">
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ideas
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingIdeas ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-500">
                Loading ideas…
              </div>
            ) : ideas.length === 0 ? (
              <div className="p-3 text-[11px] text-slate-500">
                No ideas available. Go to Strategy Lab and create an idea
                first.
              </div>
            ) : (
              <IdeaListSidebar
                ideas={ideas}
                selectedIdeaId={selectedIdeaId}
                onSelectIdea={setSelectedIdeaId}
                onNewIdea={() => {
                  window.alert(
                    "Create new ideas in Strategy Lab. Test Stand only runs existing ideas."
                  );
                }}
              />
            )}
          </div>
        </aside>

        {/* Center: results */}
        <main className="flex-1 flex flex-col overflow-y-auto items-center">
          <div className="w-full max-w-5xl px-4 py-3 space-y-4">
            {!selectedIdea ? (
              <div className="text-xs text-slate-500">
                Select an idea on the left, then click &quot;Run Test&quot;.
              </div>
            ) : (
              <>
                {/* Idea + run context summary */}
                <section className="rounded-md border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold">
                        {selectedIdea.meta.name}
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Status:{" "}
                        <span className="font-semibold">
                          {selectedIdea.meta.status.toUpperCase()}
                        </span>
                      </p>
                    </div>
                    <div className="text-[11px] text-slate-400 text-right">
                      Symbol:{" "}
                      <span className="font-semibold">
                        {symbol.trim().toUpperCase() || "—"}
                      </span>{" "}
                      • Timeframe:{" "}
                      <span className="font-semibold">1D</span>
                      {bars && bars.length > 0 && (
                        <>
                          <br />
                          <span className="text-[10px] text-slate-500">
                            Window:{" "}
                            {bars[0].time.slice(0, 10)} →{" "}
                            {bars[bars.length - 1].time.slice(0, 10)} (
                            {bars.length} bars)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {selectedIdea.meta.description && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {selectedIdea.meta.description}
                    </p>
                  )}
                  {barsError && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      {barsError}
                    </p>
                  )}
                </section>

                {/* Indicator results */}
                <section className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      Indicator Results
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      {matrix
                        ? `${matrix.rows.length} indicators computed`
                        : "Run test to compute indicators"}
                    </span>
                  </div>

                  {!matrix ? (
                    <div className="text-[11px] text-slate-500">
                      Click &quot;Run Test&quot; to compute this idea&apos;s
                      indicator stack on Polygon daily bars.
                    </div>
                  ) : matrix.rows.length === 0 ? (
                    <div className="text-[11px] text-slate-500">
                      This idea has no indicators attached yet. Add
                      indicators in the Strategy Lab Indicator Builder.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matrix.rows.map((row) => {
                        const { instance, definition, result } = row;

                        // 🔍 Compute stats on the fly from result.values
                        const rawValues = Array.isArray(result.values)
                          ? result.values
                          : [];
                        const numericValues = rawValues.filter(
                          (v): v is number =>
                            typeof v === "number" && Number.isFinite(v)
                        );

                        let last: number | null = null;
                        let min: number | null = null;
                        let max: number | null = null;

                        if (numericValues.length > 0) {
                          last =
                            numericValues[numericValues.length - 1];
                          min = Math.min(...numericValues);
                          max = Math.max(...numericValues);
                        }

                        return (
                          <div
                            key={row.index}
                            className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-100">
                                <span>
                                  {definition?.name ?? instance.id}
                                </span>
                                {definition?.outputType && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-700 text-slate-300 uppercase tracking-wide">
                                    {definition.outputType}
                                  </span>
                                )}
                                {!instance.enabled && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                    disabled
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {definition?.summary ??
                                  definition?.description ??
                                  "No description yet."}
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-300 text-right">
                              <div>
                                Last:{" "}
                                {last != null
                                  ? last.toFixed(3)
                                  : "—"}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Min:{" "}
                                {min != null
                                  ? min.toFixed(3)
                                  : "—"}{" "}
                                · Max:{" "}
                                {max != null
                                  ? max.toFixed(3)
                                  : "—"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TestStandPage;