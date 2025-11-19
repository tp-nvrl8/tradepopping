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
const CUSTOM_THEME_STORAGE_KEY = "tp_theme_custom_v1";

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

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  customPalette: CustomPalette | null;
  setCustomPalette: (palette: CustomPalette) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Helper: apply theme + optional custom palette to <html> */
function applyThemeToDocument(theme: ThemeId, customPalette: CustomPalette | null) {
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

  // Load initial theme + custom palette from localStorage
  useEffect(() => {
    try {
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

      const storedPaletteRaw =
        window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
      if (storedPaletteRaw) {
        try {
          const parsed = JSON.parse(storedPaletteRaw) as Partial<CustomPalette>;
          // Basic shape check
          if (parsed && typeof parsed === "object") {
            const merged: CustomPalette = {
              ...DEFAULT_CUSTOM_PALETTE,
              ...parsed,
            };
            setCustomPaletteState(merged);
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply theme + custom palette to document
  useEffect(() => {
    applyThemeToDocument(theme, customPalette);
  }, [theme, customPalette]);

  // Persist theme
  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Persist custom palette
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
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, customPalette, setCustomPalette }}
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