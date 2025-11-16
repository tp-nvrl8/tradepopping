import React, { useState } from "react";
import { LabIdea, IdeaStatus } from "../lab/types";

type LabTab = "scan" | "backtests" | "candidates";

const statusBadgeClasses: Record<IdeaStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  draft: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  retired: "bg-slate-500/10 text-slate-300 border-slate-500/40",
};

// Some richer mock ideas using the new LabIdea structure
const mockIdeas: LabIdea[] = [
  {
    meta: {
      id: "idea-1",
      name: "Vanishing Float Squeeze v1",
      status: "active",
      description: "Shrinking float + elevated short interest + squeeze bias.",
      family: "Squeeze",
      tags: ["vanishing-float", "short-interest", "squeeze"],
    },
    priceLiquidity: {
      price: { min: 3, max: 25 },
      averageDailyDollarVolume: { min: 1_000_000 },
      averageDailyShareVolume: { min: 250_000 },
      floatShares: { min: 5_000_000, max: 60_000_000 },
    },
    volatility: {
      regime: "expanding",
      atrPercent: { min: 3, max: 12 },
      hvPercent: { min: 25, max: 80 },
    },
    structure: {
      shortInterestPercentFloat: { min: 8, max: 40 },
      daysToCover: { min: 2 },
      vanishingFloatScore: { min: 60 },
    },
    indicators: {
      indicators: [
        {
          id: "sobv_trend",
          variant: "default",
          enabled: true,
          params: { lookback: 20 },
        },
        {
          id: "kama_regime",
          variant: "default",
          enabled: true,
          params: { fast: 2, slow: 30 },
        },
        {
          id: "darkflow_bias",
          variant: "default",
          enabled: true,
        },
      ],
    },
  },
  {
    meta: {
      id: "idea-2",
      name: "Mean Reversion in Quiet Regimes",
      status: "draft",
      description:
        "Fade short-term extremes when volatility is compressed and spreads are tight.",
      family: "Mean Reversion",
      tags: ["quiet-regime", "mean-reversion"],
    },
    priceLiquidity: {
      price: { min: 5, max: 50 },
      averageDailyDollarVolume: { min: 2_000_000 },
    },
    volatility: {
      regime: "quiet",
      atrPercent: { min: 0.5, max: 3 },
      hvPercent: { min: 10, max: 40 },
    },
    structure: {
      shortInterestPercentFloat: { max: 15 },
      daysToCover: { max: 3 },
    },
    indicators: {
      indicators: [
        {
          id: "kama_regime",
          enabled: true,
          params: { fast: 5, slow: 40 },
        },
        {
          id: "zscore_price_lookback",
          enabled: true,
          params: { lookback: 10, threshold: 2 },
        },
      ],
    },
  },
  {
    meta: {
      id: "idea-3",
      name: "Dark Flow Momentum Tracker",
      status: "retired",
      description:
        "Follow-through after sustained dark pool accumulation bursts. Early prototype.",
      family: "Momentum",
      tags: ["darkflow", "momentum"],
    },
    priceLiquidity: {
      price: { min: 10, max: 80 },
      averageDailyDollarVolume: { min: 3_000_000 },
    },
    volatility: {
      regime: "normal",
      atrPercent: { min: 2, max: 8 },
    },
    structure: {
      shortInterestPercentFloat: { min: 3, max: 25 },
      vanishingFloatScore: { min: 30 },
    },
    indicators: {
      indicators: [
        {
          id: "darkflow_bias",
          enabled: true,
        },
        {
          id: "sobv_trend",
          enabled: true,
          params: { lookback: 10 },
        },
      ],
    },
  },
];

function formatRange(label: string, r?: { min?: number; max?: number }) {
  if (!r || (r.min === undefined && r.max === undefined)) return null;
  const parts: string[] = [];
  if (r.min !== undefined) parts.push(`≥ ${r.min}`);
  if (r.max !== undefined) parts.push(`≤ ${r.max}`);
  return `${label}: ${parts.join(" and ")}`;
}

const LabPage: React.FC = () => {
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>(
    mockIdeas[0]?.meta.id
  );
  const [activeTab, setActiveTab] = useState<LabTab>("scan");

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);

  const selectedIdea =
    mockIdeas.find((i) => i.meta.id === selectedIdeaId) ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar / header */}
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Strategy Lab
          </h1>
          <p className="text-xs text-slate-400">
            Design, test, and refine trading ideas. This cockpit will feed
            candidates and the test stand later.
          </p>
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setLeftOpen((prev) => !prev)}
            className="px-2 py-1 border border-slate-700 rounded-md bg-slate-900/60 hover:bg-slate-800 transition"
          >
            {leftOpen ? "◀ Hide Ideas" : "▶ Show Ideas"}
          </button>
          <button
            onClick={() => setBottomOpen((prev) => !prev)}
            className="px-2 py-1 border border-slate-700 rounded-md bg-slate-900/60 hover:bg-slate-800 transition"
          >
            {bottomOpen ? "▼ Hide Bottom Panel" : "▲ Show Bottom Panel"}
          </button>
          <button
            onClick={() => setRightOpen((prev) => !prev)}
            className="px-2 py-1 border border-slate-700 rounded-md bg-slate-900/60 hover:bg-slate-800 transition"
          >
            {rightOpen ? "▶ Hide Notes" : "◀ Show Notes"}
          </button>
        </div>
      </header>

      {/* Middle row: left sidebar + center builder + right panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Ideas list (accordion) */}
        {leftOpen && (
          <aside className="w-64 border-r border-slate-800 bg-slate-950/80 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ideas
              </span>
              <button className="text-xs text-sky-300 hover:text-sky-200">
                + New
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {mockIdeas.map((idea) => {
                const isActive = idea.meta.id === selectedIdeaId;
                return (
                  <button
                    key={idea.meta.id}
                    onClick={() => setSelectedIdeaId(idea.meta.id)}
                    className={`w-full text-left px-3 py-2 border-b border-slate-900/60 text-xs hover:bg-slate-900/80 transition ${
                      isActive ? "bg-slate-900/90" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`truncate ${
                          isActive ? "text-sky-100" : "text-slate-100"
                        }`}
                      >
                        {idea.meta.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${statusBadgeClasses[idea.meta.status]}`}
                      >
                        {idea.meta.status.toUpperCase()}
                      </span>
                      {idea.meta.family && (
                        <span className="text-[10px] text-slate-400 ml-2 truncate">
                          {idea.meta.family}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Center: Idea builder */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {selectedIdea ? (
              <div className="max-w-3xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      {selectedIdea.meta.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedIdea.meta.description ||
                        "No description yet. Describe what this idea is trying to capture."}
                    </p>
                    {selectedIdea.meta.tags && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedIdea.meta.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full border text-[11px] ${statusBadgeClasses[selectedIdea.meta.status]}`}
                  >
                    {selectedIdea.meta.status === "active"
                      ? "Active Idea"
                      : selectedIdea.meta.status === "draft"
                      ? "Draft Idea"
                      : "Retired Idea"}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Price & Liquidity */}
                  <section className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                    <h3 className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                      Price & Liquidity Filters
                    </h3>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>
                        {formatRange(
                          "Price",
                          selectedIdea.priceLiquidity.price
                        ) || "Price: (not set yet)"}
                      </li>
                      <li>
                        {formatRange(
                          "Avg $ Volume",
                          selectedIdea.priceLiquidity.averageDailyDollarVolume
                        ) || "Avg $ Volume: (not set yet)"}
                      </li>
                      <li>
                        {formatRange(
                          "Avg Share Volume",
                          selectedIdea.priceLiquidity.averageDailyShareVolume
                        ) || "Avg Share Volume: (not set yet)"}
                      </li>
                      <li>
                        {formatRange(
                          "Float Shares",
                          selectedIdea.priceLiquidity.floatShares
                        ) || "Float Shares: (not set yet)"}
                      </li>
                    </ul>
                  </section>

                  {/* Volatility & Regime */}
                  <section className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                    <h3 className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                      Volatility & Regime Filters
                    </h3>
                    <p className="text-xs text-slate-300 mb-1">
                      Regime:{" "}
                      <span className="font-semibold">
                        {selectedIdea.volatility.regime.toUpperCase()}
                      </span>
                    </p>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>
                        {formatRange(
                          "ATR %",
                          selectedIdea.volatility.atrPercent
                        ) || "ATR %: (not set yet)"}
                      </li>
                      <li>
                        {formatRange(
                          "HV %",
                          selectedIdea.volatility.hvPercent
                        ) || "HV %: (not set yet)"}
                      </li>
                    </ul>
                  </section>

                  {/* Structure & Overlays */}
                  <section className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                    <h3 className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                      Structural Constraints & Overlays
                    </h3>
                    <ul className="text-xs text-slate-300 space-y-1 mb-2">
                      <li>
                        {formatRange(
                          "Short % of Float",
                          selectedIdea.structure.shortInterestPercentFloat
                        ) || "Short % of Float: (not set yet)"}
                      </li>
                      <li>
                        {formatRange(
                          "Days to Cover",
                          selectedIdea.structure.daysToCover
                        ) || "Days to Cover: (not set yet)"}
                      </li>
                      <li>
                        {formatRange(
                          "Vanishing Float Score",
                          selectedIdea.structure.vanishingFloatScore
                        ) || "Vanishing Float Score: (not set yet)"}
                      </li>
                    </ul>

                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">
                        Indicators & overlays selected for this idea:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedIdea.indicators.indicators.map((ind) => (
                          <span
                            key={ind.id + (ind.variant || "")}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                              ind.enabled
                                ? "border-sky-500 text-sky-200 bg-sky-500/10"
                                : "border-slate-700 text-slate-400 bg-slate-900"
                            }`}
                          >
                            {ind.id}
                            {ind.variant ? ` (${ind.variant})` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs font-semibold">
                    Save Idea (stub)
                  </button>
                  <button className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">
                    Duplicate (stub)
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No idea selected. Choose an idea on the left or create a new
                one.
              </div>
            )}
          </div>

          {/* Bottom panel (accordion) */}
          {bottomOpen && (
            <section className="border-t border-slate-800 bg-slate-950/90">
              {/* Tabs */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setActiveTab("scan")}
                    className={`px-3 py-1 rounded-md border ${
                      activeTab === "scan"
                        ? "border-sky-500 bg-sky-500/10 text-sky-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Scan
                  </button>
                  <button
                    onClick={() => setActiveTab("backtests")}
                    className={`px-3 py-1 rounded-md border ${
                      activeTab === "backtests"
                        ? "border-sky-500 bg-sky-500/10 text-sky-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Backtests
                  </button>
                  <button
                    onClick={() => setActiveTab("candidates")}
                    className={`px-3 py-1 rounded-md border ${
                      activeTab === "candidates"
                        ? "border-sky-500 bg-sky-500/10 text-sky-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Candidates
                  </button>
                </div>
                <span className="text-[10px] text-slate-500">
                  Bottom panel is mock-only for now. We&apos;ll wire scans & backtests
                  later.
                </span>
              </div>

              {/* Content area */}
              <div className="h-40 px-4 py-2 text-xs overflow-y-auto">
                {activeTab === "scan" && (
                  <div>
                    <p className="text-slate-300 mb-2">
                      Scan panel for{" "}
                      <span className="font-semibold">
                        {selectedIdea?.meta.name ?? "no idea selected"}
                      </span>
                      .
                    </p>
                    <p className="text-slate-400">
                      This will show the latest candidate list for this idea and
                      a button to run a scan. For now, it&apos;s just a
                      placeholder.
                    </p>
                  </div>
                )}
                {activeTab === "backtests" && (
                  <div>
                    <p className="text-slate-300 mb-2">
                      Backtests panel for{" "}
                      <span className="font-semibold">
                        {selectedIdea?.meta.name ?? "no idea selected"}
                      </span>
                      .
                    </p>
                    <p className="text-slate-400">
                      This will show backtest runs, key metrics, and allow
                      launching new backtests for this idea.
                    </p>
                  </div>
                )}
                {activeTab === "candidates" && (
                  <div>
                    <p className="text-slate-300 mb-2">
                      Candidates panel for{" "}
                      <span className="font-semibold">
                        {selectedIdea?.meta.name ?? "no idea selected"}
                      </span>
                      .
                    </p>
                    <p className="text-slate-400">
                      This will pull candidate rows for this idea from the
                      global candidates pool and let you manage or promote them
                      to the test stand.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {/* Right: Notes / meta (accordion) */}
        {rightOpen && (
          <aside className="w-72 border-l border-slate-800 bg-slate-950/80 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notes & Meta
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 text-xs space-y-3">
              <section className="border border-slate-800 rounded-lg p-2 bg-slate-900/40">
                <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
                  Idea Notes
                </h3>
                <p className="text-slate-400">
                  This will store your written notes about the selected idea:
                  why it exists, what it&apos;s good at, and what you&apos;ve learned.
                </p>
              </section>
              <section className="border border-slate-800 rounded-lg p-2 bg-slate-900/40">
                <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
                  Future AI Copilot
                </h3>
                <p className="text-slate-400">
                  Later, this panel can summarize idea performance, suggest
                  parameter tweaks, and highlight patterns in backtests and
                  candidates.
                </p>
              </section>
              <section className="border border-slate-800 rounded-lg p-2 bg-slate-900/40">
                <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
                  Status & Tags
                </h3>
                <p className="text-slate-400">
                  This section will show or edit status (draft / active /
                  retired), strategy family, and tags like &quot;VCP&quot; or &quot;Vanishing
                  Float&quot; for the selected idea.
                </p>
              </section>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default LabPage;