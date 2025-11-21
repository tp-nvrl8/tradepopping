import React, { useEffect, useMemo, useState } from "react";
import { useUiSettings } from "../config/UiSettingsContext";
import { useUiScopedTokens } from "../config/useUiScopedTokens";
import { UI_SCOPES, type UiScopeDefinition } from "../config/uiScopes";
import type { UiScopeSettings } from "../config/UiSettingsTypes";
import { DEFAULT_THEME_TOKENS } from "../config/uiThemeCore";

const SettingsPage: React.FC = () => {
  const {
    uiSettings,
    getScopeSettings,
    updateScopeSettings,
    resetAll,
    themeProfiles,
    activeThemeId,
    createThemeProfile,
    setActiveTheme,
  } = useUiSettings();

  const themeList = useMemo(
    () => Object.values(themeProfiles ?? {}),
    [themeProfiles]
  );

  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    if (activeThemeId && themeProfiles[activeThemeId]) return activeThemeId;
    const first = Object.values(themeProfiles ?? {})[0];
    return first ? first.id : "";
  });

  useEffect(() => {
    if (selectedThemeId && themeProfiles[selectedThemeId]) return;
    if (activeThemeId && themeProfiles[activeThemeId]) {
      setSelectedThemeId(activeThemeId);
      return;
    }
    const first = Object.values(themeProfiles ?? {})[0];
    setSelectedThemeId(first ? first.id : "");
  }, [activeThemeId, selectedThemeId, themeProfiles]);

  const selectedTheme = selectedThemeId
    ? themeProfiles[selectedThemeId]
    : activeThemeId
    ? themeProfiles[activeThemeId]
    : undefined;

  const themePreviewTokens = useMemo(() => {
    const base = DEFAULT_THEME_TOKENS;
    const overrides = selectedTheme?.tokens ?? {};
    return {
      ...base,
      ...overrides,
    };
  }, [selectedTheme]);

  const activeTheme = activeThemeId ? themeProfiles[activeThemeId] : undefined;

  // ---- Page + region selection ----

  const pageScopes = useMemo(
    () => UI_SCOPES.filter((s) => s.type === "page"),
    []
  );

  const [selectedPageId, setSelectedPageId] = useState<string>("page:lab");

  const regionScopes = useMemo(
    () =>
      UI_SCOPES.filter(
        (s) => s.type === "region" && s.parent === selectedPageId
      ),
    [selectedPageId]
  );

  const [selectedRegionId, setSelectedRegionId] = useState<string | "none">(
    "none"
  );

  // Active scope is either the selected region (if any) or the selected page.
  const activeScopeId: string =
    selectedRegionId !== "none" && regionScopes.length > 0
      ? selectedRegionId
      : selectedPageId;

  const activeScopeDef: UiScopeDefinition | undefined = UI_SCOPES.find(
    (s) => s.id === activeScopeId
  );

  const scopeSettings: UiScopeSettings | undefined =
    getScopeSettings(activeScopeId);

  const isCustomized = !!scopeSettings;
  const themeId = scopeSettings?.themeId ?? "default";
  const borderOverride = scopeSettings?.overrides?.border ?? "";

  const handleNewThemeFromCurrent = () => {
    const name = window.prompt("Name for new theme profile?");
    if (!name) return;

    const newId = createThemeProfile({
      name,
      baseFromId: selectedThemeId || activeThemeId || undefined,
    });

    setSelectedThemeId(newId);
  };

  const handleSaveAs = () => {
    handleNewThemeFromCurrent();
  };

  // ---- Handlers ----

  const handleToggleCustomize = (checked: boolean) => {
    if (!checked) {
      // Revert to inherited/global defaults by removing this scope entry
      updateScopeSettings(activeScopeId, () => undefined);
      return;
    }

    // Create or ensure a scope entry with default theme if missing
    updateScopeSettings(activeScopeId, (prev) => {
      if (prev) return prev;
      return {
        themeId: "default",
      };
    });
  };

  const handleThemeIdChange = (value: string) => {
    updateScopeSettings(activeScopeId, (prev) => {
      const base: UiScopeSettings = prev ?? {
        themeId: "default",
      };
      return {
        ...base,
        themeId: value || "default",
      };
    });
  };

  const handleBorderOverrideChange = (value: string) => {
    updateScopeSettings(activeScopeId, (prev) => {
      const base: UiScopeSettings = prev ?? {
        themeId: "default",
      };
      const nextOverrides = { ...(base.overrides ?? {}) };

      if (value.trim()) {
        nextOverrides.border = value.trim();
      } else {
        delete nextOverrides.border;
      }

      return {
        ...base,
        overrides: Object.keys(nextOverrides).length
          ? nextOverrides
          : undefined,
      };
    });
  };

  const handleResetAll = () => {
    if (
      window.confirm(
        "Reset all UI settings to defaults? This clears all custom scopes."
      )
    ) {
      resetAll();
    }
  };

  // ---- Live preview tokens ----

  const orderedScopesForPreview = useMemo(() => {
    const scopes: string[] = ["global", selectedPageId];
    if (selectedRegionId !== "none") {
      scopes.push(selectedRegionId);
    }
    return scopes;
  }, [selectedPageId, selectedRegionId]);

  const previewTokens = useUiScopedTokens(orderedScopesForPreview);

  return (
    <div className="p-4 flex flex-col gap-4 text-sm text-slate-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">UI Settings</h1>
          <p className="text-xs text-slate-400">
            Configure global defaults, per-page themes, and lab region
            highlights.
          </p>
        </div>
        <button
          onClick={handleResetAll}
          className="px-3 py-1.5 rounded-md border border-rose-600 bg-rose-600/10 text-rose-100 text-xs hover:bg-rose-600/20"
        >
          Reset all to defaults
        </button>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold">Theme Lab</h2>
            <p className="text-[11px] text-slate-400">
              Create and manage named themes for the lab. The active theme applies
              as the global default.
            </p>
          </div>
          {activeTheme && (
            <span className="px-2 py-1 rounded-md border border-sky-500 text-[11px] text-sky-200 bg-sky-500/10">
              Active: {activeTheme.name}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Theme Profiles
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleNewThemeFromCurrent}
                  className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-xs hover:bg-slate-700"
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={handleSaveAs}
                  className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-xs hover:bg-slate-700"
                >
                  Save As
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {themeList.map((profile) => (
                <div
                  key={profile.id}
                  className={`rounded-md border px-3 py-2 bg-slate-950/60 border-slate-700/80 hover:border-sky-600 transition-colors ${
                    selectedThemeId === profile.id ? "ring-1 ring-sky-600" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-slate-100">
                        {profile.name}
                      </div>
                      <div className="text-[11px] text-slate-400">ID: {profile.id}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedThemeId(profile.id)}
                        className="px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800 text-[11px] hover:bg-slate-700"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTheme(profile.id)}
                        disabled={profile.id === activeThemeId}
                        className={`px-2.5 py-1 rounded-md border text-[11px] ${
                          profile.id === activeThemeId
                            ? "border-sky-700 bg-sky-700/30 text-sky-100 cursor-default"
                            : "border-sky-600 bg-sky-600/20 text-sky-100 hover:bg-sky-600/30"
                        }`}
                      >
                        {profile.id === activeThemeId ? "Active" : "Use"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {themeList.length === 0 && (
                <div className="text-[11px] text-slate-400">
                  No themes yet. Click "New" to create one.
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Theme Preview
            </div>
            <div
              className="rounded-md border px-3 py-3 text-xs"
              style={{
                background: themePreviewTokens.surface,
                borderColor: themePreviewTokens.border,
                color: themePreviewTokens.textPrimary,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">
                  {selectedTheme?.name ?? "No theme selected"}
                </span>
                <span className="text-[11px] text-slate-300">
                  border: {themePreviewTokens.border}
                </span>
              </div>
              <p className="text-[11px] text-slate-200">
                This card previews the selected theme’s surface, border, and text
                colors.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scope selection row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Page selector */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-xs uppercase tracking-wide text-slate-400">
              UI Settings for Page
            </span>
          </div>
          <select
            value={selectedPageId}
            onChange={(e) => {
              const newPage = e.target.value;
              setSelectedPageId(newPage);
              setSelectedRegionId("none");
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {pageScopes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {regionScopes.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs uppercase tracking-wide text-slate-400">
                  UI Component Settings for
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRegionId("none")}
                  className="text-[11px] text-sky-400 hover:underline"
                >
                  Use page-level only
                </button>
              </div>
              <select
                value={selectedRegionId}
                onChange={(e) =>
                  setSelectedRegionId(
                    e.target.value === "none" ? "none" : e.target.value
                  )
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="none">Entire page (no specific region)</option>
                {regionScopes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-xs uppercase tracking-wide text-slate-400">
              Theme Preview
            </span>
            <span className="text-[11px] text-slate-500">
              Scopes: {orderedScopesForPreview.join(" → ")}
            </span>
          </div>
          <div
            className="rounded-md border px-3 py-3 text-xs"
            style={{
              background: previewTokens.surface,
              borderColor: previewTokens.border,
              color: previewTokens.textPrimary,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">
                {activeScopeDef?.label ?? activeScopeId}
              </span>
              <span className="text-[11px] text-slate-300">
                border: {previewTokens.border}
              </span>
            </div>
            <p className="text-[11px] text-slate-200">
              This card simulates a panel inside the selected page/region using
              the merged theme tokens.
            </p>
          </div>
        </div>
      </div>

      {/* Scope-specific settings */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="font-semibold text-xs uppercase tracking-wide text-slate-400">
              Scope Settings
            </span>
            <div className="text-[11px] text-slate-500">
              Active scope:{" "}
              <span className="text-sky-300">
                {activeScopeDef?.label ?? activeScopeId}
              </span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={isCustomized}
              onChange={(e) => handleToggleCustomize(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950"
            />
            <span>Customize this scope (otherwise inherit defaults)</span>
          </label>
        </div>

        {!isCustomized && (
          <p className="text-[11px] text-slate-500 mb-2">
            This scope currently uses inherited settings from its parent and the
            global default. Turn on &quot;Customize this scope&quot; to override
            theme or tokens here.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Theme selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Theme ID
            </label>
            <input
              type="text"
              value={themeId}
              disabled={!isCustomized}
              onChange={(e) => handleThemeIdChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
              placeholder="default, slate, labSoft, etc."
            />
            <p className="text-[11px] text-slate-500">
              For now this is a free-form theme identifier. In a later phase we
              can wire this to a Theme Lab picker.
            </p>
          </div>

          {/* Border override */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Border Color Override
            </label>
            <input
              type="text"
              value={borderOverride}
              disabled={!isCustomized}
              onChange={(e) => handleBorderOverrideChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
              placeholder="#f97316 or leave blank"
            />
            <p className="text-[11px] text-slate-500">
              If set, this overrides the merged border token just for this
              scope. Clear it to fall back to inherited theme.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
