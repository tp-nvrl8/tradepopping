import React, { useEffect, useState } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";

import { fetchLabIdeas } from "../api/lab";
import type { LabIdea } from "../lab/types";

import IdeaListSidebar from "../lab-components/IdeaListSidebar";

import {
  computeIdeaIndicatorMatrix,
  type IdeaIndicatorMatrix,
} from "../indicators/ideaIndicatorMatrix";
import { MOCK_DAILY_BARS } from "../indicators/mockPriceData";
import type { IndicatorRuntimeContext } from "../indicators/indicatorRuntime";

const TestStandPage: React.FC = () => {
  const tokens = useUiScopedTokens(["global", "page:teststand"]);

  const [ideas, setIdeas] = useState<LabIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [matrix, setMatrix] = useState<IdeaIndicatorMatrix | null>(null);
  const [running, setRunning] = useState(false);

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
          setLoadError("Could not load ideas. Create ideas in Strategy Lab first.");
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

  const handleRunTest = () => {
    if (!selectedIdea) return;

    setRunning(true);
    try {
      const ctx: IndicatorRuntimeContext = {
        symbol: "MOCK",     // later: real symbol
        timeframe: "1d",    // later: selectable timeframe
      };

      const m = computeIdeaIndicatorMatrix(
        selectedIdea,
        MOCK_DAILY_BARS,
        ctx
      );
      setMatrix(m);
    } catch (err) {
      console.error("Error running test stand", err);
      window.alert("Error running test. Check console for details.");
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
            Play your ideas through price history to see how their indicators behave.
          </p>
          {loadError && (
            <p className="text-[10px] text-amber-400 mt-1">{loadError}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleRunTest}
            disabled={!selectedIdea || running || loadingIdeas}
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold"
          >
            {running ? "Running…" : "Run Test on MOCK Data"}
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
        <aside
          className="border-r border-slate-800 bg-slate-950/80 flex flex-col w-72"
        >
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
                No ideas available. Go to Strategy Lab and create an idea first.
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
                    <div className="text-[11px] text-slate-400">
                      Symbol: <span className="font-semibold">MOCK</span>{" "}
                      • Timeframe: <span className="font-semibold">1D</span>
                    </div>
                  </div>
                  {selectedIdea.meta.description && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {selectedIdea.meta.description}
                    </p>
                  )}
                </section>

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
                      Click &quot;Run Test&quot; to compute this idea&apos;s indicator
                      stack on the mock price series.
                    </div>
                  ) : matrix.rows.length === 0 ? (
                    <div className="text-[11px] text-slate-500">
                      This idea has no indicators attached yet. Add indicators
                      in the Strategy Lab Indicator Builder.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matrix.rows.map((row) => {
                        const { instance, definition, result } = row;
                        return (
                          <div
                            key={row.index}
                            className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-100">
                                <span>{definition?.name ?? instance.id}</span>
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
                                {result.meta?.last != null
                                  ? Number(result.meta.last).toFixed(3)
                                  : "—"}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Min:{" "}
                                {result.meta?.min != null
                                  ? Number(result.meta.min).toFixed(3)
                                  : "—"}{" "}
                                · Max:{" "}
                                {result.meta?.max != null
                                  ? Number(result.meta.max).toFixed(3)
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
