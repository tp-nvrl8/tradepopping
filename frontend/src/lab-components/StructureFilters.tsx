import React, { useEffect, useState } from "react";
import { LabIdea } from "../lab/types";

interface StructureFiltersProps {
  idea: LabIdea;
  onChangeRange: (field: string, bound: "min" | "max", raw: string) => void;
}

const STORAGE_KEY = "tp_lab_filter_structure_open";

const StructureFilters: React.FC<StructureFiltersProps> = ({
  idea,
  onChangeRange,
}) => {
  const [open, setOpen] = useState(true);
  const cfg = idea.structure ?? {};

  // Load persisted open/closed state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        setOpen(raw === "1"); // "1" = open, "0" = closed
      }
    } catch {
      // ignore errors
    }
  }, []);

  // Save whenever `open` changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      // ignore errors
    }
  }, [open]);

  return (
    <section className="border border-slate-800 rounded-lg bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wide border-b border-slate-800 bg-slate-900/70 hover:bg-slate-800/80"
      >
        <span className="font-semibold text-slate-200">
          Structure Filters
        </span>
        <span className="text-slate-400 text-sm">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Short Interest % of Float */}
            <div>
              <p className="text-slate-400 mb-1">
                Short Interest % of Float
              </p>
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
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.vanishingFloatScore?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "vanishingFloatScore",
                      "min",
                      e.target.value
                    )
                  }
                />
                <input
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.vanishingFloatScore?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "vanishingFloatScore",
                      "max",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            {/* Room for future structure fields */}
          </div>
        </div>
      )}
    </section>
  );
};

export default StructureFilters;