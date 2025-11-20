export type ScopeType = "global" | "page" | "region";

export interface UiScopeDefinition {
  id: string;       // ScopeId
  label: string;    // Human-facing label for dropdowns
  type: ScopeType;  // global | page | region
  parent?: string;  // For regions (e.g. page:lab)
}

export const UI_SCOPES: readonly UiScopeDefinition[] = [
  //
  // ---- GLOBAL ----
  //
  {
    id: "global",
    label: "Global Default",
    type: "global",
  },

  //
  // ---- PAGE SCOPES ----
  //
  {
    id: "page:lab",
    label: "Strategy Lab",
    type: "page",
  },
  {
    id: "page:candidates",
    label: "Candidates",
    type: "page",
  },
  {
    id: "page:test-stand",
    label: "Test Stand",
    type: "page",
  },
  {
    id: "page:datahub",
    label: "DataHub",
    type: "page",
  },
  {
    id: "page:settings",
    label: "Settings",
    type: "page",
  },

  //
  // ---- LAB REGIONS ----
  //
  {
    id: "region:lab:ideaBuilder",
    label: "Lab – Idea Builder",
    type: "region",
    parent: "page:lab",
  },
  {
    id: "region:lab:analysis",
    label: "Lab – Analysis",
    type: "region",
    parent: "page:lab",
  },
  {
    id: "region:lab:indicator",
    label: "Lab – Indicator",
    type: "region",
    parent: "page:lab",
  },
  {
    id: "region:lab:filter",
    label: "Lab – Filter",
    type: "region",
    parent: "page:lab",
  },
] as const;
