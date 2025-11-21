export const DEFAULT_THEME_TOKENS = {
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
} as const;

export type UiTokens = typeof DEFAULT_THEME_TOKENS;

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

export function mergeThemeTokens(
  base: UiTokens,
  overrides?: Partial<UiTokens>
): UiTokens {
  if (!overrides) return base;
  return { ...base, ...overrides };
}

export function deriveUiTokensFromCustomPalette(palette: {
  builderBg: string;
  builderBorder: string;
  builderHeaderBg: string;
  builderHeaderBorder: string;
  analysisBg: string;
  analysisBorder: string;
  analysisHeaderBg: string;
  analysisHeaderBorder: string;
}): UiTokens {
  return {
    surface: palette.builderBg,
    surfaceMuted: palette.builderHeaderBg,
    border: palette.builderBorder,
    textPrimary: "#e2e8f0",
    textSecondary: "#cbd5e1",
    accent: palette.analysisHeaderBorder,
    accentMuted: palette.analysisBorder,
    success: "#22c55e",
    warning: "#eab308",
    danger: "#f43f5e",
  };
}
