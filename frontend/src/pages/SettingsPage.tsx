import React, { useEffect, useMemo, useState } from "react";
import SettingsSectionCard from "../settings/SettingsSectionCard";
import {
  DEFAULT_CUSTOM_PALETTE,
  SemanticTokens,
  usePageTheme,
  useTheme,
  useThemedTokens,
} from "../config/ThemeContext";

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

type PaletteFieldKey = keyof typeof DEFAULT_CUSTOM_PALETTE;

const SettingsPage: React.FC = () => {
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
    tokens,
    activePageThemeId,
  } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTabId>("ui");
  const [centerOrder, setCenterOrder] =
    useState<CenterPanelId[]>(defaultCenterOrder);

  const palette = customPalette ?? DEFAULT_CUSTOM_PALETTE;
  const [customName, setCustomName] = useState("");

  const [pageThemeEnabled, setPageThemeEnabled] = useState(false);
  const [pageOverrides, setPageOverrides] = useState<Partial<SemanticTokens>>({
    accent: tokens.accent,
    surface: tokens.surfaceMuted,
    textPrimary: tokens.textPrimary,
  });

  const [componentOverrides, setComponentOverrides] = useState<
    Partial<SemanticTokens>
  >({
    surface: tokens.surfaceMuted,
    border: tokens.border,
  });

  const componentPreviewTokens = useThemedTokens(componentOverrides);

  // Apply page-level theme to the document while this page is active
  const pageThemeConfig = useMemo<Partial<SemanticTokens> | null>(
    () => (pageThemeEnabled ? pageOverrides : null),
    [pageOverrides, pageThemeEnabled]
  );
  usePageTheme("settings-shell", pageThemeConfig);

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

  useEffect(() => {
    // Keep defaults aligned to the current base theme when users toggle away
    setPageOverrides((prev) => ({
      ...prev,
      accent: prev.accent ?? tokens.accent,
      surface: prev.surface ?? tokens.surfaceMuted,
      textPrimary: prev.textPrimary ?? tokens.textPrimary,
    }));
    setComponentOverrides((prev) => ({
      ...prev,
      surface: prev.surface ?? tokens.surfaceMuted,
      border: prev.border ?? tokens.border,
    }));
  }, [tokens]);

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

  const handlePaletteChange = (key: PaletteFieldKey, value: string) => {
    setCustomPalette({
      ...palette,
      [key]: value,
    });
  };

  const renderPaletteInput = (
    key: PaletteFieldKey,
    label: string,
    description?: string
  ) => (
    <label className="flex items-center gap-3 text-xs text-[var(--tp-text-primary)]">
      <input
        type="color"
        className="h-9 w-14 rounded border border-[var(--tp-border)] bg-[var(--tp-surface-muted)]"
        value={palette[key]}
        onChange={(e) => handlePaletteChange(key, e.target.value)}
      />
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">{label}</span>
        {description && (
          <span className="text-[11px] text-[var(--tp-text-secondary)]">
            {description}
          </span>
        )}
      </div>
    </label>
  );

  const renderThemeControls = () => (
    <SettingsSectionCard
      id="theme"
      title="Lab Theme"
      description="Pick a preset, apply a page-specific accent, or edit/save custom palettes."
    >
      <div className="flex flex-col gap-4 text-xs text-[var(--tp-text-primary)]">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className="text-[var(--tp-accent)]"
              checked={theme === "slate"}
              onChange={() => setTheme("slate")}
            />
            <span>Slate (default)</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className="text-[var(--tp-accent)]"
              checked={theme === "trek-industrial"}
              onChange={() => setTheme("trek-industrial")}
            />
            <span>Trek Industrial</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className="text-[var(--tp-accent)]"
              checked={theme === "delta-flyer"}
              onChange={() => setTheme("delta-flyer")}
            />
            <span>Delta Flyer</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className="text-[var(--tp-accent)]"
              checked={theme === "custom"}
              onChange={() => setTheme("custom")}
            />
            <span>Custom</span>
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-[var(--tp-border)] bg-[var(--tp-surface-muted)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Page accent overrides</p>
              <p className="text-[11px] text-[var(--tp-text-secondary)]">
                Apply a one-off accent/surface for the Settings page without touching the global preset.
              </p>
            </div>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={pageThemeEnabled}
                onChange={(e) => setPageThemeEnabled(e.target.checked)}
              />
              <span>{pageThemeEnabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="text-[var(--tp-text-secondary)]">Accent</span>
              <input
                type="color"
                value={pageOverrides.accent ?? tokens.accent}
                onChange={(e) =>
                  setPageOverrides((prev) => ({ ...prev, accent: e.target.value }))
                }
                className="h-9 w-full rounded border border-[var(--tp-border)] bg-[var(--tp-surface)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px]">
              <span className="text-[var(--tp-text-secondary)]">Surface</span>
              <input
                type="color"
                value={pageOverrides.surface ?? tokens.surfaceMuted}
                onChange={(e) =>
                  setPageOverrides((prev) => ({
                    ...prev,
                    surface: e.target.value,
                  }))
                }
                className="h-9 w-full rounded border border-[var(--tp-border)] bg-[var(--tp-surface)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px]">
              <span className="text-[var(--tp-text-secondary)]">Primary text</span>
              <input
                type="color"
                value={pageOverrides.textPrimary ?? tokens.textPrimary}
                onChange={(e) =>
                  setPageOverrides((prev) => ({
                    ...prev,
                    textPrimary: e.target.value,
                  }))
                }
                className="h-9 w-full rounded border border-[var(--tp-border)] bg-[var(--tp-surface)]"
              />
            </label>
          </div>
          <p className="text-[11px] text-[var(--tp-text-secondary)]">
            Page overrides are layered on top of your selected preset while this screen is mounted. Active page theme: {activePageThemeId ?? "none"}.
          </p>
        </div>
      </div>
    </SettingsSectionCard>
  );

  const renderCustomThemeEditor = () => (
    <SettingsSectionCard
      id="custom-theme"
      title="Custom palette & profiles"
      description="Tune the Lab variables, save multiple profiles, and load/delete them per session."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-md border border-[var(--tp-border)] bg-[var(--tp-surface-muted)] p-3">
          <p className="text-xs font-semibold text-[var(--tp-text-primary)]">
            Palette editor
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {renderPaletteInput("builderBg", "Builder background")}
            {renderPaletteInput("builderBorder", "Builder border")}
            {renderPaletteInput("builderHeaderBg", "Builder header", "Also used for muted surfaces.")}
            {renderPaletteInput("builderHeaderBorder", "Builder header border")}
            {renderPaletteInput("analysisBg", "Analysis background")}
            {renderPaletteInput("analysisBorder", "Analysis border")}
            {renderPaletteInput("analysisHeaderBg", "Analysis header")}
            {renderPaletteInput("analysisHeaderBorder", "Analysis header border", "Used as accent for custom theme.")}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-[var(--tp-border)] bg-[var(--tp-surface-muted)] p-3">
          <p className="text-xs font-semibold text-[var(--tp-text-primary)]">Profiles</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Name this palette"
              className="flex-1 rounded border border-[var(--tp-border)] bg-[var(--tp-surface)] px-2 py-1 text-[var(--tp-text-primary)]"
            />
            <button
              type="button"
              onClick={() => {
                saveCustomThemeProfile(customName);
                setCustomName("");
              }}
              className="rounded border border-[var(--tp-border)] bg-[var(--tp-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--tp-surface)]"
            >
              Save
            </button>
          </div>
          <ul className="space-y-2 text-xs text-[var(--tp-text-primary)]">
            {savedCustomThemes.map((profile) => (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-2 rounded border border-[var(--tp-border)] bg-[var(--tp-surface)] px-2 py-1.5"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{profile.name}</span>
                  <span className="text-[11px] text-[var(--tp-text-secondary)]">
                    {profile.id === activeCustomThemeId ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-[var(--tp-border)] px-2 py-1 text-[11px] text-[var(--tp-text-primary)] hover:border-[var(--tp-accent)]"
                    onClick={() => loadCustomThemeProfile(profile.id)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--tp-danger)] px-2 py-1 text-[11px] text-[var(--tp-danger)]"
                    onClick={() => deleteCustomThemeProfile(profile.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
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
              className="flex items-center justify-between gap-2 rounded bg-[var(--tp-surface-muted)] border border-[var(--tp-border)] px-2 py-1.5"
            >
              <span className="text-[var(--tp-text-primary)]">{labelFor(id)}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="px-1.5 py-0.5 text-[11px] rounded border border-[var(--tp-border)] bg-[var(--tp-surface)] hover:border-[var(--tp-accent)]"
                  onClick={() => movePanel(id, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1.5 py-0.5 text-[11px] rounded border border-[var(--tp-border)] bg-[var(--tp-surface)] hover:border-[var(--tp-accent)]"
                  onClick={() => movePanel(id, 1)}
                  disabled={index === centerOrder.length - 1}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-[var(--tp-text-secondary)] mt-2">
          Changes are saved in your browser and used the next time the Lab screen loads.
        </p>
      </SettingsSectionCard>
    );
  };

  const renderComponentPreview = () => {
    return (
      <SettingsSectionCard
        id="component-theme"
        title="Component-level theming"
        description="Apply local overrides to a single component while inheriting global + page tokens."
      >
        <div className="grid gap-4 md:grid-cols-[2fr,1fr] items-start">
          <div
            className="rounded-md p-4 shadow-md"
            style={{
              background: componentPreviewTokens.surface,
              border: `1px solid ${componentPreviewTokens.border}`,
              color: componentPreviewTokens.textPrimary,
            }}
          >
            <p className="text-xs font-semibold">Preview widget</p>
            <p
              className="text-[11px] mt-1"
              style={{ color: componentPreviewTokens.textSecondary }}
            >
              This block inherits global + page tokens, then applies component overrides.
            </p>
            <button
              className="mt-3 rounded px-3 py-1 text-[11px] font-semibold"
              style={{
                background: componentPreviewTokens.accent,
                color: componentPreviewTokens.surface,
                border: `1px solid ${componentPreviewTokens.border}`,
              }}
            >
              Accent CTA
            </button>
          </div>

          <div className="space-y-2 text-[11px] text-[var(--tp-text-primary)]">
            <label className="flex flex-col gap-1">
              <span className="text-[var(--tp-text-secondary)]">Component surface</span>
              <input
                type="color"
                value={componentOverrides.surface ?? tokens.surfaceMuted}
                onChange={(e) =>
                  setComponentOverrides((prev) => ({
                    ...prev,
                    surface: e.target.value,
                  }))
                }
                className="h-9 w-full rounded border border-[var(--tp-border)] bg-[var(--tp-surface)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--tp-text-secondary)]">Component border</span>
              <input
                type="color"
                value={componentOverrides.border ?? tokens.border}
                onChange={(e) =>
                  setComponentOverrides((prev) => ({
                    ...prev,
                    border: e.target.value,
                  }))
                }
                className="h-9 w-full rounded border border-[var(--tp-border)] bg-[var(--tp-surface)]"
              />
            </label>
            <p className="text-[11px] text-[var(--tp-text-secondary)]">
              Use this pattern in components to opt into local overrides via <code>useThemedTokens</code>.
            </p>
          </div>
        </div>
      </SettingsSectionCard>
    );
  };

  const renderUiTab = () => (
    <div className="space-y-4">
      {renderThemeControls()}
      {renderCustomThemeEditor()}
      {renderComponentPreview()}
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
        <p className="text-xs text-[var(--tp-text-secondary)]">
          Later we&apos;ll add connection status, API keys, and per-provider options here.
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
        <p className="text-xs text-[var(--tp-text-secondary)]">
          For now, security is mainly handled at the front door (NGINX + SSO). This section will grow as we add more fine-grained controls.
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
    <div className="min-h-screen bg-[var(--tp-surface)] text-[var(--tp-text-primary)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--tp-border)] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-[var(--tp-text-secondary)]">
            Tune the cockpit visuals, layout, and connections.
          </p>
        </div>
        <div className="flex flex-col text-[11px] text-[var(--tp-text-secondary)]">
          <span>Active theme: {theme}</span>
          <span>Page theme: {activePageThemeId ?? "inherit"}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center overflow-y-auto">
        <div className="w-full max-w-5xl px-4 py-3 space-y-4">
          {/* Tabs */}
          <nav className="flex gap-2 text-xs border-b border-[var(--tp-border)] pb-2 mb-2">
            <button
              type="button"
              onClick={() => setActiveTab("ui")}
              className={`px-3 py-1.5 rounded-t-md border-b-2 ${
                activeTab === "ui"
                  ? "border-[var(--tp-accent)] text-[var(--tp-accent)]"
                  : "border-transparent text-[var(--tp-text-secondary)] hover:text-[var(--tp-text-primary)]"
              }`}
            >
              UI Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={`px-3 py-1.5 rounded-t-md border-b-2 ${
                activeTab === "data"
                  ? "border-[var(--tp-accent)] text-[var(--tp-accent)]"
                  : "border-transparent text-[var(--tp-text-secondary)] hover:text-[var(--tp-text-primary)]"
              }`}
            >
              Data Providers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`px-3 py-1.5 rounded-t-md border-b-2 ${
                activeTab === "security"
                  ? "border-[var(--tp-accent)] text-[var(--tp-accent)]"
                  : "border-transparent text-[var(--tp-text-secondary)] hover:text-[var(--tp-text-primary)]"
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
