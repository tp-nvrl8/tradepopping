import React, { useState } from "react";
import { LabIdea } from "../lab/types";

interface StructureFiltersProps {
  idea: LabIdea;
  onChangeRange: (field: string, bound: "min" | "max", raw: string) => void;
}

const StructureFilters: React.FC<StructureFiltersProps> = ({
  idea,
  onChangeRange,
}) => {
  const [open, setOpen] = useState(true);
  const cfg = idea.structure;

  return (
    <section className="border border-slate-800 rounded-lg bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wide border-b border-slate-800 bg-slate-900/70 hover:bg-slate-800/80"
      >
        <span className="font-semibold text-slate-200">
          Structural Constraints
        </span>
        <span className="text-slate-400 text-sm">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Short % of Float */}
            <div>
              <p className="text-slate-400 mb-1">Short % of Float</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.shortInterestPercentFloat?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "shortInterestPercentFloat",
                      "min",
                      e.target.value
                    )
                  }
                />
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.shortInterestPercentFloat?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "shortInterestPercentFloat",
                      "max",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            {/* Days to Cover */}
            <div>
              <p className="text-slate-400 mb-1">Days to Cover</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.daysToCover?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange("daysToCover", "min", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.daysToCover?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange("daysToCover", "max", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Vanishing Float Score */}
            <div>
              <p className="text-slate-400 mb-1">Vanishing Float Score</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.vanishingFloatScore?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange("vanishingFloatScore", "min", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.vanishingFloatScore?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange("vanishingFloatScore", "max", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[11px] text-slate-400 mb-1">
              Indicators &amp; overlays selected for this idea:
            </p>
            <div className="flex flex-wrap gap-1">
              {idea.indicators.indicators.map((ind) => (
                <span
                  key={ind.id + (ind.variant || "")}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    ind.enabled
                      ? "border-sky-500 text-sky-200 bg-sky-500/10"
                      : "border-slate-700 text-slate-400 bg-slate-900"
                  }`}
                >
                  {ind.id}
                  {ind.variant ? ` (${ind.variant})` : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default StructureFilters;