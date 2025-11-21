import { useMemo } from "react";
import { useUiSettings } from "./UiSettingsContext";
import {
  DEFAULT_THEME_TOKENS,
  mergeThemeTokens,
  UiTokens,
} from "./uiThemeCore";
import { resolveThemeTokens } from "./resolveThemeTokens";

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
export function useUiScopedTokens(scopeOrder: string[]): UiTokens {
  const {
    activeThemeId,
    themeProfiles,
    getScopeSettings,
  } = useUiSettings();

  return useMemo(() => {
    let baseTokens: UiTokens = { ...DEFAULT_THEME_TOKENS };

    if (activeThemeId && themeProfiles && themeProfiles[activeThemeId]) {
      const profile = themeProfiles[activeThemeId];
      baseTokens = mergeThemeTokens(
        DEFAULT_THEME_TOKENS,
        profile.tokens ?? undefined
      );
    }

    let tokens: UiTokens = { ...baseTokens };

    // Walk through all scopes in provided order
    for (const scopeId of scopeOrder) {
      const scopeSettings = getScopeSettings(scopeId);
      if (!scopeSettings || !scopeSettings.overrides) continue;

      tokens = resolveThemeTokens(tokens, scopeSettings.overrides);
    }

    return tokens;
  }, [activeThemeId, getScopeSettings, scopeOrder, themeProfiles]);
}
