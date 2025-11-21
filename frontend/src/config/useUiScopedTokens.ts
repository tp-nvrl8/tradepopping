import { useMemo } from "react";
import { useUiSettings } from "./UiSettingsContext";
import { resolveThemeTokens } from "./resolveThemeTokens";
import type { SemanticTokens } from "./ThemeContext";

/**
 * Merge SemanticTokens, overriding only provided fields.
 */
function mergeTokens(
  base: SemanticTokens,
  overrides?: Partial<SemanticTokens>
): SemanticTokens {
  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
  };
}

/**
 * Inputs:
 *   orderedScopes: array of scope IDs in merge order.
 *     e.g. ["global", "page:lab", "region:lab:ideaBuilder"]
 *
 * Output:
 *   final merged SemanticTokens.
 *
 * Merge order rules:
 *   - Start from global theme.
 *   - For each scope:
 *       -> If scope has themeId, load that theme's tokens (reset baseline).
 *       -> Then merge overrides on top.
 *   - Return final SemanticTokens.
 */
export function useUiScopedTokens(orderedScopes: string[]): SemanticTokens {
  const { uiSettings } = useUiSettings();

  return useMemo(() => {
    // Start with the GLOBAL baseline theme from UiSettings
    const global = uiSettings.scopes["global"];
    const globalThemeId = global?.themeId ?? "default";
    let tokens = resolveThemeTokens(globalThemeId);

    // Walk through all scopes in provided order
    for (const scopeId of orderedScopes) {
      const scopeSettings = uiSettings.scopes[scopeId];
      if (!scopeSettings) continue;

      // If the scope sets a theme, reset the baseline
      if (scopeSettings.themeId) {
        tokens = resolveThemeTokens(scopeSettings.themeId);
      }

      // Apply overrides on top
      tokens = mergeTokens(tokens, scopeSettings.overrides);
    }

    return tokens;
  }, [orderedScopes, uiSettings]);
  

}
