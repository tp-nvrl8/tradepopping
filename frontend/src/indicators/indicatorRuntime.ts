import type { IndicatorId, IndicatorInstance } from "../lab/types";

export interface PriceBar {
  time: string; // ISO-8601 or any string timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  shortVolume?: number;
  darkPoolVolume?: number;
}

export interface IndicatorRuntimeContext {
  symbol: string;
  timeframe: string; // "1d", "1h", "15m", etc.
}

export interface IndicatorResult {
  id: IndicatorId;
  params: IndicatorInstance["params"];
  values: (number | null)[];
  meta?: Record<string, unknown>;
}

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

function simpleSma(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (window <= 1) {
    return values.map((v) => v);
  }

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) {
      sum -= values[i - window];
    }
    if (i >= window - 1) {
      out[i] = sum / window;
    }
  }
  return out;
}

function rollingMeanStd(
  values: number[],
  window: number
): { mean: (number | null)[]; std: (number | null)[] } {
  const mean: (number | null)[] = Array(values.length).fill(null);
  const std: (number | null)[] = Array(values.length).fill(null);
  if (window <= 1) {
    for (let i = 0; i < values.length; i++) {
      mean[i] = values[i];
      std[i] = 0;
    }
    return { mean, std };
  }

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v;
    sumSq += v * v;

    if (i >= window) {
      const old = values[i - window];
      sum -= old;
      sumSq -= old * old;
    }

    if (i >= window - 1) {
      const m = sum / window;
      mean[i] = m;
      const variance = Math.max(sumSq / window - m * m, 0);
      std[i] = Math.sqrt(variance);
    }
  }

  return { mean, std };
}

function computeSobvTrend(
  bars: PriceBar[],
  lookback: number
): (number | null)[] {
  const raw: number[] = [];
  let acc = 0;

  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      raw.push(0);
      continue;
    }

    const prevClose = bars[i - 1].close;
    const close = bars[i].close;
    const sign = Math.sign(close - prevClose);
    const baseVolume =
      bars[i].shortVolume ?? bars[i].volume ?? bars[i - 1].volume ?? 0;
    acc += sign * baseVolume;
    raw.push(acc);
  }

  const smoothed = simpleSma(raw, Math.max(1, Math.round(lookback)));
  return smoothed.map((v) => (v ?? null));
}

function computeKamaRegime(bars: PriceBar[]): (number | null)[] {
  const closes = bars.map((b) => b.close);
  const shortLen = 10;
  const longLen = 30;
  const alphaShort = 2 / (shortLen + 1);
  const alphaLong = 2 / (longLen + 1);
  let emaShort = closes[0] ?? 0;
  let emaLong = closes[0] ?? 0;

  const out: (number | null)[] = [];
  const volWindow = 14;
  const volBuffer: number[] = [];
  let volSum = 0;

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    if (i === 0) {
      out.push(0);
      continue;
    }

    emaShort = emaShort + alphaShort * (c - emaShort);
    emaLong = emaLong + alphaLong * (c - emaLong);

    const absReturn = Math.abs(c - closes[i - 1]);
    volBuffer.push(absReturn);
    volSum += absReturn;
    if (volBuffer.length > volWindow) {
      volSum -= volBuffer.shift() as number;
    }
    const avgVol = volBuffer.length ? volSum / volBuffer.length : 0;
    const trendIntensity = Math.abs(emaShort - emaLong) / Math.max(emaLong, 1e-6);

    let regime = 1; // normal
    if (avgVol < 0.003 && trendIntensity < 0.002) {
      regime = 0; // quiet
    } else if (avgVol < 0.012 && trendIntensity < 0.015) {
      regime = 1; // normal
    } else if (avgVol < 0.03 || trendIntensity < 0.05) {
      regime = 2; // expanding
    } else {
      regime = 3; // crisis
    }

    out.push(regime);
  }

  return out;
}

function computeDarkflowBias(bars: PriceBar[]): (number | null)[] {
  const out: (number | null)[] = [];
  let acc = 0;

  for (const bar of bars) {
    const vol = bar.volume ?? 0;
    const dpv = bar.darkPoolVolume ?? 0;
    const ratio = vol > 0 ? dpv / vol : 0;
    const centered = ratio - 0.5;
    acc += centered;
    const score = Math.max(-1, Math.min(1, acc));
    out.push(score);
  }

  return out;
}

function computeZScore(bars: PriceBar[], lookback: number): (number | null)[] {
  const closes = bars.map((b) => b.close);
  const { mean, std } = rollingMeanStd(closes, Math.max(2, Math.round(lookback)));
  return closes.map((c, idx) => {
    const m = mean[idx];
    const s = std[idx];
    if (m == null || s == null || s === 0) return null;
    return (c - m) / s;
  });
}

export function computeIndicatorSeries(
  instance: IndicatorInstance,
  bars: PriceBar[],
  ctx: IndicatorRuntimeContext
): IndicatorResult {
  const { id, params } = instance;
  let values: (number | null)[];

  switch (id) {
    case "sobv_trend": {
      const lookback = getNumberParam(params, "lookback", 20);
      values = computeSobvTrend(bars, lookback);
      break;
    }
    case "kama_regime": {
      values = computeKamaRegime(bars);
      break;
    }
    case "darkflow_bias": {
      values = computeDarkflowBias(bars);
      break;
    }
    case "zscore_price_lookback": {
      const lookback = getNumberParam(params, "lookback", 10);
      values = computeZScore(bars, lookback);
      break;
    }
    default: {
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

export function computeAllIndicatorSeries(
  instances: IndicatorInstance[],
  bars: PriceBar[],
  ctx: IndicatorRuntimeContext
): IndicatorResult[] {
  return instances
    .filter((inst) => inst.enabled)
    .map((inst) => computeIndicatorSeries(inst, bars, ctx));
}
