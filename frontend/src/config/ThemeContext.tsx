import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type ThemeId =
  | "slate"
  | "trek-industrial"
  | "delta-flyer"
  | "custom";

const THEME_STORAGE_KEY = "tp_theme_v1";

/** Legacy single-custom palette key (Phase 3) */
const CUSTOM_THEME_STORAGE_KEY = "tp_theme_custom_v1";

/** New keys for Phase 4: multiple profiles */
const CUSTOM_THEME_LIST_STORAGE_KEY = "tp_theme_custom_list_v1";
const CUSTOM_THEME_ACTIVE_ID_STORAGE_KEY = "tp_theme_custom_active_id_v1";

/**
 * Colors used when theme === "custom".
 * These override the CSS variables defined in index.css.
 */
export interface CustomPalette {
  builderBg: string;
  builderBorder: string;
  builderHeaderBg: string;
  builderHeaderBorder: string;
  analysisBg: string;
  analysisBorder: string;
  analysisHeaderBg: string;
  analysisHeaderBorder: string;
}

/** Default custom palette (start from Slate-like values) */
export const DEFAULT_CUSTOM_PALETTE: CustomPalette = {
  builderBg: "#020617",
  builderBorder: "#1e293b",
  builderHeaderBg: "#020617",
  builderHeaderBorder: "#334155",
  analysisBg: "#020617",
  analysisBorder: "#1e293b",
  analysisHeaderBg: "#020617",
  analysisHeaderBorder: "#334155",
};

/** A saved custom theme profile */
export interface CustomThemeProfile {
  id: string;       // internal ID
  name: string;     // user-visible name
  palette: CustomPalette;
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;

  customPalette: CustomPalette | null;
  setCustomPalette: (palette: CustomPalette) => void;

  savedCustomThemes: CustomThemeProfile[];
  activeCustomThemeId: string | null;
  saveCustomThemeProfile: (name: string) => void;
  deleteCustomThemeProfile: (id: string) => void;
  loadCustomThemeProfile: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Helper: apply theme + optional custom palette to <html> */
function applyThemeToDocument(
  theme: ThemeId,
  customPalette: CustomPalette | null
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Set data attribute for CSS rules
  root.dataset.tpTheme = theme;

  const varMap: { key: keyof CustomPalette; cssVar: string }[] = [
    { key: "builderBg", cssVar: "--tp-lab-builder-bg" },
    { key: "builderBorder", cssVar: "--tp-lab-builder-border" },
    { key: "builderHeaderBg", cssVar: "--tp-lab-builder-header-bg" },
    { key: "builderHeaderBorder", cssVar: "--tp-lab-builder-header-border" },
    { key: "analysisBg", cssVar: "--tp-lab-analysis-bg" },
    { key: "analysisBorder", cssVar: "--tp-lab-analysis-border" },
    { key: "analysisHeaderBg", cssVar: "--tp-lab-analysis-header-bg" },
    { key: "analysisHeaderBorder", cssVar: "--tp-lab-analysis-header-border" },
  ];

  if (theme === "custom" && customPalette) {
    // Override CSS vars from JS for the custom theme
    for (const { key, cssVar } of varMap) {
      const value = customPalette[key];
      if (value) {
        root.style.setProperty(cssVar, value);
      }
    }
  } else {
    // Clear overrides so the static CSS (index.css) takes over
    for (const { cssVar } of varMap) {
      root.style.removeProperty(cssVar);
    }
  }
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeId>("slate");

  const [customPalette, setCustomPaletteState] = useState<CustomPalette | null>(
    null
  );
  const [savedCustomThemes, setSavedCustomThemes] = useState<
    CustomThemeProfile[]
  >([]);
  const [activeCustomThemeId, setActiveCustomThemeId] = useState<string | null>(
    null
  );

  // Load initial theme + custom palette + profiles from localStorage
  useEffect(() => {
    try {
      // Base theme
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as
        | ThemeId
        | null;

      if (
        storedTheme === "slate" ||
        storedTheme === "trek-industrial" ||
        storedTheme === "delta-flyer" ||
        storedTheme === "custom"
      ) {
        setThemeState(storedTheme);
      }

      // Load profile list (Phase 4)
      let profiles: CustomThemeProfile[] = [];
      const listRaw =
        window.localStorage.getItem(CUSTOM_THEME_LIST_STORAGE_KEY);
      if (listRaw) {
        try {
          const parsed = JSON.parse(listRaw) as CustomThemeProfile[];
          if (Array.isArray(parsed)) {
            profiles = parsed.filter(
              (p) =>
                p &&
                typeof p.id === "string" &&
                typeof p.name === "string" &&
                p.palette
            );
          }
        } catch {
          // ignore parse errors
        }
      }

      // If no profiles, try legacy single palette (Phase 3)
      if (profiles.length === 0) {
        const storedPaletteRaw =
          window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
        let initialPalette = DEFAULT_CUSTOM_PALETTE;
        if (storedPaletteRaw) {
          try {
            const parsed = JSON.parse(storedPaletteRaw) as Partial<CustomPalette>;
            if (parsed && typeof parsed === "object") {
              initialPalette = {
                ...DEFAULT_CUSTOM_PALETTE,
                ...parsed,
              };
            }
          } catch {
            // ignore
          }
        }

        const legacyProfile: CustomThemeProfile = {
          id: "custom-default-1",
          name: "My Custom Theme",
          palette: initialPalette,
        };
        profiles = [legacyProfile];
      }

      setSavedCustomThemes(profiles);

      // Active custom ID
      const storedActiveId = window.localStorage.getItem(
        CUSTOM_THEME_ACTIVE_ID_STORAGE_KEY
      );
      let activeId: string | null = null;
      if (storedActiveId && profiles.some((p) => p.id === storedActiveId)) {
        activeId = storedActiveId;
      } else if (profiles.length > 0) {
        activeId = profiles[0].id;
      }
      setActiveCustomThemeId(activeId);

      // Set custom palette from active profile (if any)
      if (activeId) {
        const activeProfile = profiles.find((p) => p.id === activeId);
        if (activeProfile) {
          setCustomPaletteState(activeProfile.palette);
        } else {
          setCustomPaletteState(DEFAULT_CUSTOM_PALETTE);
        }
      } else {
        setCustomPaletteState(DEFAULT_CUSTOM_PALETTE);
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply theme + custom palette to document
  useEffect(() => {
    applyThemeToDocument(theme, customPalette);
  }, [theme, customPalette]);

  // Persist base theme
  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Persist custom profiles & active ID
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CUSTOM_THEME_LIST_STORAGE_KEY,
        JSON.stringify(savedCustomThemes)
      );
      if (activeCustomThemeId) {
        window.localStorage.setItem(
          CUSTOM_THEME_ACTIVE_ID_STORAGE_KEY,
          activeCustomThemeId
        );
      } else {
        window.localStorage.removeItem(CUSTOM_THEME_ACTIVE_ID_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [savedCustomThemes, activeCustomThemeId]);

  // Persist a single "current" custom palette (backward compatibility)
  useEffect(() => {
    try {
      if (customPalette) {
        window.localStorage.setItem(
          CUSTOM_THEME_STORAGE_KEY,
          JSON.stringify(customPalette)
        );
      } else {
        window.localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [customPalette]);

  const setTheme = (next: ThemeId) => {
    setThemeState(next);
  };

  const setCustomPalette = (palette: CustomPalette) => {
    setCustomPaletteState(palette);

    // If a custom profile is currently active, update it in the list
    if (activeCustomThemeId) {
      setSavedCustomThemes((prev) =>
        prev.map((p) =>
          p.id === activeCustomThemeId ? { ...p, palette } : p
        )
      );
    }
  };

  const saveCustomThemeProfile = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      // no-op if empty name
      return;
    }
    const palette = customPalette ?? DEFAULT_CUSTOM_PALETTE;
    const id = `custom-${Date.now()}`;

    const profile: CustomThemeProfile = {
      id,
      name: trimmed,
      palette,
    };

    setSavedCustomThemes((prev) => [...prev, profile]);
    setActiveCustomThemeId(id);
    setCustomPaletteState(palette);
    setThemeState("custom");
  };

  const deleteCustomThemeProfile = (id: string) => {
    setSavedCustomThemes((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      let nextActiveId: string | null = activeCustomThemeId;

      if (activeCustomThemeId === id) {
        nextActiveId = filtered.length ? filtered[0].id : null;
        setActiveCustomThemeId(nextActiveId);

        if (filtered.length > 0) {
          setCustomPaletteState(filtered[0].palette);
        } else {
          setCustomPaletteState(DEFAULT_CUSTOM_PALETTE);
        }
      }

      return filtered;
    });
  };

  const loadCustomThemeProfile = (id: string) => {
    const profile = savedCustomThemes.find((p) => p.id === id);
    if (!profile) return;
    setActiveCustomThemeId(id);
    setCustomPaletteState(profile.palette);
    setThemeState("custom");
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        customPalette,
        setCustomPalette,
        savedCustomThemes,
        activeCustomThemeId,
        saveCustomThemeProfile,
        deleteCustomThemeProfile,
        loadCustomThemeProfile,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return ctx;
};