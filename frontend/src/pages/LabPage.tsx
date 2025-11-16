import React, { useState } from "react";

type LabIdea = {
  id: string;
  name: string;
  status: "draft" | "active" | "retired";
  description?: string;
};

type LabTab = "scan" | "backtests" | "candidates";

const mockIdeas: LabIdea[] = [
  {
    id: "idea-1",
    name: "Vanishing Float Squeeze v1",
    status: "active",
    description: "Focus on shrinking float + high short interest squeezes.",
  },
  {
    id: "idea-2",
    name: "Mean Reversion in Quiet Regimes",
    status: "draft",
    description: "Fade short-term extremes when volatility is compressed.",
  },
  {
    id: "idea-3",
    name: "Dark Flow Momentum Tracker",
    status: "retired",
    description: "Dark pool heavy buying ahead of breakouts.",
  },
];

const statusBadgeClasses: Record<LabIdea["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  draft: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  retired: "bg-slate-500/10 text-slate-300 border-slate-500/40",
};

const LabPage: React.FC = () => {
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>(mockIdeas[0]?.id);
  const [activeTab, setActiveTab] = useState<LabTab>("scan");

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);

  const selectedIdea = mockIdeas.find((i) => i.id === selectedIdeaId) ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar / header */}
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Strategy Lab
          </h1>
          <p className="text-xs text-slate-400">
            Design, test, and refine trading ideas. Candidates & test stand come
            later.
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
                const isActive = idea.id === selectedIdeaId;
                return (
                  <button
                    key={idea.id}
                    onClick={() => setSelectedIdeaId(idea.id)}
                    className={`w-full text-left px-3 py-2 border-b border-slate-900/60 text-xs hover:bg-slate-900/80 transition ${
                      isActive ? "bg-slate-900/90" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`truncate ${
                          isActive
                            ? "text-sky-100"
                            : "text-slate-100"
                        }`}
                      >
                        {idea.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${statusBadgeClasses[idea.status]}`}
                      >
                        {idea.status.toUpperCase()}
                      </span>
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
                      {selectedIdea.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedIdea.description ||
                        "No description yet. Describe what this idea is trying to capture."}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full border text-[11px] ${statusBadgeClasses[selectedIdea.status]}`}
                  >
                    {selectedIdea.status === "active"
                      ? "Active Idea"
                      : selectedIdea.status === "draft"
                      ? "Draft Idea"
                      : "Retired Idea"}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Placeholder blocks for filters */}
                  <section className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                    <h3 className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                      Price & Liquidity Filters
                    </h3>
                    <p className="text-xs text-slate-400">
                      This block will eventually hold min/max price, average
                      volume, float size, and basic liquidity constraints.
                    </p>
                  </section>

                  <section className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                    <h3 className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                      Volatility & Regime Filters
                    </h3>
                    <p className="text-xs text-slate-400">
                      This block will hold things like ATR bands, KAMA /
                      volatility regime state, and when this idea is &quot;on&quot; or
                      &quot;off&quot;.
                    </p>
                  </section>

                  <section className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                    <h3 className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                      Special Signals & Overlays
                    </h3>
                    <p className="text-xs text-slate-400">
                      This is where we&apos;ll plug in vanishing float, dark flow,
                      short volume (sOBV), and other custom overlays.
                    </p>
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
                        {selectedIdea?.name ?? "no idea selected"}
                      </span>
                      .
                    </p>
                    <p className="text-slate-400">
                      This will show the latest candidate list for this idea and
                      a button to run a scan. For now, it&apos;s just a placeholder.
                    </p>
                  </div>
                )}
                {activeTab === "backtests" && (
                  <div>
                    <p className="text-slate-300 mb-2">
                      Backtests panel for{" "}
                      <span className="font-semibold">
                        {selectedIdea?.name ?? "no idea selected"}
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
                        {selectedIdea?.name ?? "no idea selected"}
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