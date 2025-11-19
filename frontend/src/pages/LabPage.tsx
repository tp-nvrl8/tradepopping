import React, { useEffect, useState } from "react";
import { LabIdea, IdeaStatus, VolatilityRegime } from "../lab/types";
import { fetchLabIdeas, saveLabIdea } from "../api/lab";

import IdeaListSidebar from "../lab-components/IdeaListSidebar";
import LabBottomPanel from "../lab-components/LabBottomPanel";
import LabRightPanel from "../lab-components/LabRightPanel";
import PriceLiquidityFilters from "../lab-components/PriceLiquidityFilters";
import VolatilityFilters from "../lab-components/VolatilityFilters";
import StructureFilters from "../lab-components/StructureFilters";

type LabTab = "scan" | "backtests" | "candidates";

const PANEL_STORAGE_KEY = "tp_lab_panel_layout_v1";

const statusBadgeClasses: Record<IdeaStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  draft: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  retired: "bg-slate-500/10 text-slate-300 border-slate-500/40",
};

const statusOptions = [
  { id: "draft", label: "Draft" },
  { id: "active", label: "Active" },
  { id: "retired", label: "Retired" },
] as const;

const regimeChipClasses: Record<VolatilityRegime, string> = {
  any: "border-purple-400 text-purple-200 bg-purple-500/10",
  quiet: "border-sky-400 text-sky-200 bg-sky-500/10",
  normal: "border-slate-400 text-slate-200 bg-slate-600/10",
  expanding: "border-amber-400 text-amber-200 bg-amber-500/10",
  crisis: "border-red-500 text-red-200 bg-red-600/20",
};

// Default ideas if backend empty
const defaultIdeas: LabIdea[] = [
  /* (same defaultIdeas you're already using — unchanged) */
];

/* Utility: compute next "New Idea #" counter */
function computeNextNewCounter(existing: LabIdea[]): number {
  let max = 0;
  const re = /^New Idea (\d+)$/;
  for (const idea of existing) {
    const m = idea.meta.name.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

const LabPage: React.FC = () => {
  const [ideas, setIdeas] = useState<LabIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<LabTab>("scan");

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCounter, setNewCounter] = useState(1);

  const updateIdeaById = (
    id: string | undefined,
    updater: (idea: LabIdea) => LabIdea
  ) => {
    if (!id) return;
    setIdeas((prev) =>
      prev.map((idea) => (idea.meta.id === id ? updater(idea) : idea))
    );
  };

  const updateRangeField = (
    ideaId: string | undefined,
    section: "priceLiquidity" | "volatility" | "structure",
    field: string,
    bound: "min" | "max",
    raw: string
  ) => {
    if (!ideaId) return;

    const value = raw === "" ? undefined : Number(raw);
    if (raw !== "" && Number.isNaN(value)) return;

    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.meta.id !== ideaId) return idea;

        const sectionObj = (idea as any)[section] || {};
        const currentRange = sectionObj[field] || {};
        const updatedRange = { ...currentRange, [bound]: value };
        const updatedSection = { ...sectionObj, [field]: updatedRange };
        return { ...idea, [section]: updatedSection } as LabIdea;
      })
    );
  };

  // Load persisted panel layout
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PANEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.leftOpen === "boolean") setLeftOpen(parsed.leftOpen);
        if (typeof parsed.rightOpen === "boolean")
          setRightOpen(parsed.rightOpen);
        if (typeof parsed.bottomOpen === "boolean")
          setBottomOpen(parsed.bottomOpen);
      }
    } catch {}
  }, []);

  // Save panel layout
  useEffect(() => {
    try {
      const payload = { leftOpen, rightOpen, bottomOpen };
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [leftOpen, rightOpen, bottomOpen]);

  // Load ideas from backend
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const remote = await fetchLabIdeas();
        if (cancelled) return;

        const finalIdeas = remote.length > 0 ? remote : defaultIdeas;
        setIdeas(finalIdeas);
        setSelectedIdeaId(finalIdeas[0]?.meta.id ?? null);
        setNewCounter(computeNextNewCounter(finalIdeas));
      } catch {
        if (!cancelled) {
          setLoadError("Could not load ideas — using defaults.");
          setIdeas(defaultIdeas);
          setSelectedIdeaId(defaultIdeas[0]?.meta.id ?? null);
          setNewCounter(computeNextNewCounter(defaultIdeas));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIdea =
    ideas.find((i) => i.meta.id === selectedIdeaId) ?? ideas[0] ?? null;

  const handleSaveIdea = async () => {
    if (!selectedIdea) return;
    try {
      setSaving(true);
      const saved = await saveLabIdea(selectedIdea);
      setIdeas((prev) => {
        const idx = prev.findIndex((i) => i.meta.id === saved.meta.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        }
        return [...prev, saved];
      });
    } catch {
      alert("Failed to save idea. Check backend logs.");
    } finally {
      setSaving(false);
    }
  };

  const handleNewIdea = () => {
    const id = `new-${Date.now()}-${newCounter}`;
    const newIdea: LabIdea = {
      meta: {
        id,
        name: `New Idea ${newCounter}`,
        status: "draft",
        description: "",
        tags: [],
      },
      priceLiquidity: { price: {} },
      volatility: { regime: "any" },
      structure: {},
      indicators: { indicators: [] },
    };
    setIdeas((prev) => [...prev, newIdea]);
    setSelectedIdeaId(id);
    setNewCounter((c) => c + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Strategy Lab</h1>
          <p className="text-xs text-slate-400">
            Design, test, and refine trading ideas.
          </p>
          {loadError && (
            <p className="text-[10px] text-amber-400 mt-1">{loadError}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setLeftOpen((p) => !p)}
            className="px-2 py-1 border border-slate-700 rounded bg-slate-900/60 hover:bg-slate-800"
          >
            {leftOpen ? "◀ Hide Ideas" : "▶ Show Ideas"}
          </button>
          <button
            onClick={() => setBottomOpen((p) => !p)}
            className="px-2 py-1 border border-slate-700 rounded bg-slate-900/60 hover:bg-slate-800"
          >
            {bottomOpen ? "▼ Hide Bottom Panel" : "▲ Show Bottom Panel"}
          </button>
        </div>
      </header>

      {/* Main Layout Row */}
      <div className="flex flex-1 overflow-hidden">
        {leftOpen && (
          <IdeaListSidebar
            ideas={ideas}
            selectedIdeaId={selectedIdeaId}
            onSelectIdea={setSelectedIdeaId}
            onNewIdea={handleNewIdea}
          />
        )}

        {/* Center Wrapper — unified width for builder + analysis */}
        <main className="flex-1 flex flex-col items-center overflow-y-auto">
          <div className="w-full max-w-5xl px-4 py-4 space-y-6">
            {/* IDEA BUILDER HEADER */}
            <div
              className="px-3 py-2 border-b border-slate-800 bg-slate-900/70 rounded flex items-center justify-between cursor-pointer"
              onClick={() => setBuilderOpen((o) => !o)}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Idea Builder
              </span>
              <span className="text-slate-400 text-sm">
                {builderOpen ? "▾" : "▸"}
              </span>
            </div>

            {/* IDEA BUILDER CONTENT */}
            {builderOpen && selectedIdea && (
              <div className="space-y-4">

                {/* Meta section */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <input
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm mb-1"
                      value={selectedIdea.meta.name}
                      onChange={(e) =>
                        updateIdeaById(selectedIdea.meta.id, (idea) => ({
                          ...idea,
                          meta: { ...idea.meta, name: e.target.value },
                        }))
                      }
                    />
                    <textarea
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 min-h-[52px]"
                      value={selectedIdea.meta.description ?? ""}
                      placeholder="Describe this idea…"
                      onChange={(e) =>
                        updateIdeaById(selectedIdea.meta.id, (idea) => ({
                          ...idea,
                          meta: { ...idea.meta, description: e.target.value },
                        }))
                      }
                    />
                  </div>

                  {/* Status + regime */}
                  <div className="flex flex-col items-end gap-2 text-xs">
                    <div className="inline-flex rounded-full bg-slate-900/60 border border-slate-700 p-0.5">
                      {statusOptions.map((opt) => {
                        const active = selectedIdea.meta.status === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() =>
                              updateIdeaById(selectedIdea.meta.id, (idea) => ({
                                ...idea,
                                meta: { ...idea.meta, status: opt.id },
                              }))
                            }
                            className={`px-2 py-0.5 rounded-full ${
                              active
                                ? "bg-sky-500 text-slate-950 shadow-[0_0_6px_rgba(56,189,248,0.7)]"
                                : "text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Regime */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 uppercase text-[10px] ${
                          regimeChipClasses[selectedIdea.volatility.regime]
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {selectedIdea.volatility.regime.toUpperCase()}
                      </span>

                      <select
                        className="bg-slate-950 border border-slate-700 rounded-full px-2 py-0.5 text-[10px]"
                        value={selectedIdea.volatility.regime}
                        onChange={(e) =>
                          updateIdeaById(selectedIdea.meta.id, (idea) => ({
                            ...idea,
                            volatility: {
                              ...idea.volatility,
                              regime: e.target.value as VolatilityRegime,
                            },
                          }))
                        }
                      >
                        <option value="any">Any</option>
                        <option value="quiet">Quiet</option>
                        <option value="normal">Normal</option>
                        <option value="expanding">Expanding</option>
                        <option value="crisis">Crisis</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <PriceLiquidityFilters
                  idea={selectedIdea}
                  onChangeRange={(field, bound, raw) =>
                    updateRangeField(
                      selectedIdea.meta.id,
                      "priceLiquidity",
                      field,
                      bound,
                      raw
                    )
                  }
                />

                <VolatilityFilters
                  idea={selectedIdea}
                  onChangeRange={(field, bound, raw) =>
                    updateRangeField(
                      selectedIdea.meta.id,
                      "volatility",
                      field,
                      bound,
                      raw
                    )
                  }
                />

                <StructureFilters
                  idea={selectedIdea}
                  onChangeRange={(field, bound, raw) =>
                    updateRangeField(
                      selectedIdea.meta.id,
                      "structure",
                      field,
                      bound,
                      raw
                    )
                  }
                />

                {/* Save */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveIdea}
                    disabled={saving}
                    className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-xs"
                  >
                    {saving ? "Saving…" : "Save Idea"}
                  </button>
                  <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs">
                    Duplicate (soon)
                  </button>
                </div>
              </div>
            )}

            {/* ANALYSIS PANEL — always same width as center */}
            <LabBottomPanel
              open={bottomOpen}
              onToggle={() => setBottomOpen((p) => !p)}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              ideaName={selectedIdea?.meta.name}
            />
          </div>
        </main>

        {/* RIGHT PANEL */}
        <LabRightPanel
          open={rightOpen}
          onToggle={() => setRightOpen((p) => !p)}
        />
      </div>
    </div>
  );
};

export default LabPage;