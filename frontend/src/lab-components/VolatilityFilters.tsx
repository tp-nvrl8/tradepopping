import React, { useEffect, useState } from "react";
import { LabIdea } from "../lab/types";

interface VolatilityFiltersProps {
  idea: LabIdea;
  onChangeRange: (field: string, bound: "min" | "max", raw: string) => void;
}

const STORAGE_KEY = "tp_lab_filter_volatility_open";

const VolatilityFilters: React.FC<VolatilityFiltersProps> = ({
  idea,
  onChangeRange,
}) => {
  const [open, setOpen] = useState(true);
  const cfg = idea.volatility ?? {};

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
          Volatility Filters
        </span>
        <span className="text-slate-400 text-sm">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* ATR % */}
            <div>
              <p className="text-slate-400 mb-1">ATR % (daily)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.atrPercent?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange("atrPercent", "min", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.atrPercent?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange("atrPercent", "max", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Historical Volatility % */}
            <div>
              <p className="text-slate-400 mb-1">HV % (lookback)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.hvPercent?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange("hvPercent", "min", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.hvPercent?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange("hvPercent", "max", e.target.value)
                  }
                />
              </div>
            </div>

            {/* You can add more volatility-related fields here later */}
          </div>
        </div>
      )}
    </section>
  );
};

export default VolatilityFilters;