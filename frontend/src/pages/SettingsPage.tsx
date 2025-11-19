import React, { useEffect, useState } from "react";
import {
  useTheme,
  ThemeId,
  DEFAULT_CUSTOM_PALETTE,
  CustomPalette,
} from "../config/ThemeContext";

type SettingsTab = "ui" | "data" | "security";

const themeOptions: { id: ThemeId; label: string; description: string }[] = [
  {
    id: "slate",
    label: "Slate",
    description: "Neutral ops baseline. Clean dark slate.",
  },
  {
    id: "trek-industrial",
    label: "Trek Industrial",
    description: "Warm engineering console. Bronze + amber accents.",
  },
  {
    id: "delta-flyer",
    label: "Delta Flyer",
    description: "Cool shuttle cockpit. Icy cyan + metal blue.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Use your own colors for the Lab panels.",
  },
];

// Shared with LabPage via localStorage
const CENTER_PANEL_STORAGE_KEY = "tp_lab_center_panels_v1";
type CenterPanelId = "builder" | "analysis";

const centerPanelLabels: Record<CenterPanelId, string> = {
  builder: "Idea Builder",
  analysis: "Analysis Panel",
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("ui");
  const [newProfileName, setNewProfileName] = useState<string>("");

  // Lab panel order state for Settings UI
  const [panelOrder, setPanelOrder] = useState<CenterPanelId[]>([
    "builder",
    "analysis",
  ]);

  const {
    theme,
    setTheme,
    customPalette,
    setCustomPalette,
    savedCustomThemes,
    activeCustomThemeId,
    saveCustomThemeProfile,
    deleteCustomThemeProfile,
    loadCustomThemeProfile,
  } = useTheme();

  const effectivePalette: CustomPalette =
    customPalette ?? DEFAULT_CUSTOM_PALETTE;

  // Load center panel order from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CENTER_PANEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((p: unknown): p is CenterPanelId =>
            p === "builder" || p === "analysis"
          );
          if (valid.length) {
            setPanelOrder(valid);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist panel order whenever it changes
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CENTER_PANEL_STORAGE_KEY,
        JSON.stringify(panelOrder)
      );
    } catch {
      // ignore
    }
  }, [panelOrder]);

  const movePanel = (index: number, direction: "up" | "down") => {
    setPanelOrder((prev) => {
      const arr = [...prev];
      if (direction === "up" && index > 0) {
        const tmp = arr[index - 1];
        arr[index - 1] = arr[index];
        arr[index] = tmp;
      } else if (direction === "down" && index < arr.length - 1) {
        const tmp = arr[index + 1];
        arr[index + 1] = arr[index];
        arr[index] = tmp;
      }
      return arr;
    });
  };

  const updateCustomColor = (key: keyof CustomPalette, value: string) => {
    const cleaned = value.trim();
    const next: CustomPalette = {
      ...effectivePalette,
      [key]: cleaned || effectivePalette[key],
    };
    setCustomPalette(next);
  };

  const resetCustomPalette = () => {
    setCustomPalette(DEFAULT_CUSTOM_PALETTE);
  };

  const handleSaveCustomProfile = () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    saveCustomThemeProfile(trimmed);
    setNewProfileName("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="mb-4 border-b border-slate-800 pb-3">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-slate-400">
            Tune TradePopping&apos;s environment: UI, data, and security.
          </p>
        </header>

        {/* Top-level settings tabs */}
        <div className="border-b border-slate-800 mb-4">
          <nav className="flex gap-4 text-xs">
            <button
              className={`pb-2 border-b-2 ${
                activeTab === "ui"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("ui")}
            >
              UI Settings
            </button>
            <button
              className={`pb-2 border-b-2 ${
                activeTab === "data"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("data")}
            >
              Data Providers
            </button>
            <button
              className={`pb-2 border-b-2 ${
                activeTab === "security"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("security")}
            >
              Security &amp; Access
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === "ui" && (
          <section className="space-y-4">
            {/* Theme selector */}
            <div className="border border-slate-800 rounded-lg bg-slate-900/40">
              <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Theme</h2>
                  <p className="text-[11px] text-slate-400">
                    Choose the console style for the Lab and other modules.
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  Active:{" "}
                  <span className="font-semibold text-slate-200">
                    {themeOptions.find((t) => t.id === theme)?.label ?? theme}
                  </span>
                </span>
              </header>

              {/* Theme tabs */}
              <div className="px-4 pt-3">
                <div className="flex flex-wrap gap-2 text-xs border-b border-slate-800 pb-2 mb-3">
                  {themeOptions.map((opt) => {
                    const isActive = opt.id === theme;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setTheme(opt.id)}
                        className={`px-3 py-1.5 rounded-t-md border-x border-t ${
                          isActive
                            ? "border-sky-500 bg-slate-900 text-sky-100"
                            : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Description */}
                <div className="text-[11px] text-slate-300 space-y-1 pb-3">
                  <p>
                    {
                      themeOptions.find((t) => t.id === theme)
                        ?.description
                    }
                  </p>
                  <p className="text-slate-500">
                    Theme changes apply instantly and persist per device
                    (stored in your browser).
                  </p>
                </div>

                {/* Custom theme editor (only when Custom is active) */}
                {theme === "custom" && (
                  <>
                    {/* Custom palette editor */}
                    <div className="border-t border-slate-800 pt-3 mt-1 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-xs font-semibold">
                            Custom Theme Palette
                          </h3>
                          <p className="text-[10px] text-slate-400">
                            Edit the core Lab panel colors. Values should be
                            CSS-valid colors (e.g.{" "}
                            <code>#0f172a</code>).
                          </p>
                        </div>
                        <button
                          onClick={resetCustomPalette}
                          className="px-2 py-1 text-[10px] rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800"
                        >
                          Reset to Default
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        {/* Idea Builder group */}
                        <div className="border border-slate-800 rounded-md px-3 py-2 bg-slate-950/60">
                          <p className="font-semibold text-slate-200 mb-1">
                            Idea Builder Panel
                          </p>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Body Background
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.builderBg}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "builderBg",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Body Border
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.builderBorder}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "builderBorder",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Header Background
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.builderHeaderBg}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "builderHeaderBg",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Header Border
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.builderHeaderBorder}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "builderHeaderBorder",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>

                        {/* Analysis Panel group */}
                        <div className="border border-slate-800 rounded-md px-3 py-2 bg-slate-950/60">
                          <p className="font-semibold text-slate-200 mb-1">
                            Analysis Panel
                          </p>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Body Background
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.analysisBg}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "analysisBg",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Body Border
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.analysisBorder}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "analysisBorder",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Header Background
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.analysisHeaderBg}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "analysisHeaderBg",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-slate-400">
                                Header Border
                              </label>
                              <input
                                type="text"
                                className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                                value={effectivePalette.analysisHeaderBorder}
                                onChange={(e) =>
                                  updateCustomColor(
                                    "analysisHeaderBorder",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Saved custom themes list */}
                    <div className="border-t border-slate-800 pt-3 mt-1 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-xs font-semibold">
                            Saved Custom Themes
                          </h3>
                          <p className="text-[10px] text-slate-400">
                            Save the current colors as a named theme and
                            quickly switch between presets.
                          </p>
                        </div>
                      </div>

                      {/* Existing profiles */}
                      {savedCustomThemes.length === 0 ? (
                        <p className="text-[11px] text-slate-500 mb-3">
                          No custom themes saved yet.
                        </p>
                      ) : (
                        <div className="mb-3 space-y-1.5 text-[11px]">
                          {savedCustomThemes.map((profile) => {
                            const isActive =
                              profile.id === activeCustomThemeId;
                            return (
                              <div
                                key={profile.id}
                                className={`flex items-center justify-between px-2 py-1 rounded border ${
                                  isActive
                                    ? "border-sky-500 bg-slate-900"
                                    : "border-slate-800 bg-slate-950/60"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-200 font-medium">
                                    {profile.name}
                                  </span>
                                  {isActive && (
                                    <span className="text-[10px] text-sky-400">
                                      (active)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      loadCustomThemeProfile(profile.id)
                                    }
                                    className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px]"
                                  >
                                    Use
                                  </button>
                                  <button
                                    onClick={() =>
                                      deleteCustomThemeProfile(profile.id)
                                    }
                                    className="px-2 py-0.5 rounded-md border border-red-800/70 bg-red-900/20 hover:bg-red-900/40 text-[10px] text-red-300"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Save-as-new row */}
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center text-[11px]">
                        <input
                          type="text"
                          placeholder="New theme name (e.g. Quiet Lab)"
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1"
                          value={newProfileName}
                          onChange={(e) =>
                            setNewProfileName(e.target.value)
                          }
                        />
                        <button
                          onClick={handleSaveCustomProfile}
                          className="px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-[11px] font-semibold disabled:opacity-60"
                          disabled={!newProfileName.trim()}
                        >
                          Save as New Theme
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* NEW: Lab center panel order */}
            <div className="border border-slate-800 rounded-lg bg-slate-900/40 px-4 py-3">
              <h2 className="text-sm font-semibold mb-1">
                Lab Center Panel Order
              </h2>
              <p className="text-[11px] text-slate-400 mb-2">
                Reorder the main Lab panels. This controls the vertical order of
                sections in the Strategy Lab center console.
              </p>

              <div className="space-y-1.5 text-[11px]">
                {panelOrder.map((id, index) => (
                  <div
                    key={id}
                    className="flex items-center justify-between px-2 py-1 rounded border border-slate-800 bg-slate-950/60"
                  >
                    <span className="text-slate-200">
                      {centerPanelLabels[id]}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => movePanel(index, "up")}
                        disabled={index === 0}
                        className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => movePanel(index, "down")}
                        disabled={index === panelOrder.length - 1}
                        className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-[10px] text-slate-500">
                Changes are saved automatically. Reload the Lab page to see the
                updated order if it&apos;s already open.
              </p>
            </div>

            {/* Placeholder for future UI options */}
            <div className="border border-slate-800 rounded-lg bg-slate-900/40 px-4 py-3">
              <h2 className="text-sm font-semibold mb-1">
                Layout &amp; Density (coming soon)
              </h2>
              <p className="text-[11px] text-slate-400">
                Here we&apos;ll let you adjust font size, spacing, and other
                cockpit layout details once more of the site is built.
              </p>
            </div>
          </section>
        )}

        {activeTab === "data" && (
          <section className="border border-slate-800 rounded-lg bg-slate-900/40 px-4 py-3 text-[11px] text-slate-300">
            <h2 className="text-sm font-semibold mb-1">
              Data Provider Settings (placeholder)
            </h2>
            <p className="text-slate-400">
              This is a stub for configuring Polygon, FMP, Fintel, Finnhub,
              and other providers. We&apos;ll wire this up when we hook
              TradePopping into live data.
            </p>
          </section>
        )}

        {activeTab === "security" && (
          <section className="border border-slate-800 rounded-lg bg-slate-900/40 px-4 py-3 text-[11px] text-slate-300">
            <h2 className="text-sm font-semibold mb-1">
              Security &amp; Access (placeholder)
            </h2>
            <p className="text-slate-400">
              This area will manage login, API key storage strategy, and
              future multi-device access rules. For now, access is still
              controlled via your SSO and backend config.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;