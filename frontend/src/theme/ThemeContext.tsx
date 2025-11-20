import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// Keep this in sync with the themes you use in SettingsPage and index.css
export type ThemeId = "slate" | "trek-industrial" | "delta-flyer" | "custom";

const THEME_STORAGE_KEY = "tp_theme_v1";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeId>("slate");

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (
        stored === "slate" ||
        stored === "trek-industrial" ||
        stored === "delta-flyer" ||
        stored === "custom"
      ) {
        setThemeState(stored as ThemeId);
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply to <html> and persist
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.tpTheme = theme;
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = (next: ThemeId) => {
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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