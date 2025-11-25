// src/indicators/indicatorRuntime.ts

import type { IndicatorInstance } from "../lab/types";
import { INDICATOR_CATALOG, type IndicatorOutputType } from "../lab/indicatorCatalog";

/**
 * Single OHLCV bar used by indicators.
 * Optional shortVolume / darkPoolVolume support flow-based indicators.
 */
export interface PriceBar {
  time: string; // ISO timestamp or date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  shortVolume?: number;
  darkPoolVolume?: number;
}

/**
 * Context about where this indicator is being run.
 * (Symbol, timeframe, maybe later: market regime, sector, etc.)
 */
export interface IndicatorRuntimeContext {
  symbol: string;
  timeframe: string;
}

/**
 * Standardized indicator output shape for the whole platform.
 */
export interface IndicatorResult {
  outputType: IndicatorOutputType;
  values: (number | null)[];
  meta?: Record<string, any>;
}

/** Helper: find outputType from catalog (fallback to "numeric"). */
function getOutputTypeForId(id: IndicatorInstance["id"]): IndicatorOutputType {
  const def = INDICATOR_CATALOG.find((d) => d.id === id);
  return def?.outputType ?? "numeric";
}

/**
 * MAIN RUNTIME ENTRYPOINT
 *
 * Given:
 *  - indicator instance (id + params)
 *  - price bars
 *  - runtime context
 *
 * Return:
 *  - IndicatorResult with values aligned 1:1 to bars[]
 */
export function computeIndicatorSeries(
  inst: IndicatorInstance,
  bars: PriceBar[],
  _ctx: IndicatorRuntimeContext
): IndicatorResult {
  const outputType = getOutputTypeForId(inst.id);

  if (bars.length === 0) {
    return {
      outputType,
      values: [],
      meta: { reason: "no-bars" },
    };
  }

  switch (inst.id) {
    case "sobv_trend":
      return computeSobvTrend(inst, bars, outputType);

    case "kama_regime":
      return computeKamaRegime(inst, bars, outputType);

    case "darkflow_bias":
      return computeDarkflowBias(inst, bars, outputType);

    case "zscore_price_lookback":
      return computeZscorePrice(inst, bars, outputType);

    default:
      // Unknown indicator ID: return a null series, but keep the outputType.
      return {
        outputType,
        values: bars.map(() => null),
        meta: { reason: "unknown-indicator-id", id: inst.id },
      };
  }
}

/* ------------------------------------------------------------------------ */
/* sOBV Trend (short-volume-based OBV-style indicator)                      */
/* ------------------------------------------------------------------------ */

function computeSobvTrend(
  inst: IndicatorInstance,
  bars: PriceBar[],
  outputType: IndicatorOutputType
): IndicatorResult {
  // Lookback isn't strictly required for OBV, but you may want to
  // smooth or normalize later. Kept here for future usage.
  const lookback = Number(inst.params?.lookback ?? 20);

  const values: (number | null)[] = Array(bars.length).fill(null);
  let obv = 0;

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];

    const short = curr.shortVolume ?? curr.volume ?? 0;

    if (curr.close > prev.close) {
      obv += short;
    } else if (curr.close < prev.close) {
      obv -= short;
    } else {
      // flat close, no change
    }

    values[i] = obv;
  }

  // Optionally, you could normalize by a rolling window of volume using `lookback`
  // For now we return raw trend, which your preview + filters can interpret.

  return {
    outputType,
    values,
    meta: {
      rawType: "obv-like",
      usesShortVolume: true,
      lookback,
    },
  };
}

/* ------------------------------------------------------------------------ */
/* KAMA Regime: classify regime from KAMA slope                             */
/* ------------------------------------------------------------------------ */

function computeKamaRegime(
  inst: IndicatorInstance,
  bars: PriceBar[],
  outputType: IndicatorOutputType
): IndicatorResult {
  const fast = Number(inst.params?.fast ?? 2);
  const slow = Number(inst.params?.slow ?? 30);
  const erPeriod = 10; // Efficiency Ratio window

  const n = bars.length;
  const closes = bars.map((b) => b.close);
  const kama: (number | null)[] = Array(n).fill(null);
  const regimes: (number | null)[] = Array(n).fill(null);

  if (n <= erPeriod + 1) {
    return {
      outputType,
      values: regimes,
      meta: { reason: "not-enough-bars", erPeriod },
    };
  }

  const fastSC = 2 / (fast + 1);
  const slowSC = 2 / (slow + 1);

  // Initialize KAMA at erPeriod
  kama[erPeriod] = closes[erPeriod];

  for (let i = erPeriod + 1; i < n; i++) {
    // ER = ABS(Close(i) - Close(i-erPeriod)) / sum(|Close(k) - Close(k-1)|)
    const change = Math.abs(closes[i] - closes[i - erPeriod]);

    let volatility = 0;
    for (let k = i - erPeriod + 1; k <= i; k++) {
      volatility += Math.abs(closes[k] - closes[k - 1]);
    }

    const er = volatility === 0 ? 0 : change / volatility;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);

    const prevKama = kama[i - 1] ?? closes[i - 1];
    const nextKama = prevKama + sc * (closes[i] - prevKama);
    kama[i] = nextKama;

    // Regime classification from KAMA slope (very compresssed):
    const prev = kama[i - 1] ?? nextKama;
    const slopePct = Math.abs((nextKama - prev) / prev) * 100;

    // map slope to 0–3 regime code
    let regimeCode: number;
    if (slopePct < 0.15) {
      regimeCode = 0; // quiet
    } else if (slopePct < 0.45) {
      regimeCode = 1; // normal
    } else if (slopePct < 1.0) {
      regimeCode = 2; // expanding
    } else {
      regimeCode = 3; // crisis / very strong move
    }

    regimes[i] = regimeCode;
  }

  return {
    outputType, // should be "regime"
    values: regimes,
    meta: {
      erPeriod,
      fast,
      slow,
      interpretation: "0=quiet, 1=normal, 2=expanding, 3=crisis",
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Dark Flow Bias: score based on darkPoolVolume + bar direction            */
/* ------------------------------------------------------------------------ */

function computeDarkflowBias(
  inst: IndicatorInstance,
  bars: PriceBar[],
  outputType: IndicatorOutputType
): IndicatorResult {
  const n = bars.length;
  const values: (number | null)[] = Array(n).fill(null);

  const baseline = 0.2; // "normal" dark share baseline (20%)
  const alpha = 0.25;   // EMA smoothing for bias
  let emaBias = 0;

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const totalVol = b.volume || 1;
    const darkVol = b.darkPoolVolume ?? 0;

    const darkShare = darkVol / totalVol; // 0..1

    let direction = 0;
    if (b.close > b.open) direction = 1;
    else if (b.close < b.open) direction = -1;

    // raw bias around baseline
    let rawBias = direction * (darkShare - baseline);

    // scale rawBias into a soft range, e.g. -1..+1-ish
    rawBias = Math.max(-1, Math.min(1, rawBias * 5));

    // smooth it
    emaBias = alpha * rawBias + (1 - alpha) * emaBias;

    values[i] = emaBias;
  }

  return {
    outputType, // should be "score"
    values,
    meta: {
      baseline,
      alpha,
      interpretation: "Negative = distribution, Positive = accumulation-like",
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Price Z-Score over rolling lookback                                      */
/* ------------------------------------------------------------------------ */

function computeZscorePrice(
  inst: IndicatorInstance,
  bars: PriceBar[],
  outputType: IndicatorOutputType
): IndicatorResult {
  const closes = bars.map((b) => b.close);
  const defaultLookback = 10;
  const lookback = Math.max(
    2,
    Number(inst.params?.lookback ?? defaultLookback)
  );

  const n = closes.length;
  const values: (number | null)[] = Array(n).fill(null);

  if (n < lookback) {
    return {
      outputType,
      values,
      meta: { reason: "not-enough-bars", lookback },
    };
  }

  for (let i = lookback - 1; i < n; i++) {
    const start = i - lookback + 1;
    const window = closes.slice(start, i + 1);

    const mean =
      window.reduce((sum, v) => sum + v, 0) / window.length;

    const variance =
      window.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) /
      window.length;

    const std = Math.sqrt(variance);

    if (std === 0) {
      values[i] = 0;
    } else {
      values[i] = (closes[i] - mean) / std;
    }
  }

  return {
    outputType, // typically "numeric"
    values,
    meta: { lookback },
  };
}