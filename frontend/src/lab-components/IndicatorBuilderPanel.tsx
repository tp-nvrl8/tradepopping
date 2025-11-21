import React, { useMemo, useState } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";
import type {
  IdeaIndicators,
  IndicatorId,
  IndicatorInstance,
} from "../lab/types";
import {
  INDICATOR_CATALOG,
  getIndicatorDefinition,
} from "../lab/indicatorCatalog";

interface IndicatorBuilderPanelProps {
  ideaName?: string;
  indicators: IdeaIndicators;
  onChangeIndicators: (next: IdeaIndicators) => void;
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

  const attached = indicators?.indicators ?? [];
  const [selectedId, setSelectedId] = useState<IndicatorId | null>(
    attached[0]?.id ?? null
  );

  // Any indicators not already attached
  const availableToAdd = useMemo(
    () =>
      INDICATOR_CATALOG.filter(
        (def) => !attached.some((inst) => inst.id === def.id)
      ),
    [attached]
  );

  const [addId, setAddId] = useState<IndicatorId | "">(() =>
    availableToAdd[0]?.id ?? ""
  );

  const handleAddIndicator = () => {
    if (!addId) return;
    const def = getIndicatorDefinition(addId);
    if (!def) return;

    const params: IndicatorInstance["params"] = {};
    for (const p of def.params) {
      if (p.defaultValue !== undefined) {
        params[p.key] = p.defaultValue;
      }
    }

    const next: IdeaIndicators = {
      indicators: [
        ...attached,
        {
          id: def.id,
          enabled: true,
          variant: "default",
          params: Object.keys(params).length ? params : undefined,
        },
      ],
    };
    onChangeIndicators(next);
    setSelectedId(def.id);
  };

  const handleRemoveIndicator = (id: IndicatorId) => {
    const nextList = attached.filter((inst) => inst.id !== id);
    const next: IdeaIndicators = { indicators: nextList };
    onChangeIndicators(next);

    if (selectedId === id) {
      setSelectedId(nextList[0]?.id ?? null);
    }
  };

  const handleToggleEnabled = (id: IndicatorId) => {
    const nextList = attached.map((inst) =>
      inst.id === id ? { ...inst, enabled: !inst.enabled } : inst
    );
    onChangeIndicators({ indicators: nextList });
  };

  const handleParamChange = (
    id: IndicatorId,
    key: string,
    rawValue: string | boolean
  ) => {
    const def = getIndicatorDefinition(id);
    if (!def) return;
    const paramDef = def.params.find((p) => p.key === key);
    if (!paramDef) return;

    const nextList = attached.map((inst) => {
      if (inst.id !== id) return inst;

      const nextParams: IndicatorInstance["params"] = {
        ...(inst.params ?? {}),
      };

      if (paramDef.type === "number") {
        const strVal = rawValue as string;
        if (strVal === "") {
          delete nextParams[key];
        } else {
          const num = Number(strVal);
          if (!Number.isNaN(num)) {
            nextParams[key] = num;
          }
        }
      } else if (paramDef.type === "boolean") {
        nextParams[key] = Boolean(rawValue);
      } else {
        // "select" or string-like
        const strVal = String(rawValue);
        if (!strVal) {
          delete nextParams[key];
        } else {
          nextParams[key] = strVal;
        }
      }

      return {
        ...inst,
        params: Object.keys(nextParams).length ? nextParams : undefined,
      };
    });

    onChangeIndicators({ indicators: nextList });
  };

  const selectedInstance: IndicatorInstance | undefined = attached.find(
    (inst) => inst.id === selectedId
  );
  const selectedDef =
    selectedInstance && getIndicatorDefinition(selectedInstance.id);

  return (
    <div
      className="text-xs rounded-md border flex flex-col gap-3 p-3"
      style={{
        background: tokens.surfaceMuted,
        borderColor: tokens.border,
        color: tokens.textPrimary,
      }}
    >
      {/* Top row: context + add indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Indicator Builder
          </div>
          <div className="text-[11px] text-slate-500">
            Attached to idea:{" "}
            <span className="font-semibold text-slate-200">
              {ideaName ?? "no idea selected"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={addId}
            onChange={(e) =>
              setAddId(e.target.value as IndicatorId | "")
            }
          >
            {availableToAdd.length === 0 ? (
              <option value="">All indicators attached</option>
            ) : (
              <>
                <option value="">Select indicator…</option>
                {availableToAdd.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <button
            type="button"
            onClick={handleAddIndicator}
            disabled={!addId}
            className="px-3 py-1.5 rounded-md text-[11px] font-semibold border border-sky-500 bg-sky-500/10 text-sky-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-500/20"
          >
            Add
          </button>
        </div>
      </div>

      {/* Main grid: attached list + parameter editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Attached indicators list */}
        <div
          className="rounded-md border p-2 space-y-2"
          style={{
            borderColor: tokens.border,
            background: tokens.surface,
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Attached Indicators
            </span>
            <span className="text-[10px] text-slate-500">
              {attached.length} total
            </span>
          </div>

          {attached.length === 0 ? (
            <div className="text-[11px] text-slate-500">
              No indicators attached yet. Use the dropdown above to add one.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {attached.map((inst) => {
                const def = getIndicatorDefinition(inst.id);
                const isSelected = inst.id === selectedId;
                return (
                  <li
                    key={inst.id}
                    className={`flex items-center justify-between gap-2 px-2 py-1 rounded-md border cursor-pointer ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 bg-slate-900/40 hover:bg-slate-900/70"
                    }`}
                    onClick={() => setSelectedId(inst.id)}
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold">
                        {def?.name ?? inst.id}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {def?.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-slate-400">
                        <input
                          type="checkbox"
                          checked={inst.enabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleEnabled(inst.id);
                          }}
                        />
                        <span>{inst.enabled ? "On" : "Off"}</span>
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveIndicator(inst.id);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md border border-rose-500 text-rose-200 bg-rose-500/10 hover:bg-rose-500/20"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Parameter editor */}
        <div
          className="rounded-md border p-2 space-y-2"
          style={{
            borderColor: tokens.border,
            background: tokens.surface,
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Parameters
            </span>
            {selectedDef && (
              <span className="text-[10px] text-slate-500">
                {selectedDef.name}
              </span>
            )}
          </div>

          {!selectedInstance || !selectedDef ? (
            <div className="text-[11px] text-slate-500">
              Select an indicator on the left to edit its parameters.
            </div>
          ) : selectedDef.params.length === 0 ? (
            <div className="text-[11px] text-slate-500">
              This indicator has no adjustable parameters.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDef.params.map((p) => {
                const currentValue =
                  selectedInstance.params?.[p.key] ?? p.defaultValue ?? "";

                if (p.type === "number") {
                  return (
                    <div key={p.key} className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        {p.label}
                      </label>
                      <input
                        type="number"
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                        value={currentValue === undefined ? "" : String(currentValue)}
                        onChange={(e) =>
                          handleParamChange(
                            selectedInstance.id,
                            p.key,
                            e.target.value
                          )
                        }
                        min={p.min}
                        max={p.max}
                        step={p.step ?? 1}
                      />
                      {p.helperText && (
                        <p className="text-[10px] text-slate-500">
                          {p.helperText}
                        </p>
                      )}
                    </div>
                  );
                }

                if (p.type === "boolean") {
                  return (
                    <label
                      key={p.key}
                      className="flex items-center gap-2 text-[11px] text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(currentValue)}
                        onChange={(e) =>
                          handleParamChange(
                            selectedInstance.id,
                            p.key,
                            e.target.checked
                          )
                        }
                      />
                      {p.label}
                    </label>
                  );
                }

                // select / string
                return (
                  <div key={p.key} className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      {p.label}
                    </label>
                    <select
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                      value={currentValue === undefined ? "" : String(currentValue)}
                      onChange={(e) =>
                        handleParamChange(
                          selectedInstance.id,
                          p.key,
                          e.target.value
                        )
                      }
                    >
                      <option value="">Select…</option>
                      {p.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {p.helperText && (
                      <p className="text-[10px] text-slate-500">
                        {p.helperText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndicatorBuilderPanel;
