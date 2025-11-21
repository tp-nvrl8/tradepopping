import type { IndicatorId } from "./types";

export type IndicatorParamType = "number" | "select" | "boolean";

export interface IndicatorParamDef {
  key: string;
  label: string;
  type: IndicatorParamType;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[]; // for select
  defaultValue?: number | string | boolean;
  helperText?: string;
}

export interface IndicatorDefinition {
  id: IndicatorId;
  name: string;
  category: string;
  description: string;
  params: IndicatorParamDef[];
}

export const INDICATOR_CATALOG: readonly IndicatorDefinition[] = [
  {
    id: "sobv_trend",
    name: "Short Volume Trend (sOBV)",
    category: "Trend / Sentiment",
    description: "On-balance short volume trend used to detect accumulation/pressure.",
    params: [
      {
        key: "lookback",
        label: "Lookback",
        type: "number",
        min: 5,
        max: 60,
        step: 1,
        defaultValue: 20,
      },
    ],
  },
  {
    id: "kama_regime",
    name: "KAMA Regime",
    category: "Trend / Regime",
    description: "Kaufman Adaptive Moving Average to classify price regime.",
    params: [
      {
        key: "fast",
        label: "Fast",
        type: "number",
        min: 2,
        max: 10,
        defaultValue: 2,
      },
      {
        key: "slow",
        label: "Slow",
        type: "number",
        min: 20,
        max: 60,
        defaultValue: 30,
      },
    ],
  },
  {
    id: "darkflow_bias",
    name: "Dark Flow Bias",
    category: "Dark Pool / Flow",
    description: "Tracks net dark pool flow to infer accumulation vs distribution.",
    params: [],
  },
  {
    id: "zscore_price_lookback",
    name: "Price Z-Score",
    category: "Mean Reversion",
    description: "Z-score of price over a rolling lookback window to find extremes.",
    params: [
      {
        key: "lookback",
        label: "Lookback",
        type: "number",
        min: 5,
        max: 60,
        defaultValue: 10,
      },
      {
        key: "threshold",
        label: "Threshold",
        type: "number",
        min: 1,
        max: 5,
        step: 0.5,
        defaultValue: 2,
      },
    ],
  },
] as const;

export function getIndicatorDefinition(
  id: IndicatorId
): IndicatorDefinition | undefined {
  return INDICATOR_CATALOG.find((def) => def.id === id);
}
