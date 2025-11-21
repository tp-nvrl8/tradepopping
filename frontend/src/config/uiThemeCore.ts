// src/config/uiThemeCore.ts

// All the theme token keys we care about
export type TokenKey =
  | "surface"
  | "surfaceMuted"
  | "border"
  | "textPrimary"
  | "textSecondary"
  | "accent"
  | "accentMuted"
  | "success"
  | "warning"
  | "danger";

// A simple map from token key -> hex string
export type UiTokens = Record<TokenKey, string>;

// Default theme values (dark slate-y base)
export const DEFAULT_THEME_TOKENS: UiTokens = {
  surface: "#0b1220",
  surfaceMuted: "#111827",
  border: "#1f2937",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  accent: "#38bdf8",
  accentMuted: "#0ea5e9",
  success: "#22c55e",
  warning: "#eab308",
  danger: "#f43f5e",
};

// A named theme profile for Theme Lab
export interface ThemeProfile {
  id: string;
  name: string;
  description?: string;
  tokens: Partial<UiTokens>;
  typography?: {
    fontFamily?: string;
    baseFontSizePx?: number;
  };
}

// Basic merge helper: start from base tokens and apply overrides
export function mergeThemeTokens(
  base: UiTokens,
  overrides?: Partial<UiTokens> | null
): UiTokens {
  if (!overrides) return { ...base };

  const next: UiTokens = { ...base };
  for (const key of Object.keys(overrides) as TokenKey[]) {
    const value = overrides[key];
    if (value) {
      next[key] = value;
    }
  }
  return next;
}

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

export function deriveUiTokensFromCustomPalette(
  palette: CustomPalette | null | undefined
): UiTokens {
  const p: CustomPalette =
    palette ?? {
      builderBg: "#020617",
      builderBorder: "#1e293b",
      builderHeaderBg: "#020617",
      builderHeaderBorder: "#334155",
      analysisBg: "#020617",
      analysisBorder: "#1e293b",
      analysisHeaderBg: "#020617",
      analysisHeaderBorder: "#334155",
    };

  return {
    surface: p.builderBg,
    surfaceMuted: p.builderHeaderBg,
    border: p.builderBorder,
    textPrimary: DEFAULT_THEME_TOKENS.textPrimary,
    textSecondary: DEFAULT_THEME_TOKENS.textSecondary,
    accent: p.analysisHeaderBorder,
    accentMuted: p.analysisBorder,
    success: DEFAULT_THEME_TOKENS.success,
    warning: DEFAULT_THEME_TOKENS.warning,
    danger: DEFAULT_THEME_TOKENS.danger,
  };
}
