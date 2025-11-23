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
  values: number[]; // sliced numeric points for sparkline
};

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

/**
 * Inline sparkline for indicator previews.
 */
const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 120,
  height = 32,
  stroke = "currentColor",
}) => {
  if (!values || values.length < 2) {
    return (
      <div className="text-[10px] text-slate-500">
        Not enough data for sparkline
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, idx) => {
      const x =
        values.length === 1
          ? width / 2
          : (idx / (values.length - 1)) * width;

      const norm = 1 - (v - min) / range;
      const y = norm * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-8"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        points={points}
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
      (v): v is number => typeof v === "number" && Number.isFinite(v)
    );

    const sparkValues =
      numericValues.length > 40
        ? numericValues.slice(numericValues.length - 40)
        : numericValues;

    const last = sparkValues.length
      ? sparkValues[sparkValues.length - 1]
      : null;
    const min = sparkValues.length ? Math.min(...sparkValues) : null;
    const max = sparkValues.length ? Math.max(...sparkValues) : null;

    setPreviewById((prev) => ({
      ...prev,
      [instanceKey]: {
        last,
        min,
        max,
        values: sparkValues,
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
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div className="font-semibold text-slate-200">Preview</div>

                    {preview.values && preview.values.length > 1 && (
                      <div className="mt-1 rounded bg-slate-950/60 border border-slate-800 px-2 py-1">
                        <Sparkline
                          values={preview.values}
                          stroke={tokens.accent}
                        />
                      </div>
                    )}

                    <div className="text-slate-400">
                      Last: {preview.last?.toFixed(3) ?? "—"} · Min:{" "}
                      {preview.min?.toFixed(3) ?? "—"} · Max: {" "}
                      {preview.max?.toFixed(3) ?? "—"}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IndicatorBuilderPanel;
