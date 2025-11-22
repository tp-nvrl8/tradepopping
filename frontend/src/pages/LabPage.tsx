import React, { useEffect, useState } from "react";
import { LabIdea, IdeaStatus, VolatilityRegime } from "../lab/types";
import { fetchLabIdeas, saveLabIdea } from "../api/lab";
import { useUiScopedTokens } from "../config/useUiScopedTokens";

import IdeaListSidebar from "../lab-components/IdeaListSidebar";
import LabBottomPanel from "../lab-components/LabBottomPanel";
import LabRightPanel from "../lab-components/LabRightPanel";
import PriceLiquidityFilters from "../lab-components/PriceLiquidityFilters";
import VolatilityFilters from "../lab-components/VolatilityFilters";
import StructureFilters from "../lab-components/StructureFilters";

import IndicatorBuilderPanel from "../lab-components/IndicatorBuilderPanel";
import FilterComposerPanel from "../lab-components/FilterComposerPanel";
import LabPanelShell from "../lab-components/LabPanelShell";

type LabTab = "scan" | "backtests" | "candidates";

// Center panel IDs for the Lab page
type CenterPanelId = "builder" | "indicator" | "filters" | "analysis";

const defaultCenterOrder: CenterPanelId[] = [
  "builder",
  "indicator",
  "filters",
  "analysis",
];

const PANEL_STORAGE_KEY = "tp_lab_panel_layout_v1";
const CENTER_PANEL_STORAGE_KEY = "tp_lab_center_panels_v1";
const LOCAL_IDEAS_STORAGE_KEY = "tp_lab_ideas_v1";

const statusOptions: { id: IdeaStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "active", label: "Active" },
  { id: "retired", label: "Retired" },
];

const regimeChipClasses: Record<VolatilityRegime, string> = {
  any: "border-purple-400 text-purple-200 bg-purple-500/10",
  quiet: "border-sky-400 text-sky-200 bg-sky-500/10",
  normal: "border-slate-400 text-slate-200 bg-slate-600/10",
  expanding: "border-amber-400 text-amber-200 bg-amber-500/10",
  crisis: "border-red-500 text-red-200 bg-red-600/20",
};

// --- Default mock ideas if backend is empty ---
const defaultIdeas: LabIdea[] = [
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
        { id: "darkflow_bias", variant: "default", enabled: true },
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
        { id: "darkflow_bias", enabled: true },
        {
          id: "sobv_trend",
          enabled: true,
          params: { lookback: 10 },
        },
      ],
    },
  },
];

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
  const [indicatorOpen, setIndicatorOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCounter, setNewCounter] = useState(1);

  const [centerPanelsOrder, setCenterPanelsOrder] =
    useState<CenterPanelId[]>(defaultCenterOrder);

  const tokens = useUiScopedTokens(["global", "page:lab"]);
  const ideaBuilderTokens = useUiScopedTokens([
    "global",
    "page:lab",
    "region:lab:ideaBuilder",
  ]);
  const indicatorTokens = useUiScopedTokens([
    "global",
    "page:lab",
    "region:lab:indicator",
  ]);
  const filterTokens = useUiScopedTokens([
    "global",
    "page:lab",
    "region:lab:filter",
  ]);

  const allPanelsClosed = !leftOpen && !rightOpen && !bottomOpen;

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

        const sectionObj: any = (idea as any)[section] || {};
        const currentRange: any = sectionObj[field] || {};
        const updatedRange = { ...currentRange, [bound]: value };
        const updatedSection = { ...sectionObj, [field]: updatedRange };

        return { ...idea, [section]: updatedSection } as LabIdea;
      })
    );
  };

  // Load panel layout from localStorage (side panels + center panels)
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
        if (typeof parsed.builderOpen === "boolean")
          setBuilderOpen(parsed.builderOpen);
        if (typeof parsed.indicatorOpen === "boolean")
          setIndicatorOpen(parsed.indicatorOpen);
        if (typeof parsed.filtersOpen === "boolean")
          setFiltersOpen(parsed.filtersOpen);
      }
    } catch (e) {
      console.warn("Failed to load panel layout", e);
    }
  }, []);

  // Persist panel layout (side + center + bottom)
  useEffect(() => {
    try {
      const payload = {
        leftOpen,
        rightOpen,
        bottomOpen,
        builderOpen,
        indicatorOpen,
        filtersOpen,
      };
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to save panel layout", e);
    }
  }, [leftOpen, rightOpen, bottomOpen, builderOpen, indicatorOpen, filtersOpen]);

  // Load center panel order from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CENTER_PANEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const allowed: CenterPanelId[] = defaultCenterOrder;

          // Keep only allowed IDs
          const valid = parsed.filter(
            (p: unknown): p is CenterPanelId =>
              typeof p === "string" && (allowed as string[]).includes(p)
          );

          // 🔑 Merge with any new panel IDs we’ve added in code
          const merged: CenterPanelId[] = [
            ...valid,
            ...allowed.filter((p) => !valid.includes(p)),
          ];

          setCenterPanelsOrder(
            merged.length > 0 ? merged : defaultCenterOrder
          );
          return;
        }
      }

      // If no stored value, fall back to default
      setCenterPanelsOrder(defaultCenterOrder);
    } catch (e) {
      console.warn("Failed to load center panel order", e);
      setCenterPanelsOrder(defaultCenterOrder);
    }
  }, []);

  // Persist center panel order
  useEffect(() => {
    try {
      localStorage.setItem(
        CENTER_PANEL_STORAGE_KEY,
        JSON.stringify(centerPanelsOrder)
      );
    } catch (e) {
      console.warn("Failed to save center panel order", e);
    }
  }, [centerPanelsOrder]);

  // Load ideas from backend
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        try {
          const local = window.localStorage.getItem(LOCAL_IDEAS_STORAGE_KEY);
          if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed)) {
              setIdeas(parsed);
              setSelectedIdeaId(parsed[0]?.meta.id ?? null);
              setNewCounter(computeNextNewCounter(parsed));
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("Failed to load ideas from localStorage", e);
        }

        setLoading(true);
        setLoadError(null);

        const remote = await fetchLabIdeas();
        if (cancelled) return;

        const finalIdeas = remote.length > 0 ? remote : defaultIdeas;
        setIdeas(finalIdeas);
        setSelectedIdeaId(finalIdeas[0]?.meta.id ?? null);
        setNewCounter(computeNextNewCounter(finalIdeas));
      } catch (err) {
        console.error("Failed to load ideas", err);
        if (!cancelled) {
          setLoadError("Could not load ideas from server. Using defaults.");
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOCAL_IDEAS_STORAGE_KEY,
        JSON.stringify(ideas)
      );
    } catch (e) {
      console.warn("Failed to save ideas to localStorage", e);
    }
  }, [ideas]);

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
    } catch (err) {
      console.error("Failed to save idea", err);
      window.alert("Failed to save idea to backend. Check logs.");
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
        family: undefined,
        tags: [],
      },
      priceLiquidity: {
        price: {},
      },
      volatility: {
        regime: "any",
      },
      structure: {},
      indicators: {
        indicators: [],
      },
    };

    setIdeas((prev) => [...prev, newIdea]);
    setSelectedIdeaId(id);
    setNewCounter((c) => c + 1);
  };

  // Render a center panel based on its ID, using the current state
  const renderCenterPanel = (panelId: CenterPanelId) => {
    switch (panelId) {
      case "builder":
        return (
          <LabPanelShell
            key="builder"
            title="Idea Builder"
            open={builderOpen}
            onToggle={() => setBuilderOpen((open) => !open)}
            containerClassName="border rounded-md"
            headerClassName="border-b rounded-t-md"
            bodyClassName="space-y-4 rounded-b-md"
            style={{
              background: ideaBuilderTokens.surface,
              borderColor: ideaBuilderTokens.border,
              color: ideaBuilderTokens.textPrimary,
            }}
          >
            {loading && ideas.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Loading ideas…
              </div>
            ) : selectedIdea ? (
              <>
                {/* Meta, status, regime */}
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
                      placeholder="Describe what this idea is trying to capture…"
                      value={selectedIdea.meta.description ?? ""}
                      onChange={(e) =>
                        updateIdeaById(selectedIdea.meta.id, (idea) => ({
                          ...idea,
                          meta: {
                            ...idea.meta,
                            description: e.target.value,
                          },
                        }))
                      }
                    />
                    {selectedIdea.meta.tags &&
                      selectedIdea.meta.tags.length > 0 && (
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

                  <div className="flex flex-col items-end gap-2">
                    {/* Status control */}
                    <div className="inline-flex rounded-full bg-slate-900/60 border border-slate-700 p-0.5">
                      {statusOptions.map((opt) => {
                        const active = selectedIdea.meta.status === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() =>
                              updateIdeaById(
                                selectedIdea.meta.id,
                                (idea) => ({
                                  ...idea,
                                  meta: { ...idea.meta, status: opt.id },
                                })
                              )
                            }
                            className={`px-2 py-0.5 text-[10px] rounded-full transition ${
                              active
                                ? "bg-sky-500 text-slate-950 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
                                : "text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Regime chip + selector */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 uppercase tracking-wide text-[10px] ${
                          regimeChipClasses[selectedIdea.volatility.regime]
                        }`}
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                        {selectedIdea.volatility.regime.toUpperCase()}
                      </span>
                      <select
                        className="bg-slate-950 border border-slate-700 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide hover:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={selectedIdea.volatility.regime}
                        onChange={(e) =>
                          updateIdeaById(
                            selectedIdea.meta.id,
                            (idea) => ({
                              ...idea,
                              volatility: {
                                ...idea.volatility,
                                regime: e.target
                                  .value as VolatilityRegime,
                              },
                            })
                          )
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

                {/* Save / Duplicate */}
                <div className="mt-2 flex gap-2 items-center">
                  <button
                    onClick={handleSaveIdea}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold"
                  >
                    {saving ? "Saving…" : "Save Idea"}
                  </button>
                  <button className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">
                    Duplicate (stub)
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No idea selected. Choose an idea on the left or create a new
                one.
              </div>
            )}
          </LabPanelShell>
        );

      case "indicator":
        return (
          <LabPanelShell
            key="indicator"
            title="Indicator Builder"
            open={indicatorOpen}
            onToggle={() => setIndicatorOpen((o) => !o)}
            containerClassName="border border-[var(--tp-lab-builder-border)] bg-[var(--tp-lab-builder-bg)]"
            headerClassName="border-b border-[var(--tp-lab-builder-header-border)] bg-[var(--tp-lab-builder-header-bg)] rounded-t-md"
            bodyClassName="rounded-b-md"
            style={{
              background: indicatorTokens.surface,
              borderColor: indicatorTokens.border,
              color: indicatorTokens.textPrimary,
            }}
          >
            <IndicatorBuilderPanel
              ideaName={selectedIdea?.meta.name}
              indicators={selectedIdea?.indicators?.indicators ?? []}
              onChangeIndicators={(next) => {
                if (!selectedIdea) return;
                updateIdeaById(selectedIdea.meta.id, (idea) => ({
                  ...idea,
                  indicators: {
                    ...(idea.indicators ?? { indicators: [] }),
                    indicators: next,
                  },
                }));
              }}
            />
          </LabPanelShell>
        );

      case "filters":
        return (
          <LabPanelShell
            key="filters"
            title="Filter Composer"
            open={filtersOpen}
            onToggle={() => setFiltersOpen((o) => !o)}
            containerClassName="border border-[var(--tp-lab-builder-border)] bg-[var(--tp-lab-builder-bg)]"
            headerClassName="border-b border-[var(--tp-lab-builder-header-border)] bg-[var(--tp-lab-builder-header-bg)] rounded-t-md"
            bodyClassName="rounded-b-md"
            style={{
              background: filterTokens.surface,
              borderColor: filterTokens.border,
              color: filterTokens.textPrimary,
            }}
          >
            <FilterComposerPanel ideaName={selectedIdea?.meta.name} />
          </LabPanelShell>
        );

      case "analysis":
        return (
          <section key="analysis">
            <LabBottomPanel
              open={bottomOpen}
              onToggle={() => setBottomOpen((p) => !p)}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              ideaName={selectedIdea?.meta.name}
            />
          </section>
        );

      default:
        return null;
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
            Strategy Lab
          </h1>
          <p className="text-xs text-slate-400">
            Design, test, and refine trading ideas. This cockpit will feed
            candidates and the test stand later.
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            surface: {tokens.surface} • border: {tokens.border}
          </p>
          {loadError && (
            <p className="text-[10px] text-amber-400 mt-1">{loadError}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {/* Left toggle is on the panel itself now */}
        </div>
      </header>

      {/* Main row */}
      <div
        className={`flex-1 flex overflow-hidden ${
          allPanelsClosed ? "justify-center" : ""
        }`}
      >
        {/* Left: idea list with collapsible width */}
        <aside
          className={`border-r border-slate-800 bg-slate-950/80 flex flex-col transition-all duration-200 ${
            leftOpen ? "w-72" : "w-8"
          }`}
        >
          {leftOpen ? (
            <>
              {/* Left panel header – click to collapse */}
              <div
                className="px-3 py-2 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between cursor-pointer"
                onClick={() => setLeftOpen(false)}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Ideas
                </span>
                <span className="text-slate-400 text-sm">▾</span>
              </div>

              {/* Actual idea list content */}
              <div className="flex-1 overflow-y-auto">
                <IdeaListSidebar
                  ideas={ideas}
                  selectedIdeaId={selectedIdeaId}
                  onSelectIdea={setSelectedIdeaId}
                  onNewIdea={handleNewIdea}
                />
              </div>
            </>
          ) : (
            // Collapsed skinny handle
            <button
              className="flex-1 flex items-center justify-center cursor-pointer hover:bg-slate-900/80"
              onClick={() => setLeftOpen(true)}
              title="Show Ideas"
            >
              <span className="text-slate-400 text-xs" aria-hidden="true">
                ▶
              </span>
            </button>
          )}
        </aside>

        {/* Center: builder + indicator + filters + analysis (order is configurable) */}
        <main className="flex-1 flex flex-col overflow-y-auto items-center">
          <div className="w-full max-w-5xl px-4 py-3 space-y-4">
            {centerPanelsOrder.map((panelId) => renderCenterPanel(panelId))}
          </div>
        </main>

        {/* Right: notes & meta */}
        <LabRightPanel
          open={rightOpen}
          onToggle={() => setRightOpen((p) => !p)}
        />
      </div>
    </div>
  );
};

export default LabPage;