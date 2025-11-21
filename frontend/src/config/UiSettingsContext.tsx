
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

const DEFAULT_UI_SETTINGS: UiSettings = {
  version: 1,
  scopes: {
    // Global default scope: uses the "default" theme unless overridden later
    global: {
      themeId: "default",
    },
  },
};

const THEME_PROFILES_STORAGE_KEY = "tp_theme_profiles_v1";
const ACTIVE_THEME_ID_STORAGE_KEY = "tp_theme_active_id_v1";

const DEFAULT_THEME_PROFILE_ID = "default-slate";

const DEFAULT_THEME_PROFILE: ThemeProfile = {
  id: DEFAULT_THEME_PROFILE_ID,
  name: "Default Slate",
  description: "Built-in slate baseline theme",
  tokens: { ...DEFAULT_THEME_TOKENS },
};

const PASTEL_THEME_PROFILE_ID = "pastel-lab";

const PASTEL_THEME_PROFILE: ThemeProfile = {
  id: PASTEL_THEME_PROFILE_ID,
  name: "Pastel Lab",
  description: "Soft pastel variant for lab panels",
  tokens: {
    surface: "#0b1120",
    surfaceMuted: "#111827",
    border: "#38bdf8",
    accent: "#a5b4fc",
    accentMuted: "#f97316",
    textPrimary: "#e5e7eb",
    textSecondary: "#cbd5e1",
    success: "#22c55e",
    warning: "#eab308",
    danger: "#fb7185",
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
   */
  resetAll: () => void;

  createThemeProfile: (input: { name: string; baseFromId?: string }) => string;
  updateThemeProfile: (
    id: string,
    patch: Partial<ThemeProfile>
  ) => void;
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
  const [themeProfiles, setThemeProfiles] = useState<Record<string, ThemeProfile>>({
    [DEFAULT_THEME_PROFILE_ID]: DEFAULT_THEME_PROFILE,
    [PASTEL_THEME_PROFILE_ID]: PASTEL_THEME_PROFILE,
  });
  const [activeThemeId, setActiveThemeId] = useState<string>(
    DEFAULT_THEME_PROFILE_ID
  );

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as UiSettings;

      // Very light validation: check version and basic structure
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        parsed.version === 1 &&
        typeof parsed.scopes === "object" &&
        parsed.scopes !== null
      ) {
        setUiSettings(parsed);
      }
    } catch {
      // ignore parse errors and stick with defaults
    }

    try {
      const themeRaw = window.localStorage.getItem(THEME_PROFILES_STORAGE_KEY);
      let loadedProfiles: Record<string, ThemeProfile> = {
        [DEFAULT_THEME_PROFILE_ID]: DEFAULT_THEME_PROFILE,
        [PASTEL_THEME_PROFILE_ID]: PASTEL_THEME_PROFILE,
      };
      if (themeRaw) {
        const parsed = JSON.parse(themeRaw) as Record<string, ThemeProfile>;
        if (parsed && typeof parsed === "object") {
          loadedProfiles = {
            ...loadedProfiles,
            ...parsed,
          };
        }
      }

      loadedProfiles = {
        ...loadedProfiles,
        [DEFAULT_THEME_PROFILE_ID]:
          loadedProfiles[DEFAULT_THEME_PROFILE_ID] ?? DEFAULT_THEME_PROFILE,
      };

      const activeRaw = window.localStorage.getItem(ACTIVE_THEME_ID_STORAGE_KEY);
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

  // Persist to localStorage whenever uiSettings changes
  useEffect(() => {
    try {
      window.localStorage.setItem(
        UI_SETTINGS_STORAGE_KEY,
        JSON.stringify(uiSettings)
      );
    } catch {
      // ignore write failures (e.g. private mode / quota)
    }
  }, [uiSettings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        THEME_PROFILES_STORAGE_KEY,
        JSON.stringify(themeProfiles)
      );
      window.localStorage.setItem(ACTIVE_THEME_ID_STORAGE_KEY, activeThemeId);
    } catch {
      // ignore write failures (e.g. private mode / quota)
    }
  }, [activeThemeId, themeProfiles]);

  const getScopeSettings = (scopeId: ScopeId): UiScopeSettings | undefined => {
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
        // Remove this scope entry entirely
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

  const createThemeProfile = (input: {
    name: string;
    baseFromId?: string;
  }): string => {
    const trimmedName = input.name.trim() || "Untitled Theme";
    const baseProfile = themeProfiles[input.baseFromId ?? ""];
    const baseTokens = {
      ...DEFAULT_THEME_TOKENS,
      ...(baseProfile?.tokens ?? DEFAULT_THEME_TOKENS),
    };
    const id = `theme-${Date.now()}`;

    const profile: ThemeProfile = {
      id,
      name: trimmedName,
      tokens: { ...baseTokens },
      typography: baseProfile?.typography
        ? { ...baseProfile.typography }
        : undefined,
    };

    setThemeProfiles((prev) => ({
      ...prev,
      [id]: profile,
      [DEFAULT_THEME_PROFILE_ID]:
        prev[DEFAULT_THEME_PROFILE_ID] ?? DEFAULT_THEME_PROFILE,
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

      return { ...prev, [id]: next };
    });
  };

  const deleteThemeProfile = (id: string) => {
    if (id === DEFAULT_THEME_PROFILE_ID) return;

    setThemeProfiles((prev) => {
      if (!prev[id]) return prev;

      const { [id]: _removed, ...rest } = prev;
      const nextProfiles = {
        ...rest,
        [DEFAULT_THEME_PROFILE_ID]:
          rest[DEFAULT_THEME_PROFILE_ID] ?? DEFAULT_THEME_PROFILE,
      };

      if (activeThemeId === id) {
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
