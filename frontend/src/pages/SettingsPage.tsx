import React, { useMemo, useState } from 'react';
import { useUiSettings } from '../config/UiSettingsContext';
import { useUiScopedTokens } from '../config/useUiScopedTokens';
import { UI_SCOPES, type UiScopeDefinition } from '../config/uiScopes';
import type { UiScopeSettings } from '../config/UiSettingsTypes';

const SettingsPage: React.FC = () => {
  const {
    uiSettings,
    getScopeSettings,
    updateScopeSettings,
    resetAll,
    activeThemeId,
    themeProfiles,
    updateThemeProfile,
  } = useUiSettings();

  void uiSettings;

  // ---- Page + region selection ----

  const pageScopes = useMemo(() => UI_SCOPES.filter((s) => s.type === 'page'), []);

  const [selectedPageId, setSelectedPageId] = useState<string>('page:lab');

  const regionScopes = useMemo(
    () => UI_SCOPES.filter((s) => s.type === 'region' && s.parent === selectedPageId),
    [selectedPageId],
  );

  const [selectedRegionId, setSelectedRegionId] = useState<string | 'none'>('none');

  // Active scope is either the selected region (if any) or the selected page.
  const activeScopeId: string =
    selectedRegionId !== 'none' && regionScopes.length > 0 ? selectedRegionId : selectedPageId;

  const activeScopeDef: UiScopeDefinition | undefined = UI_SCOPES.find(
    (s) => s.id === activeScopeId,
  );

  const scopeSettings: UiScopeSettings | undefined = getScopeSettings(activeScopeId);

  const isCustomized = !!scopeSettings;
  const borderOverride = scopeSettings?.overrides?.border ?? '';

  const activeProfile = themeProfiles?.[activeThemeId];
  const baseTokens = activeProfile?.tokens ?? {};

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
        themeId: 'default',
      };
    });
  };

  const handleBorderOverrideChange = (value: string) => {
    updateScopeSettings(activeScopeId, (prev) => {
      const base: UiScopeSettings = prev ?? {
        themeId: 'default',
      };
      const nextOverrides = { ...(base.overrides ?? {}) };

      if (value.trim()) {
        nextOverrides.border = value.trim();
      } else {
        delete nextOverrides.border;
      }

      return {
        ...base,
        overrides: Object.keys(nextOverrides).length ? nextOverrides : undefined,
      };
    });
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all UI settings to defaults? This clears all custom scopes.')) {
      resetAll();
    }
  };

  const handleBaseTokenChange = (
    key: 'surface' | 'border' | 'accent' | 'textPrimary' | 'textSecondary',
    value: string,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    updateThemeProfile(activeThemeId, {
      tokens: { [key]: trimmed },
    });
  };

  // ---- Live preview tokens ----

  const orderedScopesForPreview = useMemo(() => {
    const scopes: string[] = ['global', selectedPageId];
    if (selectedRegionId !== 'none') {
      scopes.push(selectedRegionId);
    }
    return scopes;
  }, [selectedPageId, selectedRegionId]);

  const previewTokens = useUiScopedTokens(orderedScopesForPreview);

  return (
    <div className="p-3 flex flex-col gap-3 text-sm text-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Lab UI Console</h1>
          <p className="text-[11px] text-slate-400">
            Configure global defaults, per-page themes, and lab region highlights.
          </p>
        </div>
        <button
          onClick={handleResetAll}
          className="px-3 py-1.5 rounded-md border border-rose-600 bg-rose-600/10 text-rose-100 text-xs hover:bg-rose-600/20"
        >
          Reset all to defaults
        </button>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Base Lab Palette
            </h2>
            <p className="text-[11px] text-slate-500">
              Global base colors used by all pages. Page and region overrides sit on top of this.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
          {['surface', 'border', 'accent', 'textPrimary', 'textSecondary'].map((key) => (
            <div key={key} className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {key}
              </label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={(baseTokens as any)[key] ?? ''}
                onChange={(e) =>
                  handleBaseTokenChange(
                    key as 'surface' | 'border' | 'accent' | 'textPrimary' | 'textSecondary',
                    e.target.value,
                  )
                }
                placeholder="#0b1220"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scope selection row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              setSelectedRegionId('none');
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
                  onClick={() => setSelectedRegionId('none')}
                  className="text-[11px] text-sky-400 hover:underline"
                >
                  Use page-level only
                </button>
              </div>
              <select
                value={selectedRegionId}
                onChange={(e) =>
                  setSelectedRegionId(e.target.value === 'none' ? 'none' : e.target.value)
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
              Scopes: {orderedScopesForPreview.join(' → ')}
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
              <span className="font-semibold">{activeScopeDef?.label ?? activeScopeId}</span>
              <span className="text-[11px] text-slate-300">border: {previewTokens.border}</span>
            </div>
            <p className="text-[11px] text-slate-200">
              This card simulates a panel inside the selected page/region using the merged theme
              tokens.
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
              Active scope:{' '}
              <span className="text-sky-300">{activeScopeDef?.label ?? activeScopeId}</span>
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
            This scope currently uses inherited settings from its parent and the global default.
            Turn on &quot;Customize this scope&quot; to override theme or tokens here.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
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
              If set, this overrides the merged border token just for this scope. Clear it to fall
              back to inherited theme.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
