import type { SemanticTokens } from "./ThemeContext";

/**
 * Inputs:
 *   - orderedScopes: an array of ScopeIds in the order they should be merged.
 *     Example: ["global", "page:lab", "region:lab:ideaBuilder"]
 *
 * Output:
 *   - a fully merged SemanticTokens object to be used by that component.
 *
 * Rules (to be implemented later):
 *   1. Start with the theme selected at "global".
 *   2. For each scope in orderedScopes:
 *        - If the scope has a themeId, load that theme’s tokens as the new base.
 *        - Then apply any token overrides stored in UiSettings.scopes[scope].overrides.
 *   3. Return the final merged SemanticTokens.
 */
export function useUiScopedTokens(
  _orderedScopes: string[]
): SemanticTokens {
  throw new Error("useUiScopedTokens not implemented yet.");
}
