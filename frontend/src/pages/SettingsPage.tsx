import React, { useEffect, useState } from "react";
import SettingsSectionCard from "../settings/SettingsSectionCard";
import { useTheme } from "../config/ThemeContext";

// Keep this in sync with LabPage.tsx
type CenterPanelId = "builder" | "indicator" | "filters" | "analysis";

const defaultCenterOrder: CenterPanelId[] = [
  "builder",
  "indicator",
  "filters",
  "analysis",
];

const CENTER_PANEL_STORAGE_KEY = "tp_lab_center_panels_v1";

type SettingsTabId = "ui" | "data" | "security";

const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTabId>("ui");
  const [centerOrder, setCenterOrder] =
    useState<CenterPanelId[]>(defaultCenterOrder);

  // --- Load center panel order (same idea as LabPage) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CENTER_PANEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const allowed: CenterPanelId[] = defaultCenterOrder;

          const valid = parsed.filter(
            (p: unknown): p is CenterPanelId =>
              typeof p === "string" && (allowed as string[]).includes(p)
          );

          const merged: CenterPanelId[] = [
            ...valid,
            ...allowed.filter((p) => !valid.includes(p)),
          ];

          setCenterOrder(merged.length ? merged : defaultCenterOrder);
          return;
        }
      }
      setCenterOrder(defaultCenterOrder);
    } catch (e) {
      console.warn("Failed to load center panel order in Settings", e);
      setCenterOrder(defaultCenterOrder);
    }
  }, []);

  // --- Persist center panel order ---
  useEffect(() => {
    try {
      localStorage.setItem(
        CENTER_PANEL_STORAGE_KEY,
        JSON.stringify(centerOrder)
      );
    } catch (e) {
      console.warn("Failed to save center panel order in Settings", e);
    }
  }, [centerOrder]);

  // --- Center order helpers ---
  const movePanel = (id: CenterPanelId, direction: -1 | 1) => {
    setCenterOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;

      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;

      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, item);
      return copy;
    });
  };

  // --- Render helpers ---

  const renderThemeControls = () => (
    <SettingsSectionCard
      id="theme"
      title="Lab Theme"
      description="Pick a preset or use Custom to prepare for your own color set."
    >
      <div className="flex flex-col gap-2 text-xs text-slate-200">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            className="text-sky-500"
            checked={theme === "slate"}
            onChange={() => setTheme("slate")}
          />
          <span>Slate (default)</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            className="text-sky-500"
            checked={theme === "trek-industrial"}
            onChange={() => setTheme("trek-industrial")}
          />
          <span>Trek Industrial</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            className="text-sky-500"
            checked={theme === "delta-flyer"}
            onChange={() => setTheme("delta-flyer")}
          />
          <span>Delta Flyer</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            className="text-sky-500"
            checked={theme === "custom"}
            onChange={() => setTheme("custom")}
          />
          <span>Custom (future color editor)</span>
        </label>

        <p className="text-[11px] text-slate-400 mt-1">
          Theme choice is saved locally and applied instantly across the Lab.
        </p>
      </div>
    </SettingsSectionCard>
  );

  const renderLabLayoutControls = () => {
    const labelFor = (id: CenterPanelId): string => {
      switch (id) {
        case "builder":
          return "Idea Builder";
        case "indicator":
          return "Indicator Builder";
        case "filters":
          return "Filter Composer";
        case "analysis":
          return "Analysis Panel";
        default:
          return id;
      }
    };

    return (
      <SettingsSectionCard
        id="lab-layout"
        title="Lab Center Layout"
        description="Change the order of the main Lab panels. This is reflected on the Lab page."
      >
        <ul className="space-y-1 text-xs">
          {centerOrder.map((id, index) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 rounded bg-slate-900/60 border border-slate-700 px-2 py-1.5"
            >
              <span className="text-slate-200">{labelFor(id)}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="px-1.5 py-0.5 text-[11px] rounded border border-slate-700 bg-slate-900 hover:bg-slate-800"
                  onClick={() => movePanel(id, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1.5 py-0.5 text-[11px] rounded border border-slate-700 bg-slate-900 hover:bg-slate-800"
                  onClick={() => movePanel(id, 1)}
                  disabled={index === centerOrder.length - 1}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-400 mt-2">
          Changes are saved in your browser and used the next time the Lab
          screen loads.
        </p>
      </SettingsSectionCard>
    );
  };

  const renderUiTab = () => (
    <div className="space-y-4">
      {renderThemeControls()}
      {renderLabLayoutControls()}
    </div>
  );

  const renderDataTab = () => (
    <div className="space-y-4">
      <SettingsSectionCard
        id="data-providers"
        title="Data Providers"
        description="Configure Polygon, Finnhub, Fintel, FMP, etc. (stub for now)."
      >
        <p className="text-xs text-slate-400">
          Later we&apos;ll add connection status, API keys, and per-provider
          options here.
        </p>
      </SettingsSectionCard>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-4">
      <SettingsSectionCard
        id="security"
        title="Security & Access"
        description="Single-user SSO, passwords, and future access controls."
      >
        <p className="text-xs text-slate-400">
          For now, security is mainly handled at the front door (NGINX + SSO).
          This section will grow as we add more fine-grained controls.
        </p>
      </SettingsSectionCard>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case "ui":
        return renderUiTab();
      case "data":
        return renderDataTab();
      case "security":
        return renderSecurityTab();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-slate-400">
            Tune the cockpit visuals, layout, and connections.
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center overflow-y-auto">
        <div className="w-full max-w-5xl px-4 py-3 space-y-4">
          {/* Tabs */}
          <nav className="flex gap-2 text-xs border-b border-slate-800 pb-2 mb-2">
            <button
              type="button"
              onClick={() => setActiveTab("ui")}
              className={`px-3 py-1.5 rounded-t-md border-b-2 ${
                activeTab === "ui"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              UI Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={`px-3 py-1.5 rounded-t-md border-b-2 ${
                activeTab === "data"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Data Providers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`px-3 py-1.5 rounded-t-md border-b-2 ${
                activeTab === "security"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Security
            </button>
          </nav>

          {renderActiveTab()}
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;