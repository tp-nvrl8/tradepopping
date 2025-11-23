// src/indicators/indicatorRuntime.ts

import type {
  IndicatorInstance,
  IndicatorId,
} from "../lab/types";

/**
 * Simple OHLCV bar.
 * We can extend this later (e.g. add bid/ask, dark pool flags, etc.).
 */
export interface PriceBar {
  time: string;   // ISO-8601 or any string timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  shortVolume?: number;     // optional: short volume per bar
  darkPoolVolume?: number;  // optional: dark pool volume per bar
}

/**
 * Context about HOW we are computing the indicator.
 * Later we can add things like timezone, session filters, etc.
 */
export interface IndicatorRuntimeContext {
  symbol: string;
  timeframe: string; // "1d", "1h", "15m", etc.
}

/**
 * Output of a single indicator.
 * `values[i]` corresponds to `bars[i]`.
 * `null` means "not enough history yet" (e.g. warmup period).
 */
export interface IndicatorSeries {
  id: IndicatorId;
  params: IndicatorInstance["params"];
  values: (number | null)[];
  meta?: Record<string, unknown>;
}

/**
 * Utility: safe get numeric param with default.
 */
function getNumberParam(
  params: IndicatorInstance["params"] | undefined,
  key: string,
  fallback: number
): number {
  if (!params) return fallback;
  const raw = params[key];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Utility: rolling mean + std for z-score style indicators.
 */
function rollingMeanStd(
  values: number[],
  window: number
): { mean: (number | null)[]; std: (number | null)[] } {
  const n = values.length;
  const means: (number | null)[] = Array(n).fill(null);
  const stds: (number | null)[] = Array(n).fill(null);

  if (window <= 1) {
    for (let i = 0; i < n; i++) {
      means[i] = values[i];
      stds[i] = 0;
    }
    return { mean: means, std: stds };
  }

  for (let i = 0; i < n; i++) {
    if (i < window - 1) continue;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      sum += values[j];
    }
    const wMean = sum / window;
    means[i] = wMean;

    let varSum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const diff = values[j] - wMean;
      varSum += diff * diff;
    }
    const variance = varSum / window;
    stds[i] = Math.sqrt(variance);
  }

  return { mean: means, std: stds };
}

/**
 * Utility: simple cumulative short-volume style trend.
 * This is a lightweight placeholder for your full sOBV logic.
 *
 * Idea:
 *   signedFlow = (shortVolume - (longVolume)) / max(volume, 1)
 *   cumulative sum of signedFlow over time.
 */
function computeSobvTrend(bars: PriceBar[]): (number | null)[] {
  const out: (number | null)[] = [];
  let acc = 0;

  for (let i = 0; i < bars.length; i++) {
    const { volume = 0, shortVolume = 0 } = bars[i];
    const vol = volume > 0 ? volume : 1;
    const longVol = Math.max(vol - shortVolume, 0);
    const signedFlow = (shortVolume - longVol) / vol;
    acc += signedFlow;
    out.push(acc);
  }

  return out;
}

/**
 * Utility: very simple "KAMA-like" regime line (placeholder).
 *
 * For now, we:
 *   - Compute a basic moving average with `slow` window.
 *   - You can later upgrade to true KAMA without changing this signature.
 */
function computeKamaRegime(
  bars: PriceBar[],
  fast: number,
  slow: number
): (number | null)[] {
  const closes = bars.map((b) => b.close);
  const window = Math.max(slow, fast, 2);

  const out: (number | null)[] = Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i < window - 1) continue;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      sum += closes[j];
    }
    out[i] = sum / window;
  }

  return out;
}

/**
 * Utility: dark flow bias = darkPoolVolume / max(volume, 1)
 * cumulative or per-bar — for now we use simple per-bar ratio.
 */
function computeDarkFlowBias(bars: PriceBar[]): (number | null)[] {
  return bars.map((b) => {
    const { volume = 0, darkPoolVolume = 0 } = b;
    const denom = volume > 0 ? volume : 1;
    return darkPoolVolume / denom;
  });
}

/**
 * Utility: price z-score over a lookback window.
 */
function computePriceZScore(
  bars: PriceBar[],
  lookback: number
): (number | null)[] {
  const closes = bars.map((b) => b.close);
  const { mean, std } = rollingMeanStd(closes, lookback);
  const out: (number | null)[] = Array(closes.length).fill(null);

  for (let i = 0; i < closes.length; i++) {
    if (mean[i] == null || std[i] == null || std[i] === 0) {
      out[i] = null;
      continue;
    }
    out[i] = (closes[i] - (mean[i] as number)) / (std[i] as number);
  }

  return out;
}

/**
 * Core entry point:
 * Given one IndicatorInstance + price bars + context,
 * return a computed IndicatorSeries.
 */
export function computeIndicatorSeries(
  instance: IndicatorInstance,
  bars: PriceBar[],
  ctx: IndicatorRuntimeContext
): IndicatorSeries {
  const { id, params } = instance;

  let values: (number | null)[];

  switch (id) {
    case "sobv_trend": {
      values = computeSobvTrend(bars);
      break;
    }

    case "kama_regime": {
      const fast = getNumberParam(params, "fast", 2);
      const slow = getNumberParam(params, "slow", 30);
      values = computeKamaRegime(bars, fast, slow);
      break;
    }

    case "darkflow_bias": {
      values = computeDarkFlowBias(bars);
      break;
    }

    case "zscore_price_lookback": {
      const lookback = getNumberParam(params, "lookback", 10);
      values = computePriceZScore(bars, lookback);
      break;
    }

    default: {
      // Unknown indicator ID — return nulls as a safe fallback
      values = Array(bars.length).fill(null);
      break;
    }
  }

  return {
    id,
    params,
    values,
    meta: {
      symbol: ctx.symbol,
      timeframe: ctx.timeframe,
    },
  };
}

/**
 * Helper: compute ALL indicators for an idea in one shot.
 * This will be useful for Candidates/Test Stand.
 */
export function computeAllIndicatorSeries(
  instances: IndicatorInstance[],
  bars: PriceBar[],
  ctx: IndicatorRuntimeContext
): IndicatorSeries[] {
  return instances
    .filter((inst) => inst.enabled)
    .map((inst) => computeIndicatorSeries(inst, bars, ctx));
}
