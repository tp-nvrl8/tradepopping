// frontend/src/indicators/indicatorRuntime.ts

import type { IndicatorInstance } from "../lab/types";
import {
  getIndicatorDefinition,
  type IndicatorDefinition,
} from "../lab/indicatorCatalog";

/**
 * Basic OHLCV bar with optional short/dark-pool volume.
 * This matches what mockPriceData.ts is producing.
 */
export interface PriceBar {
  time: string; // ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  shortVolume?: number;
  darkPoolVolume?: number;
}

/**
 * Runtime context for indicators – later we can add things like
 * market regime, sector info, etc. For now it's just a stub.
 */
export interface IndicatorRuntimeContext {
  symbol: string;
  timeframe: string; // e.g. "1d", "5m"
}

/**
 * How an indicator's output should be interpreted by the UI.
 *
 * - "numeric" → plain numeric line (MA, sOBV, etc.)
 * - "score"   → 0–100 or -1..+1 style score (bias, composite scores)
 * - "binary"  → 0 / 1 states (on/off, in-range/out-of-range)
 * - "regime"  → regime-like states (quiet / normal / expanding / crisis, etc.)
 */
export type IndicatorOutputType = "numeric" | "score" | "binary" | "regime";

/**
 * Standardized indicator output shape that the UI can render.
 */
export interface IndicatorResult {
  /** How the values should be visualized/interpreted. */
  outputType: IndicatorOutputType;

  /**
   * One primary numeric series.
   * For non-numeric things (like regime), we encode as numeric buckets
   * just for the tiny preview (e.g. 0, 1, 2, 3).
   */
  values: (number | null)[];
}

/**
 * Utility: simple moving average.
 */
function simpleMovingAverage(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }

    if (i >= period - 1) {
      out.push(sum / period);
    } else {
      out.push(null);
    }
  }

  return out;
}

/**
 * sOBV-like cumulative short-volume trend.
 * This is *not* production math, just a reasonable stand-in for preview.
 */
function computeSobvTrend(bars: PriceBar[]): IndicatorResult {
  const values: (number | null)[] = [];
  let acc = 0;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const vol = b.shortVolume ?? b.volume;
    if (i === 0) {
      values.push(0);
      continue;
    }

    const prevClose = bars[i - 1].close;
    if (b.close > prevClose) {
      acc += vol;
    } else if (b.close < prevClose) {
      acc -= vol;
    }
    values.push(acc);
  }

  return {
    outputType: "numeric",
    values,
  };
}

/**
 * Very lightweight "regime" proxy:
 * we look at a short ATR-like measure and bucket into 0..3
 * just for visualization.
 */
function computeKamaRegime(bars: PriceBar[]): IndicatorResult {
  if (bars.length === 0) {
    return { outputType: "regime", values: [] };
  }

  const trueRanges: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : b.close;
    const tr = Math.max(
      b.high - b.low,
      Math.abs(b.high - prevClose),
      Math.abs(b.low - prevClose)
    );
    trueRanges.push(tr);
  }

  const atr = simpleMovingAverage(trueRanges, 10);
  const values: (number | null)[] = atr.map((v) => {
    if (v == null) return null;
    if (v < 0.5) return 0;   // quiet
    if (v < 1.0) return 1;   // normal
    if (v < 1.8) return 2;   // expanding
    return 3;                // crisis
  });

  return {
    outputType: "regime",
    values,
  };
}

/**
 * Dark Flow bias: rough "score" between -1 and +1
 * based on short vs dark pool volume.
 */
function computeDarkFlowBias(bars: PriceBar[]): IndicatorResult {
  const values: (number | null)[] = [];

  for (const b of bars) {
    const sv = b.shortVolume ?? b.volume * 0.4;
    const dv = b.darkPoolVolume ?? b.volume * 0.2;
    const total = sv + dv;
    if (!total) {
      values.push(null);
      continue;
    }

    // positive if dark pool dominates, negative if short dominates
    const score = (dv - sv) / total;
    values.push(score); // ~ -1 .. +1
  }

  return {
    outputType: "score",
    values,
  };
}

/**
 * Z-score of closing price over a rolling lookback.
 */
function computeZScorePrice(
  bars: PriceBar[],
  lookback: number
): IndicatorResult {
  const closes = bars.map((b) => b.close);
  const values: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i + 1 < lookback) {
      values.push(null);
      continue;
    }

    const window = closes.slice(i + 1 - lookback, i + 1);
    const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
    const variance =
      window.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) /
      window.length;
    const std = Math.sqrt(variance) || 1;
    const z = (closes[i] - mean) / std;
    values.push(z);
  }

  return {
    outputType: "numeric",
    values,
  };
}

/**
 * Main runtime entrypoint.
 * Takes an IndicatorInstance + price series and produces
 * a standardized IndicatorResult for the UI.
 */
export function computeIndicatorSeries(
  instance: IndicatorInstance,
  bars: PriceBar[],
  _ctx: IndicatorRuntimeContext
): IndicatorResult {
  const def: IndicatorDefinition | undefined = getIndicatorDefinition(
    instance.id
  );

  switch (instance.id) {
    case "sobv_trend":
      return computeSobvTrend(bars);

    case "kama_regime":
      // preview only, not real KAMA math
      return computeKamaRegime(bars);

    case "darkflow_bias":
      return computeDarkFlowBias(bars);

    case "zscore_price_lookback": {
      const lookbackRaw =
        (instance.params?.lookback as number | undefined) ?? 10;
      const lookback = Math.max(5, Math.floor(lookbackRaw));
      return computeZScorePrice(bars, lookback);
    }

    default:
      // Fallback: numeric line of closing prices so the UI has *something*
      return {
        outputType: "numeric",
        values: bars.map((b) => b.close),
      };
  }
}