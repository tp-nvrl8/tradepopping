
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

const DEFAULT_UI_SETTINGS: UiSettings = {
  version: 1,
  scopes: {
    // Global default scope: uses the "default" theme unless overridden later
    global: {
      themeId: "default",
    },
  },
};

export interface UiSettingsContextValue {
  uiSettings: UiSettings;
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
}

const UiSettingsContext = createContext<UiSettingsContextValue | undefined>(
  undefined
);

export const UiSettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [uiSettings, setUiSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);

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

  const value: UiSettingsContextValue = {
    uiSettings,
    getScopeSettings,
    updateScopeSettings,
    resetAll,
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
