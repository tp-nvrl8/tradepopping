// resolveThemeTokens.ts
import {
  type SemanticTokens,
  DEFAULT_CUSTOM_PALETTE,
  // These refer to your ThemeContext exports
} from "./ThemeContext";
import { PRESET_THEMES, getThemeDefinition } from "./uiTheme";

/**
 * Given a Theme ID (example: "default", "slate", custom theme name, etc.),
 * return its SemanticTokens.
 *
 * This is a thin wrapper that bridges your ThemeContext + uiTheme system.
 */
export function resolveThemeTokens(themeId: string): SemanticTokens {
  // Special-case: Default theme
  if (themeId === "default") {
    const slate = getThemeDefinition("slate");
    // Convert slate.theme tokens into SemanticTokens-like structure.
    // These are your base default values.
    // For now we hardcode the slate preset as “default”.
    return {
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
  }

  // Next: Get preset or custom definition from uiTheme
  const def = getThemeDefinition(themeId as any);

  // Build SemanticTokens out of the preset tokens.
  // If you add more fields to SemanticTokens, fill them here.
  const resolve = (k: keyof SemanticTokens): string => {
    return (
      (def.tokens as any)[k] ??
      {
        surface: "#0b1220",
        surfaceMuted: "#111827",
        border: "#1f2937",
        textPrimary: "#e2e8f0",
        textSecondary: "#cbd5e1",
        accent: "#38bdf8",
        accentMuted: "#0ea5e9",
        success: "#22c55e",
        warning: "#eab308",
        danger: "#f43f5e",
      }[k]
    );
  };

  return {
    surface: resolve("surface"),
    surfaceMuted: resolve("surfaceMuted"),
    border: resolve("border"),
    textPrimary: resolve("textPrimary"),
    textSecondary: resolve("textSecondary"),
    accent: resolve("accent"),
    accentMuted: resolve("accentMuted"),
    success: resolve("success"),
    warning: resolve("warning"),
    danger: resolve("danger"),
  };
}
