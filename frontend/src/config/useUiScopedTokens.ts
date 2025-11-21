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
 *   scopeOrder: array of scope IDs in merge order.
 *     e.g. ["global", "page:lab", "region:lab:ideaBuilder"]
 *
 * Output:
 *   final merged UiTokens for that component.
 *
 * Merge order:
 *   1) Start from DEFAULT_THEME_TOKENS.
 *   2) Merge in the active theme profile's tokens (if any).
 *   3) For each scope in scopeOrder:
 *        - If that scope has overrides, merge them on top.
 */
export function useUiScopedTokens(scopeOrder: string[]): UiTokens {
  const { activeThemeId, themeProfiles, getScopeSettings } = useUiSettings();

  return useMemo(() => {
    // 1) Base from default tokens
    let baseTokens: UiTokens = { ...DEFAULT_THEME_TOKENS };

    // 2) Apply active theme profile if defined
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
