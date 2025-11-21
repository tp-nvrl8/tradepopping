// src/config/useUiScopedTokens.ts
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
 *   final merged UiTokens.
 *
 * Merge order rules:
 *   - Start from the active theme profile (or default tokens).
 *   - For each scope:
 *       -> Merge overrides on top of the current tokens.
 *   - Return final UiTokens.
 */
export function useUiScopedTokens(scopeOrder: string[]): UiTokens {
  const { activeThemeId, themeProfiles, getScopeSettings } = useUiSettings();

  return useMemo(() => {
    // 1) Base: DEFAULT_THEME_TOKENS
    let baseTokens: UiTokens = { ...DEFAULT_THEME_TOKENS };

    // 2) Apply active theme profile (if any)
    if (activeThemeId && themeProfiles && themeProfiles[activeThemeId]) {
      const profile = themeProfiles[activeThemeId];
      baseTokens = mergeThemeTokens(
        DEFAULT_THEME_TOKENS,
        profile.tokens ?? undefined
      );
    }

    // 3) Apply scope overrides in order
    let tokens: UiTokens = { ...baseTokens };

    for (const scopeId of scopeOrder) {
      const scopeSettings = getScopeSettings(scopeId);
      if (!scopeSettings || !scopeSettings.overrides) continue;

      tokens = resolveThemeTokens(tokens, scopeSettings.overrides as Partial<UiTokens>);
    }

    return tokens;
  }, [activeThemeId, getScopeSettings, scopeOrder, themeProfiles]);
}
