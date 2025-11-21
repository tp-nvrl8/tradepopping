import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  UI_SETTINGS_STORAGE_KEY,
  type UiSettings,
  type UiScopeSettings,
  type ScopeId,
} from "./UiSettingsTypes";
import {
  DEFAULT_THEME_TOKENS,
  type ThemeProfile,
} from "./uiThemeCore";

/**
 * v1: canonical UI settings + theme engine context.
 *
 * Responsibilities:
 * - Hold UI scope settings (global/page/region overrides)
 * - Hold theme profiles (built-in + user-created)
 * - Track activeThemeId
 * - Persist everything to localStorage
 */

const THEME_PROFILES_STORAGE_KEY = "tp_theme_profiles_v2";
const ACTIVE_THEME_ID_STORAGE_KEY = "tp_theme_active_id_v1";

const DEFAULT_THEME_PROFILE_ID = "default-slate";
const PASTEL_THEME_PROFILE_ID = "pastel-lab";

const DEFAULT_THEME_PROFILE: ThemeProfile = {
  id: DEFAULT_THEME_PROFILE_ID,
  name: "Default Slate",
  description: "Built-in slate baseline theme",
  tokens: { ...DEFAULT_THEME_TOKENS },
};

const PASTEL_THEME_PROFILE: ThemeProfile = {
  id: PASTEL_THEME_PROFILE_ID,
  name: "Pastel Lab",
  description: "Soft pastel variant for lab panels",
  tokens: {
    ...DEFAULT_THEME_TOKENS,
    // Make this visibly different so we can see it in the Lab
    surface: "#020617",
    surfaceMuted: "#0b1120",
    border: "#f97316",        // bright orange border
    accent: "#a5b4fc",        // indigo accent
    accentMuted: "#f97316",
    textPrimary: "#f9fafb",
    textSecondary: "#e5e7eb",
  },
};

const DEFAULT_UI_SETTINGS: UiSettings = {
  version: 1,
  scopes: {
    // Global default scope: tie it to the default theme id
    global: {
      themeId: DEFAULT_THEME_PROFILE_ID,
    },
  },
};

export interface UiSettingsContextValue {
  uiSettings: UiSettings;
  themeProfiles: Record<string, ThemeProfile>;
  activeThemeId: string;

  /**
   * Get the settings for a single scope.
   * Returns undefined if the scope has never been customized.
   */
  getScopeSettings: (scopeId: ScopeId) => UiScopeSettings | undefined;

  /**
   * Update a scope’s settings.
   *
   * If the updater returns undefined, the scope entry will be removed
   * (meaning it will inherit from its parents/global again).
   */
  updateScopeSettings: (
    scopeId: ScopeId,
    updater: (prev: UiScopeSettings | undefined) => UiScopeSettings | undefined
  ) => void;

  /**
   * Reset all UI settings back to defaults.
   * Does NOT clear theme profiles, only scope-level customizations.
   */
  resetAll: () => void;

  // Theme profile management for Theme Lab
  createThemeProfile: (input: { name: string; baseFromId?: string }) => string;
  updateThemeProfile: (id: string, patch: Partial<ThemeProfile>) => void;
  deleteThemeProfile: (id: string) => void;
  setActiveTheme: (id: string) => void;
}

const UiSettingsContext = createContext<UiSettingsContextValue | undefined>(
  undefined
);

export const UiSettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [uiSettings, setUiSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);

  const [themeProfiles, setThemeProfiles] = useState<
    Record<string, ThemeProfile>
  >({
    [DEFAULT_THEME_PROFILE_ID]: DEFAULT_THEME_PROFILE,
    [PASTEL_THEME_PROFILE_ID]: PASTEL_THEME_PROFILE,
  });

  const [activeThemeId, setActiveThemeId] = useState<string>(
    DEFAULT_THEME_PROFILE_ID
  );

  // ---- Hydrate from localStorage on first mount ----
  useEffect(() => {
    // UI settings (scopes)
    try {
      const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UiSettings;
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.version === 1 &&
          parsed.scopes &&
          typeof parsed.scopes === "object"
        ) {
          setUiSettings(parsed);
        }
      }
    } catch {
      // ignore parse errors, keep defaults
    }

    // Theme profiles + active theme
    try {
      const themeRaw = window.localStorage.getItem(
        THEME_PROFILES_STORAGE_KEY
      );
      let userProfiles: Record<string, ThemeProfile> = {};

      if (themeRaw) {
        const parsed = JSON.parse(themeRaw) as Record<string, ThemeProfile>;
        if (parsed && typeof parsed === "object") {
          // Only keep user-defined profiles (don’t override built-ins)
          const cleaned: Record<string, ThemeProfile> = {};
          for (const [id, profile] of Object.entries(parsed)) {
            if (
              id !== DEFAULT_THEME_PROFILE_ID &&
              id !== PASTEL_THEME_PROFILE_ID &&
              profile &&
              typeof profile.id === "string" &&
              typeof profile.name === "string" &&
              profile.tokens &&
              typeof profile.tokens === "object"
            ) {
              cleaned[id] = profile;
            }
          }
          userProfiles = cleaned;
        }
      }

      const builtIns: Record<string, ThemeProfile> = {
        [DEFAULT_THEME_PROFILE_ID]: DEFAULT_THEME_PROFILE,
        [PASTEL_THEME_PROFILE_ID]: PASTEL_THEME_PROFILE,
      };

      const loadedProfiles: Record<string, ThemeProfile> = {
        ...builtIns,
        ...userProfiles,
      };

      const activeRaw = window.localStorage.getItem(
        ACTIVE_THEME_ID_STORAGE_KEY
      );
      const nextActive =
        activeRaw && loadedProfiles[activeRaw]
          ? activeRaw
          : DEFAULT_THEME_PROFILE_ID;

      setThemeProfiles(loadedProfiles);
      setActiveThemeId(nextActive);
    } catch {
      // ignore theme profile parse errors
    }
  }, []);

  // ---- Persist UI settings when scopes change ----
  useEffect(() => {
    try {
      window.localStorage.setItem(
        UI_SETTINGS_STORAGE_KEY,
        JSON.stringify(uiSettings)
      );
    } catch {
      // ignore failures (private mode, quota, etc.)
    }
  }, [uiSettings]);

  // ---- Persist theme profiles + active theme ----
  useEffect(() => {
    try {
      window.localStorage.setItem(
        THEME_PROFILES_STORAGE_KEY,
        JSON.stringify(themeProfiles)
      );
      window.localStorage.setItem(
        ACTIVE_THEME_ID_STORAGE_KEY,
        activeThemeId
      );
    } catch {
      // ignore
    }
  }, [themeProfiles, activeThemeId]);

  // ---- Scope helpers ----

  const getScopeSettings = (
    scopeId: ScopeId
  ): UiScopeSettings | undefined => {
    return uiSettings.scopes[scopeId];
  };

  const updateScopeSettings = (
    scopeId: ScopeId,
    updater: (prev: UiScopeSettings | undefined) => UiScopeSettings | undefined
  ) => {
    setUiSettings((prev) => {
      const prevScope = prev.scopes[scopeId];
      const nextScope = updater(prevScope);

      if (!nextScope) {
        // Remove this scope entry entirely (inherit from parent/global)
        const { [scopeId]: _removed, ...restScopes } = prev.scopes;
        return {
          ...prev,
          scopes: restScopes,
        };
      }

      return {
        ...prev,
        scopes: {
          ...prev.scopes,
          [scopeId]: nextScope,
        },
      };
    });
  };

  const resetAll = () => {
    setUiSettings(DEFAULT_UI_SETTINGS);
  };

  // ---- Theme profile helpers for Theme Lab ----

  const createThemeProfile = (input: {
    name: string;
    baseFromId?: string;
  }): string => {
    const trimmedName = input.name.trim() || "Untitled Theme";
    const baseProfile = themeProfiles[input.baseFromId ?? ""];

    const id = `theme-${Date.now()}`;

    const profile: ThemeProfile = {
      id,
      name: trimmedName,
      description: baseProfile?.description,
      tokens: {
        ...DEFAULT_THEME_TOKENS,
        ...(baseProfile?.tokens ?? {}),
      },
      typography: baseProfile?.typography
        ? { ...baseProfile.typography }
        : undefined,
    };

    setThemeProfiles((prev) => ({
      ...prev,
      [id]: profile,
      [DEFAULT_THEME_PROFILE_ID]: DEFAULT_THEME_PROFILE,
      [PASTEL_THEME_PROFILE_ID]: PASTEL_THEME_PROFILE,
    }));
    setActiveThemeId(id);
    return id;
  };

  const updateThemeProfile = (id: string, patch: Partial<ThemeProfile>) => {
    setThemeProfiles((prev) => {
      const existing = prev[id];
      if (!existing) return prev;

      const next: ThemeProfile = {
        ...existing,
        ...patch,
        tokens: patch.tokens
          ? { ...existing.tokens, ...patch.tokens }
          : existing.tokens,
        typography: patch.typography
          ? { ...existing.typography, ...patch.typography }
          : existing.typography,
      };

      return {
        ...prev,
        [id]: next,
        [DEFAULT_THEME_PROFILE_ID]: DEFAULT_THEME_PROFILE,
        [PASTEL_THEME_PROFILE_ID]: PASTEL_THEME_PROFILE,
      };
    });
  };

  const deleteThemeProfile = (id: string) => {
    // Built-ins cannot be deleted
    if (id === DEFAULT_THEME_PROFILE_ID || id === PASTEL_THEME_PROFILE_ID) {
      return;
    }

    setThemeProfiles((prev) => {
      if (!prev[id]) return prev;

      const { [id]: _removed, ...rest } = prev;
      const nextProfiles: Record<string, ThemeProfile> = {
        ...rest,
        [DEFAULT_THEME_PROFILE_ID]: DEFAULT_THEME_PROFILE,
        [PASTEL_THEME_PROFILE_ID]: PASTEL_THEME_PROFILE,
      };

      if (activeThemeId === id) {
        // If we deleted the active one, fall back to default
        setActiveThemeId(DEFAULT_THEME_PROFILE_ID);
      }

      return nextProfiles;
    });
  };

  const setActiveTheme = (id: string) => {
    setActiveThemeId((prev) => (themeProfiles[id] ? id : prev));
  };

  const value: UiSettingsContextValue = {
    uiSettings,
    themeProfiles,
    activeThemeId,
    getScopeSettings,
    updateScopeSettings,
    resetAll,
    createThemeProfile,
    updateThemeProfile,
    deleteThemeProfile,
    setActiveTheme,
  };

  return (
    <UiSettingsContext.Provider value={value}>
      {children}
    </UiSettingsContext.Provider>
  );
};

export const useUiSettings = (): UiSettingsContextValue => {
  const ctx = useContext(UiSettingsContext);
  if (!ctx) {
    throw new Error("useUiSettings must be used within a UiSettingsProvider");
  }
  return ctx;
};
