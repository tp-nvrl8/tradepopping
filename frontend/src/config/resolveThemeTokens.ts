// resolveThemeTokens.ts
import { type SemanticTokens } from "./ThemeContext";
import { DEFAULT_THEME_TOKENS } from "./uiThemeCore";
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
      ...DEFAULT_THEME_TOKENS,
    };
  }

  // Next: Get preset or custom definition from uiTheme
  const def = getThemeDefinition(themeId as any);

  // Build SemanticTokens out of the preset tokens.
  // If you add more fields to SemanticTokens, fill them here.
  const resolve = (k: keyof SemanticTokens): string => {
    return (
      (def.tokens as any)[k] ??
      DEFAULT_THEME_TOKENS[k]
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
