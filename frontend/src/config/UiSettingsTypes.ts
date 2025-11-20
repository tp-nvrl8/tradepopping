import type { SemanticTokens } from "./ThemeContext";

export type SemanticTokenKey = keyof SemanticTokens;

export interface TypographySettings {
  fontFamily?: string; // e.g. "system-ui", "Ariel", "Helvetica"
  fontSize?: number;   // px
}

export type ThemeIdString = string; // "default" or name/id of a saved theme

export interface UiScopeSettings {
  themeId: ThemeIdString;                       // selected base theme
  overrides?: Partial<Record<SemanticTokenKey, string>>;
  typography?: TypographySettings;
  // layout?: ... // reserved for later
}

export type ScopeId = string;

export interface UiSettings {
  version: 1;
  scopes: Record<ScopeId, UiScopeSettings>;
}

// LocalStorage key for this structure
export const UI_SETTINGS_STORAGE_KEY = "tp_ui_settings_v1";
