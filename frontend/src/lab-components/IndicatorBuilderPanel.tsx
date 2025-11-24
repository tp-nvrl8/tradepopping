import React, { useMemo, useState } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";
import type { IndicatorInstance } from "../lab/types";
import {
  INDICATOR_CATALOG,
  type IndicatorDefinition,
  type IndicatorParamDef,
  type IndicatorOutputType,
} from "../lab/indicatorCatalog";
import {
  computeIndicatorSeries,
  type IndicatorRuntimeContext,
} from "../indicators/indicatorRuntime";
import { MOCK_DAILY_BARS } from "../indicators/mockPriceData";

interface IndicatorBuilderPanelProps {
  ideaName?: string;
  indicators: IndicatorInstance[];
  onChangeIndicators: (next: IndicatorInstance[]) => void;
}

type PreviewSnapshot = {
  outputType: IndicatorOutputType;
  values: (number | null)[];
  last: number | null;
  min: number | null;
  max: number | null;
};

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
  const [previewById, setPreviewById] = useState<
    Record<string, PreviewSnapshot>
  >({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [modalPreviewKey, setModalPreviewKey] = useState<string | null>(null);

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

    const result = computeIndicatorSeries(inst, MOCK_DAILY_BARS, ctx);
    const numericValues = result.values.filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v)
    );

    const last = numericValues.length
      ? numericValues[numericValues.length - 1]
      : null;
    const min = numericValues.length ? Math.min(...numericValues) : null;
    const max = numericValues.length ? Math.max(...numericValues) : null;

    setPreviewById((prev) => ({
      ...prev,
      [instanceKey]: {
        outputType: result.outputType,
        values: result.values,
        last,
        min,
        max,
      },
    }));
  };

  /**
   * Render sparkline; size = "small" (inline) or "large" (modal).
   */
  const renderSparkline = (
    preview: PreviewSnapshot,
    size: "small" | "large" = "small"
  ) => {
    const width = size === "large" ? 320 : 180;
    const height = size === "large" ? 120 : 50;
    const padding = 5;

    const rawValues = preview.values;
    const numericValues = rawValues
      .map((v) => (v == null ? null : Number(v)))
      .filter((v): v is number => Number.isFinite(v));

    if (numericValues.length < 2) {
      return (
        <div className="text-[10px] text-slate-500">
          Not enough data to preview yet.
        </div>
      );
    }

    let min = preview.min ?? Math.min(...numericValues);
    let max = preview.max ?? Math.max(...numericValues);
    if (min === max) {
      min -= 1;
      max += 1;
    }

    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    const scaleX = (index: number, length: number) =>
      length <= 1
        ? padding + usableWidth / 2
        : padding + (index / (length - 1)) * usableWidth;

    const scaleY = (value: number) => {
      const t = (value - min) / (max - min);
      const clamped = Math.max(0, Math.min(1, t));
      return padding + (1 - clamped) * usableHeight;
    };

    const valuesForPath = rawValues.map((v) =>
      v == null ? null : Number(v)
    );

    const buildLinePath = () => {
      let d = "";
      for (let i = 0; i < valuesForPath.length; i++) {
        const v = valuesForPath[i];
        if (v == null || !Number.isFinite(v)) continue;
        const x = scaleX(i, valuesForPath.length);
        const y = scaleY(v);
        d += d ? ` L ${x} ${y}` : `M ${x} ${y}`;
      }
      return d || "M 0 0";
    };

    const outputType = preview.outputType;

    if (outputType === "regime") {
      const regimeColors: Record<number, string> = {
        0: "#38bdf8", // quiet
        1: "#22c55e", // normal
        2: "#eab308", // expanding
        3: "#f97316", // crisis
      };

      const segmentWidth =
        usableWidth / Math.max(1, valuesForPath.length);

      return (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="#020617"
            rx={4}
          />
          {valuesForPath.map((v, i) => {
            if (v == null || !Number.isFinite(v)) return null;
            const code = Math.round(v);
            const color = regimeColors[code] ?? "#64748b";
            const x = padding + i * segmentWidth;
            return (
              <rect
                key={i}
                x={x}
                y={padding}
                width={segmentWidth + 0.5}
                height={usableHeight}
                fill={color}
                opacity={0.7}
              />
            );
          })}
          <rect
            x={padding}
            y={padding}
            width={usableWidth}
            height={usableHeight}
            fill="none"
            stroke="#0f172a"
            strokeWidth={0.8}
            rx={3}
          />
        </svg>
      );
    }

    if (outputType === "binary") {
      const path = buildLinePath();

      return (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="#020617"
            rx={4}
          />
          <path
            d={path}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.4}
          />
          {valuesForPath.map((v, i) => {
            if (v == null || !Number.isFinite(v)) return null;
            const x = scaleX(i, valuesForPath.length);
            const y = scaleY(v);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={2.1}
                fill="#e5e7eb"
                stroke="#0f172a"
                strokeWidth={0.7}
              />
            );
          })}
          <rect
            x={padding}
            y={padding}
            width={usableWidth}
            height={usableHeight}
            fill="none"
            stroke="#0f172a"
            strokeWidth={0.8}
            rx={3}
          />
        </svg>
      );
    }

    if (outputType === "score") {
      const path = buildLinePath();

      const midValue = (min + max) / 2;
      const midY = scaleY(midValue);
      const bandHeight = usableHeight * 0.16;

      return (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="#020617"
            rx={4}
          />
          <rect
            x={padding}
            width={usableWidth}
            y={midY - bandHeight / 2}
            height={bandHeight}
            fill="#22c55e"
            opacity={0.12}
          />
          <line
            x1={padding}
            x2={padding + usableWidth}
            y1={midY}
            y2={midY}
            stroke="#22c55e"
            strokeDasharray="3 3"
            strokeWidth={0.8}
          />
          <path
            d={path}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={1.4}
          />
          <rect
            x={padding}
            y={padding}
            width={usableWidth}
            height={usableHeight}
            fill="none"
            stroke="#0f172a"
            strokeWidth={0.8}
            rx={3}
          />
        </svg>
      );
    }

    // Default numeric
    const path = buildLinePath();

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#020617"
          rx={4}
        />
        <path
          d={path}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1.4}
        />
        <rect
          x={padding}
          y={padding}
          width={usableWidth}
          height={usableHeight}
          fill="none"
          stroke="#0f172a"
          strokeWidth={0.8}
          rx={3}
        />
      </svg>
    );
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
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Indicator Builder
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="px-1.5 py-0.5 rounded-md border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800"
              title="How to read indicator previews"
            >
              ?
            </button>
          </div>
          <div className="text-[11px] text-slate-500">
            Attached to idea:{" "}
            <span className="font-semibold text-slate-200">
              {ideaName ?? "no idea selected"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* Indicator list */}
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

                      {def?.outputType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-700 text-slate-300 uppercase tracking-wide">
                          {def.outputType}
                        </span>
                      )}

                      {def?.description && (
                        <button
                          type="button"
                          onClick={() => toggleInfo(index)}
                          className="ml-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
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
                    <button
                      type="button"
                      onClick={() => handlePreviewIndicator(instanceKey, inst)}
                      className="text-[10px] px-2 py-0.5 rounded border border-emerald-500 text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Refresh preview then open modal
                        handlePreviewIndicator(instanceKey, inst);
                        setModalPreviewKey(instanceKey);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded border border-slate-600/60 text-slate-300 hover:bg-slate-800"
                      title="Open larger preview"
                    >
                      ⤢
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
                      value={(inst as any).notes ?? ""}
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
                  <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        Preview ({preview.outputType})
                      </span>
                      <span className="text-slate-400">
                        Last:{" "}
                        {preview.last != null
                          ? preview.last.toFixed(3)
                          : "—"}
                        {" · "}Min:{" "}
                        {preview.min != null
                          ? preview.min.toFixed(3)
                          : "—"}
                        {" · "}Max:{" "}
                        {preview.max != null
                          ? preview.max.toFixed(3)
                          : "—"}
                      </span>
                    </div>
                    <div>{renderSparkline(preview, "small")}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Large preview modal */}
      {modalPreviewKey && previewById[modalPreviewKey] && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 w-[95%] max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-200">
                  Indicator Preview
                </div>
                <div className="text-[11px] text-slate-400">
                  Larger sparkline preview for this indicator.
                </div>
              </div>
              <button
                onClick={() => setModalPreviewKey(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-slate-300 mb-2">
              <span className="font-semibold">
                Output type: {previewById[modalPreviewKey].outputType}
              </span>
              <span className="ml-2 text-slate-400">
                Last:{" "}
                {previewById[modalPreviewKey].last != null
                  ? previewById[modalPreviewKey].last!.toFixed(3)
                  : "—"}
                {" · "}
                Min:{" "}
                {previewById[modalPreviewKey].min != null
                  ? previewById[modalPreviewKey].min!.toFixed(3)
                  : "—"}
                {" · "}
                Max:{" "}
                {previewById[modalPreviewKey].max != null
                  ? previewById[modalPreviewKey].max!.toFixed(3)
                  : "—"}
              </span>
            </div>

            <div className="border border-slate-800 rounded-md bg-slate-950/60 p-3">
              {renderSparkline(previewById[modalPreviewKey], "large")}
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 w-[90%] max-w-lg shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-slate-200">
                How to Read Indicator Previews
              </h2>
              <button
                onClick={() => setHelpOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-[11px] text-slate-300 leading-relaxed">
              <div>
                <div className="font-semibold text-sky-300 mb-1">
                  Numeric (blue line)
                </div>
                <p>
                  Standard indicator output like moving averages, Z-Score, or sOBV
                  trend. Look for slope, stability, breakouts, and peaks/valleys.
                </p>
              </div>

              <div>
                <div className="font-semibold text-emerald-300 mb-1">
                  Score (green band + midline)
                </div>
                <p>
                  Scores typically range from -1 to +1 or 0 to 100. Crossing the
                  midline shows bias flipping from bearish to bullish (or
                  the opposite). Clustering near extremes hints at strong
                  conviction.
                </p>
              </div>

              <div>
                <div className="font-semibold text-amber-300 mb-1">
                  Regime (colored strips)
                </div>
                <p>
                  Regime previews encode quiet / normal / expanding / crisis
                  states as color bands. Rapid regime changes often precede
                  volatility expansions. Stable colors mean a consistent
                  environment.
                </p>
              </div>

              <div>
                <div className="font-semibold text-rose-300 mb-1">
                  Binary (dots or steps)
                </div>
                <p>
                  Binary indicators show simple on/off states. Use them as
                  filters or triggers: clusters of "on" can mark high
                  conviction zones, scattered signals can indicate noise.
                </p>
              </div>

              <div>
                <div className="font-semibold text-indigo-300 mb-1">
                  Multi-Series (future)
                </div>
                <p>
                  Some indicators output multiple series (bands, envelopes,
                  ranges). These appear as stacked micro-bands in the preview
                  so you can see compression, expansion, and where price sits
                  inside the band.
                </p>
              </div>
            </div>

            <div className="mt-4 text-right">
              <button
                onClick={() => setHelpOpen(false)}
                className="px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorBuilderPanel;