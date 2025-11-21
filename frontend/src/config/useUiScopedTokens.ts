import { useMemo } from "react";
import { useUiSettings } from "./UiSettingsContext";
import { resolveThemeTokens } from "./resolveThemeTokens";
import type { SemanticTokens } from "./ThemeContext";
import { DEFAULT_THEME_TOKENS, mergeThemeTokens } from "./uiThemeCore";

/**
 * Inputs:
 *   orderedScopes: array of scope IDs in merge order.
 *     e.g. ["global", "page:lab", "region:lab:ideaBuilder"]
 *
 * Output:
 *   final merged SemanticTokens.
 *
 * Merge order rules:
 *   - Start from the active theme profile (or default tokens).
 *   - For each scope:
 *       -> Merge overrides on top of the current tokens.
 *   - Return final SemanticTokens.
 */
export function useUiScopedTokens(orderedScopes: string[]): SemanticTokens {
  const { getScopeSettings, activeThemeId, themeProfiles } = useUiSettings();

  return useMemo(() => {
    let baseTokens: SemanticTokens = { ...DEFAULT_THEME_TOKENS };

    if (activeThemeId && themeProfiles?.[activeThemeId]) {
      const profile = themeProfiles[activeThemeId];
      baseTokens = mergeThemeTokens(DEFAULT_THEME_TOKENS, profile.tokens);
    }

    let tokens: SemanticTokens = { ...baseTokens };

    // Walk through all scopes in provided order
    for (const scopeId of orderedScopes) {
      const scopeSettings = getScopeSettings(scopeId);
      if (!scopeSettings) continue;

      const overrides = scopeSettings.overrides || {};

      tokens = resolveThemeTokens(tokens, overrides);
    }

    return tokens;
  }, [activeThemeId, getScopeSettings, orderedScopes, themeProfiles]);


}
