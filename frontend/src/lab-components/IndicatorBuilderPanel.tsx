import React, { useMemo, useState } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";
import type { IndicatorInstance } from "../lab/types";
import {
  INDICATOR_CATALOG,
  type IndicatorDefinition,
  type IndicatorParamDef,
} from "../lab/indicatorCatalog";
import {
  computeIndicatorSeries,
  type IndicatorRuntimeContext,
} from "../indicators/indicatorRuntime";
import { MOCK_DAILY_BARS } from "../indicators/mockPriceData";

// --- Sparkline + preview types ---
type PreviewStats = {
  last: number | null;
  min: number | null;
  max: number | null;
  indicatorSeries: number[];
  priceSeries: number[];
};

const Sparkline: React.FC<{
  indicator: number[];
  price: number[];
}> = ({ indicator, price }) => {
  const width = 120;
  const height = 32;

  if (indicator.length < 2 || price.length < 2) {
    return null;
  }

  const maxLen = Math.min(indicator.length, price.length);

  const indSlice = indicator.slice(indicator.length - maxLen);
  const priceSlice = price.slice(price.length - maxLen);

  const allValues = [...indSlice, ...priceSlice];
  const vMin = Math.min(...allValues);
  const vMax = Math.max(...allValues);
  const span = vMax - vMin || 1;

  const scaleX = (i: number) =>
    (i / (maxLen - 1)) * (width - 4) + 2;
  const scaleY = (v: number) =>
    height - 2 - ((v - vMin) / span) * (height - 4);

  const toPath = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(v)}`)
      .join(" ");

  const indicatorPath = toPath(indSlice);
  const pricePath = toPath(priceSlice);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1"
    >
      <rect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        rx={3}
        ry={3}
        fill="transparent"
        stroke="rgba(148, 163, 184, 0.3)"
        strokeWidth={0.5}
      />
      {/* Price line (different color) */}
      <path
        d={pricePath}
        fill="none"
        stroke="#f97316"
        strokeWidth={1}
      />
      {/* Indicator line */}
      <path
        d={indicatorPath}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={1}
      />
    </svg>
  );
};

interface IndicatorBuilderPanelProps {
  ideaName?: string;
  indicators: IndicatorInstance[];
  onChangeIndicators: (next: IndicatorInstance[]) => void;
}

const IndicatorBuilderPanel: React.FC<IndicatorBuilderPanelProps> = ({
  ideaName,
  indicators,
  onChangeIndicators,
}) => {
  const tokens = useUiScopedTokens([
    "global",
    "page:lab",
    "region:lab:indicator",
  ]);

  const [selectedToAdd, setSelectedToAdd] = useState<string>("");
  const [infoOpen, setInfoOpen] = useState<Record<number, boolean>>({});
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [previewById, setPreviewById] = useState<Record<string, PreviewStats>>(
    {}
  );
  const [showSparklineHelp, setShowSparklineHelp] = useState(false);

  const catalogById = useMemo(() => {
    const map = new Map<string, IndicatorDefinition>();
    for (const def of INDICATOR_CATALOG) {
      map.set(def.id, def);
    }
    return map;
  }, []);

  const handleAddIndicator = () => {
    if (!selectedToAdd) return;

    const def = catalogById.get(selectedToAdd);
    if (!def) return;

    const params: IndicatorInstance["params"] = {};
    for (const p of def.params) {
      if (p.defaultValue !== undefined) {
        params[p.key] = p.defaultValue;
      }
    }

    const nextInstance: IndicatorInstance = {
      id: def.id,
      enabled: true,
      variant: "default",
      params: Object.keys(params).length ? params : undefined,
    };

    onChangeIndicators([...indicators, nextInstance]);
    setSelectedToAdd("");
  };

  const handleToggleEnabled = (index: number) => {
    const nextIndicators = indicators.map((inst, i) =>
      i === index ? { ...inst, enabled: !inst.enabled } : inst
    );
    onChangeIndicators(nextIndicators);
  };

  const toggleInfo = (index: number) => {
    setInfoOpen((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleDelete = (index: number) => {
    const nextIndicators = indicators.filter((_, i) => i !== index);
    onChangeIndicators(nextIndicators);
  };

  const toggleNotes = (id: string) => {
    setNotesOpen((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const moveIndicator = (index: number, direction: "up" | "down") => {
    const next = [...indicators];
    if (direction === "up") {
      if (index <= 0) return;
      const tmp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = tmp;
    } else {
      if (index >= next.length - 1) return;
      const tmp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = tmp;
    }
    onChangeIndicators(next);
  };

  const handleParamChange = (
    index: number,
    param: IndicatorParamDef,
    rawValue: string | boolean
  ) => {
    const nextIndicators = indicators.map((inst, i) => {
      if (i !== index) return inst;

      const nextParams: IndicatorInstance["params"] = {
        ...(inst.params ?? {}),
      };

      if (param.type === "number") {
        const strVal = rawValue as string;
        if (strVal === "") {
          delete nextParams[param.key];
        } else {
          const numVal = Number(strVal);
          if (!Number.isNaN(numVal)) {
            nextParams[param.key] = numVal;
          }
        }
      } else if (param.type === "boolean") {
        nextParams[param.key] = Boolean(rawValue);
      } else {
        const strVal = String(rawValue);
        if (!strVal) {
          delete nextParams[param.key];
        } else {
          nextParams[param.key] = strVal;
        }
      }

      const paramsToStore = Object.keys(nextParams).length
        ? nextParams
        : undefined;

      return {
        ...inst,
        params: paramsToStore,
      };
    });

    onChangeIndicators(nextIndicators);
  };

  const handlePreviewIndicator = (
    instanceKey: string,
    inst: IndicatorInstance
  ) => {
    const ctx: IndicatorRuntimeContext = {
      symbol: "MOCK",
      timeframe: "1d",
    };

    const series = computeIndicatorSeries(inst, MOCK_DAILY_BARS, ctx);
    const numericValues = series.values.filter(
      (v): v is number =>
        typeof v === "number" && Number.isFinite(v)
    );

    const last = numericValues.length
      ? numericValues[numericValues.length - 1]
      : null;
    const min = numericValues.length
      ? Math.min(...numericValues)
      : null;
    const max = numericValues.length
      ? Math.max(...numericValues)
      : null;

    // Build aligned indicator + price series (using only numeric indicator values)
    const indicatorSeries: number[] = [];
    const priceSeries: number[] = [];

    if (numericValues.length > 0) {
      const closes = MOCK_DAILY_BARS.map((b) => b.close);

      // Use the last N bars matching numericValues length
      const N = Math.min(numericValues.length, closes.length);
      const startIdx = closes.length - N;

      for (let i = 0; i < N; i++) {
        indicatorSeries.push(numericValues[numericValues.length - N + i]);
        priceSeries.push(closes[startIdx + i]);
      }
    }

    setPreviewById((prev) => ({
      ...prev,
      [instanceKey]: {
        last,
        min,
        max,
        indicatorSeries,
        priceSeries,
      },
    }));
  };

  return (
    <div
      className="text-xs rounded-md border flex flex-col gap-3 p-3"
      style={{
        background: tokens.surfaceMuted,
        borderColor: tokens.border,
        color: tokens.textPrimary,
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Indicator Builder
          </div>
          <div className="text-[11px] text-slate-500">
            Attached to idea: {" "}
            <span className="font-semibold text-slate-200">
              {ideaName ?? "no idea selected"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={selectedToAdd}
            onChange={(e) => setSelectedToAdd(e.target.value)}
          >
            <option value="">Select indicator…</option>
            {INDICATOR_CATALOG.map((def) => (
              <option key={def.id} value={def.id}>
                {def.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddIndicator}
            className="px-3 py-1.5 rounded-md text-[11px] font-semibold border border-sky-500 bg-sky-500/10 text-sky-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-500/20"
            disabled={!selectedToAdd}
          >
            Add indicator
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {indicators.length === 0 ? (
          <div className="text-[11px] text-slate-500">
            No indicators attached yet. Use the dropdown above to add one.
          </div>
        ) : (
          indicators.map((inst, index) => {
            const instanceKey = String(index);
            const def = catalogById.get(inst.id);
            const preview = previewById[instanceKey];
            return (
              <div
                key={instanceKey}
                className="rounded-md border p-3 space-y-2"
                style={{
                  borderColor: tokens.border,
                  background: tokens.surface,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[12px] font-semibold">
                      <span>{def?.name ?? inst.id}</span>
                      {def?.description && (
                        <button
                          type="button"
                          onClick={() => toggleInfo(index)}
                          className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                          ⓘ
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {def?.category ?? "Uncategorized"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveIndicator(index, "up")}
                        disabled={index === 0}
                        className="px-1.5 py-0.5 text-[10px] rounded border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveIndicator(index, "down")}
                        disabled={index === indicators.length - 1}
                        className="px-1.5 py-0.5 text-[10px] rounded border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800"
                      >
                        ↓
                      </button>
                    </div>
                    {def?.description && (
                      <button
                        type="button"
                        onClick={() => toggleInfo(index)}
                        className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        ⓘ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePreviewIndicator(instanceKey, inst)}
                      className="text-[10px] px-2 py-0.5 rounded border border-emerald-500 text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSparklineHelp(true)}
                      className="text-[10px] px-2 py-0.5 rounded border border-slate-600/60 text-slate-300 hover:bg-slate-800"
                    >
                      ?
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleNotes(instanceKey)}
                      className="text-[10px] px-2 py-0.5 rounded border border-slate-600/60 text-slate-300 hover:bg-slate-800"
                    >
                      Notes
                    </button>
                    <label className="flex items-center gap-1 text-[10px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={inst.enabled}
                        onChange={() => handleToggleEnabled(index)}
                      />
                      <span>{inst.enabled ? "On" : "Off"}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className="text-[10px] px-2 py-0.5 rounded-md border border-rose-500 text-rose-200 bg-rose-500/10 hover:bg-rose-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {def && (
                  <div className="mb-2 text-[11px] text-slate-300">
                    <div className="font-semibold">
                      {def.name}
                      <span className="ml-2 text-[10px] text-slate-500">
                        ({def.category})
                      </span>
                    </div>
                    {def.summary && (
                      <div className="text-slate-400">{def.summary}</div>
                    )}
                    {infoOpen[index] && def.description && (
                      <div className="mt-1 text-[11px] text-slate-400 leading-snug">
                        {def.description}
                      </div>
                    )}
                  </div>
                )}

                {def && def.params.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {def.params.map((param) => {
                      const currentValue = inst.params?.[param.key];

                      if (param.type === "number") {
                        return (
                          <div key={param.key} className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-300">
                              {param.label}
                            </label>
                            <input
                              type="number"
                              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                              value={
                                currentValue === undefined
                                  ? ""
                                  : String(currentValue)
                              }
                              onChange={(e) =>
                                handleParamChange(index, param, e.target.value)
                              }
                              min={param.min}
                              max={param.max}
                              step={param.step ?? 1}
                            />
                            {param.helperText && (
                              <p className="text-[10px] text-slate-500">
                                {param.helperText}
                              </p>
                            )}
                          </div>
                        );
                      }

                      if (param.type === "select") {
                        return (
                          <div key={param.key} className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-300">
                              {param.label}
                            </label>
                            <select
                              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                              value={
                                currentValue === undefined
                                  ? ""
                                  : String(currentValue)
                              }
                              onChange={(e) =>
                                handleParamChange(index, param, e.target.value)
                              }
                            >
                              <option value="">Select…</option>
                              {param.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {param.helperText && (
                              <p className="text-[10px] text-slate-500">
                                {param.helperText}
                              </p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <label
                          key={param.key}
                          className="flex items-center gap-2 text-[11px] text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(currentValue)}
                            onChange={(e) =>
                              handleParamChange(index, param, e.target.checked)
                            }
                          />
                          {param.label}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    This indicator has no adjustable parameters.
                  </div>
                )}

                {notesOpen[instanceKey] && (
                  <div className="mt-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Observations / Notes
                    </label>
                    <textarea
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 min-h-[60px]"
                      placeholder="What did you notice about this indicator for this idea?"
                      value={(inst.notes ?? "") as string}
                      onChange={(e) => {
                        const nextNotes = e.target.value;
                        const nextList = indicators.map((ind, idx) =>
                          idx === index ? { ...ind, notes: nextNotes } : ind
                        );
                        onChangeIndicators(nextList);
                      }}
                    />
                  </div>
                )}

                {preview && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-slate-200">
                        Preview
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Last: {preview.last?.toFixed(3) ?? "—"} · Min:{" "}
                        {preview.min?.toFixed(3) ?? "—"} · Max:{" "}
                        {preview.max?.toFixed(3) ?? "—"}
                      </div>
                    </div>

                    {(() => {
                      const width = 220;
                      const height = 96;
                      const paddingTop = 4;
                      const paddingBottom = 14;
                      const innerHeight = height - paddingTop - paddingBottom;

                      const ctx: IndicatorRuntimeContext = {
                        symbol: "MOCK",
                        timeframe: "1d",
                      };

                      // Recompute series here so the chart reflects current params
                      const series = computeIndicatorSeries(inst, MOCK_DAILY_BARS, ctx);
                      const rawValues = (series.values ?? []) as (number | null | undefined)[];

                      const indicatorValues = rawValues.filter(
                        (v): v is number => typeof v === "number" && Number.isFinite(v)
                      );
                      const priceValues = MOCK_DAILY_BARS.map((b) => b.close);

                      const n = Math.min(indicatorValues.length, priceValues.length);
                      if (!n) return null;

                      const vals = indicatorValues.slice(-n);
                      const prices = priceValues.slice(-n);

                      const minVal = Math.min(...vals);
                      const maxVal = Math.max(...vals);
                      const minPrice = Math.min(...prices);
                      const maxPrice = Math.max(...prices);

                      const valueRange = maxVal - minVal || 1;
                      const priceRange = maxPrice - minPrice || 1;

                      const stepX = width / Math.max(n - 1, 1);

                      const yForVal = (v: number) =>
                        paddingTop +
                        innerHeight -
                        ((v - minVal) / valueRange) * innerHeight;

                      const yForPrice = (p: number) =>
                        paddingTop +
                        innerHeight -
                        ((p - minPrice) / priceRange) * innerHeight;

                      const indicatorPath = vals
                        .map((v, i) => `${i * stepX},${yForVal(v)}`)
                        .join(" ");

                      const pricePath = prices
                        .map((p, i) => `${i * stepX},${yForPrice(p)}`)
                        .join(" ");

                      let zeroY: number | null = null;
                      if (minVal <= 0 && maxVal >= 0) {
                        zeroY = yForVal(0);
                      }

                      const lastX = (n - 1) * stepX;
                      const lastY = yForVal(vals[vals.length - 1]);

                      return (
                        <svg
                          width={width}
                          height={height}
                          viewBox={`0 0 ${width} ${height}`}
                          className="mt-1 rounded border border-slate-800 bg-slate-950/60"
                          preserveAspectRatio="none"
                        >
                          {/* Background */}
                          <rect
                            x={0}
                            y={0}
                            width={width}
                            height={height}
                            fill="transparent"
                          />

                          {/* Horizontal grid lines */}
                          {[0.25, 0.5, 0.75].map((frac, idx) => {
                            const y = paddingTop + innerHeight * frac;
                            return (
                              <line
                                key={idx}
                                x1={0}
                                x2={width}
                                y1={y}
                                y2={y}
                                stroke="rgba(148,163,184,0.25)"
                                strokeWidth={0.5}
                              />
                            );
                          })}

                          {/* Zero line if indicator crosses 0 */}
                          {zeroY !== null && (
                            <line
                              x1={0}
                              x2={width}
                              y1={zeroY}
                              y2={zeroY}
                              stroke="#334155"
                              strokeDasharray="3 3"
                              strokeWidth={0.7}
                            />
                          )}

                          {/* Price line (muted) */}
                          <polyline
                            fill="none"
                            stroke="#64748b"
                            strokeWidth={1}
                            strokeOpacity={0.85}
                            points={pricePath}
                          />

                          {/* Indicator line (highlight) */}
                          <polyline
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth={1.4}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            points={indicatorPath}
                          />

                          {/* Last value marker */}
                          <circle cx={lastX} cy={lastY} r={2.3} fill="#22c55e" />
                        </svg>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showSparklineHelp && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="max-w-xl w-[90vw] max-h-[80vh] overflow-y-auto bg-slate-950 border border-slate-700 rounded-lg p-4 text-xs text-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-100">
                Sparkline Interpretation Guide
              </h2>
              <button
                type="button"
                onClick={() => setShowSparklineHelp(false)}
                className="text-[11px] px-2 py-0.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-[11px] leading-snug">
              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  What sparkline previews are
                </h3>
                <p className="text-slate-300">
                  A sparkline is a tiny chart showing the most recent values of an indicator.
                  It lets you quickly judge the shape, quality, and behavior of the signal:
                  are you seeing trends, oscillations, compression, or just noise?
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  1. Does the indicator behave how you expect?
                </h3>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Smooth drift is typical for trend/regime indicators.</li>
                  <li>Up-and-down waves are typical for mean reversion tools.</li>
                  <li>Sudden expansions and compressions are typical for volatility tools.</li>
                  <li>Stable zones or plateaus are typical for regime or threshold flags.</li>
                </ul>
                <p className="text-slate-400 mt-1">
                  If the sparkline looks like pure random static, the configuration is probably wrong
                  or the indicator is not a good fit for this idea.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  2. Using sparklines to tune parameters
                </h3>
                <p className="text-slate-300">
                  Change lookbacks and thresholds, then glance at the sparkline:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li><span className="font-semibold">Too smooth:</span> reacts slowly, may miss entries.</li>
                  <li><span className="font-semibold">Too jagged:</span> over-reacts to noise, whipsaws a lot.</li>
                  <li><span className="font-semibold">Almost flat:</span> window is too long or normalization is off.</li>
                  <li><span className="font-semibold">Violent spikes everywhere:</span> thresholds are too tight or the formula is unstable.</li>
                </ul>
                <p className="text-slate-400 mt-1">
                  Your goal is a shape that matches how you want to trade the idea
                  (gentle regime drift, sharp extremes, clear bursts of pressure, etc.).
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  3. Reading divergence (math vs price)
                </h3>
                <p className="text-slate-300">
                  When this is wired to real price data, you can compare the indicator sparkline
                  to a price sparkline:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Indicator rising while price is flat: possible accumulation.</li>
                  <li>Indicator falling while price is flat: possible distribution.</li>
                  <li>Indicator flattening while price still trends: trend is aging or losing strength.</li>
                  <li>Indicator curling up while price is still weak: selling may be exhausting.</li>
                </ul>
                <p className="text-slate-400 mt-1">
                  This is the visual version of “math moves first, price catches up later”.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  4. Spotting hidden structure
                </h3>
                <p className="text-slate-300">
                  Over time you&apos;ll recognize recurring shapes:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Flat then sudden expansion: volatility squeeze and release.</li>
                  <li>Repeated spikes around the same level: strong reaction zone.</li>
                  <li>Gentle curling turns: trend transitions rather than hard reversals.</li>
                  <li>Plateaus at extreme values: persistent pressure or regime lock-in.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  5. Quality check before using an indicator in scoring
                </h3>
                <p className="text-slate-300">
                  Before you rely on an indicator in Candidates or the Test Stand, ask:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Does this sparkline clearly react to meaningful changes?</li>
                  <li>Are there obvious extremes that would make good entry/exit zones?</li>
                  <li>Does the pattern look stable across time, or completely random?</li>
                </ul>
                <p className="text-slate-400 mt-1">
                  If the sparkline doesn&apos;t show anything tradeable, consider removing the indicator
                  from this idea or adjusting the parameters.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  6. Debugging data problems
                </h3>
                <p className="text-slate-300">
                  Sparkline shapes can also reveal data issues:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li><span className="font-semibold">Perfectly flat line:</span> missing data, wrong symbol, or constant value.</li>
                  <li><span className="font-semibold">Single giant spike:</span> one bad bar or outlier from the feed.</li>
                  <li><span className="font-semibold">Saw-tooth pattern:</span> sorting or duplicate-bar issues.</li>
                  <li><span className="font-semibold">Gaps in values:</span> missing days or inconsistent history length.</li>
                </ul>
                <p className="text-slate-400 mt-1">
                  If something looks off, it probably is — check the upstream data before trusting the signal.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  7. Comparing indicators side by side
                </h3>
                <p className="text-slate-300">
                  With multiple indicators stacked, you can see:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Which ones move together (redundant signals).</li>
                  <li>Which ones lead or lag (good for stacking entries and exits).</li>
                  <li>Which ones only wake up in certain regimes.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-slate-100 mb-1">
                  8. The big question
                </h3>
                <p className="text-slate-300">
                  For each indicator, the sparkline is asking:
                </p>
                <p className="italic text-slate-200 mt-1">
                  “Does this line give me anything I can actually trade?”
                </p>
                <p className="text-slate-400 mt-1">
                  If the answer is no, simplify the idea or adjust the math until the sparkline
                  tells a clear, repeatable story.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorBuilderPanel;
