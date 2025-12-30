// src/config/resolveThemeTokens.ts

import { UiTokens, TokenKey } from './uiThemeCore';

/**
 * Given a base token set and optional overrides, return a merged token set.
 * This is a small helper so other code can stay simple.
 */
export function resolveThemeTokens(base: UiTokens, overrides?: Partial<UiTokens>): UiTokens {
  if (!overrides) return { ...base };

  const next: UiTokens = { ...base };

  for (const key of Object.keys(overrides) as TokenKey[]) {
    const value = overrides[key];
    if (value) next[key] = value;
  }

  return next;
}
