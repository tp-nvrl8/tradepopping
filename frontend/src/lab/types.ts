// High-level lifecycle of an idea
export type IdeaStatus = "draft" | "active" | "retired";

export interface IdeaMeta {
  id: string;
  name: string;
  description?: string;
  status: IdeaStatus;
  family?: string; // e.g. "VCP", "Mean Reversion", "Breakout"
  tags?: string[]; // e.g. ["vanishing-float", "darkflow"]
}

/**
 * Basic numeric range (inclusive).
 * If min or max is undefined, that side is "open".
 */
export interface RangeFilter {
  min?: number;
  max?: number;
}

/**
 * Price & liquidity constraint block.
 */
export interface PriceLiquidityFilters {
  price: RangeFilter;          // e.g. 2–20
  averageDailyDollarVolume?: RangeFilter;
  averageDailyShareVolume?: RangeFilter;
  floatShares?: RangeFilter;   // small/mid float constraints
  marketCap?: RangeFilter;
}

/**
 * Volatility / regime filter block.
 * This is intentionally simple for now; we can add more fields later.
 */
export type VolatilityRegime =
  | "any"
  | "quiet"
  | "normal"
  | "expanding"
  | "crisis";

export interface VolatilityFilters {
  regime: VolatilityRegime;   // e.g. only trade in "quiet" regimes
  atrPercent?: RangeFilter;   // ATR as % of price
  hvPercent?: RangeFilter;    // historical volatility
}

/**
 * Special structural constraints like short interest, vanishing float, etc.
 */
export interface StructureFilters {
  shortInterestPercentFloat?: RangeFilter;
  daysToCover?: RangeFilter;
  vanishingFloatScore?: RangeFilter; // 0–100 style internal score
}

/**
 * Reference to a particular indicator variant.
 * For now, this is "pick from library", not free-form builder.
 */
export type IndicatorId =
  | "sobv_trend"
  | "kama_regime"
  | "darkflow_bias"
  | "zscore_price_lookback";

export interface IndicatorInstance {
  id: IndicatorId;
  variant?: string | null;
  enabled: boolean;
  params?: Record<string, number | string | boolean>;
  notes?: string; // free-form observations per indicator
}

/**
 * The group of indicators/overlays this idea wants to use
 * when scanning or scoring candidates.
 */
export interface IdeaIndicators {
  indicators: IndicatorInstance[];
}

/**
 * Full idea definition used in the Lab.
 */
export interface LabIdea {
  meta: IdeaMeta;
  priceLiquidity: PriceLiquidityFilters;
  volatility: VolatilityFilters;
  structure: StructureFilters;
  indicators: IdeaIndicators;
}