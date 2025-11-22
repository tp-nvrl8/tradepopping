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

  /** Short one-line explanation for quick scanning. */
  summary: string;

  /** Optional longer explanation shown in the info panel. */
  description?: string;

  params: IndicatorParamDef[];
}

export const INDICATOR_CATALOG: readonly IndicatorDefinition[] = [
  {
    id: "sobv_trend",
    name: "Short Volume Trend (sOBV)",
    category: "Trend / Sentiment",
    summary: "Tracks short volume pressure to spot quiet accumulation or squeeze risk.",
    description:
      "sOBV builds an on-balance-style series using daily short volume and price direction. " +
      "A rising sOBV while price is flat or drifting down can signal stealth accumulation, " +
      "hedging pressure, or early short squeeze conditions.",
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
    summary: "Classifies the price environment as trending or choppy using KAMA.",
    description:
      "Kaufman’s Adaptive Moving Average reacts faster in strong directional moves and slows down " +
      "in choppy markets. Comparing price versus KAMA and its slope can help label regimes as " +
      "quiet, trending, or noisy and filter ideas that only work in certain environments.",
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
    summary: "Measures net dark pool buying vs selling to infer stealth accumulation.",
    description:
      "Aggregates dark pool prints over time to estimate whether large players are building or " +
      "unwinding positions off-exchange. A persistent positive bias can support long ideas, while " +
      "negative bias may warn against long exposure.",
    params: [],
  },
  {
    id: "zscore_price_lookback",
    name: "Price Z-Score",
    category: "Mean Reversion",
    summary: "Flags statistically extreme price moves over a rolling lookback window.",
    description:
      "Computes how many standard deviations the current price is from its recent mean over a rolling " +
      "window. High positive or negative Z-scores can highlight stretched moves that may revert, " +
      "especially in quiet or range-bound regimes.",
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
