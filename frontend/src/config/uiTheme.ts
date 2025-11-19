// src/config/uiTheme.ts

export type ThemeId = "slate" | "labSoft" | "labBold" | "custom";

/**
 * All semantic tokens we care about (Phase 1: only Lab panels)
 */
export type TokenKey =
  | "lab.builder.bg"
  | "lab.builder.border"
  | "lab.builder.headerBg"
  | "lab.builder.headerBorder"
  | "lab.analysis.bg"
  | "lab.analysis.border"
  | "lab.analysis.headerBg"
  | "lab.analysis.headerBorder";

export type Hex = string; // "#0f172a" etc.

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  kind: "preset" | "custom";
  tokens: Partial<Record<TokenKey, Hex>>;
}

/**
 * Default preset themes.
 * For now, Slate is your real theme; Lab Soft/Bold are placeholders we can tune later.
 */
export const PRESET_THEMES: ThemeDefinition[] = [
  {
    id: "slate",
    label: "Slate (Default)",
    kind: "preset",
    tokens: {
      "lab.builder.bg": "#020617",
      "lab.builder.border": "#1e293b",
      "lab.builder.headerBg": "#020617",
      "lab.builder.headerBorder": "#1e293b",

      "lab.analysis.bg": "#020617",
      "lab.analysis.border": "#1f2937",
      "lab.analysis.headerBg": "#020617",
      "lab.analysis.headerBorder": "#1f2937",
    },
  },
  {
    id: "labSoft",
    label: "Lab Accents (Soft)",
    kind: "preset",
    tokens: {
      "lab.builder.bg": "#020617",
      "lab.builder.border": "#4f46e5",
      "lab.builder.headerBg": "#1e1b4b",
      "lab.builder.headerBorder": "#6366f1",

      "lab.analysis.bg": "#020617",
      "lab.analysis.border": "#10b981",
      "lab.analysis.headerBg": "#064e3b",
      "lab.analysis.headerBorder": "#34d399",
    },
  },
  {
    id: "labBold",
    label: "Lab Accents (Bold)",
    kind: "preset",
    tokens: {
      "lab.builder.bg": "#020617",
      "lab.builder.border": "#6366f1",
      "lab.builder.headerBg": "#1d1b4b",
      "lab.builder.headerBorder": "#818cf8",

      "lab.analysis.bg": "#020617",
      "lab.analysis.border": "#22c55e",
      "lab.analysis.headerBg": "#065f46",
      "lab.analysis.headerBorder": "#4ade80",
    },
  },
  {
    id: "custom",
    label: "Custom",
    kind: "custom",
    tokens: {}, // will be resolved later using overrides
  },
];

/**
 * Get a theme by id, falling back to Slate if unknown.
 */
export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  const found = PRESET_THEMES.find((t) => t.id === id);
  return found ?? PRESET_THEMES[0];
}