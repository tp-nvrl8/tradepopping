import React, { useState } from "react";
import { LabIdea } from "../lab/types";

interface PriceLiquidityFiltersProps {
  idea: LabIdea;
  onChangeRange: (field: string, bound: "min" | "max", raw: string) => void;
}

const PriceLiquidityFilters: React.FC<PriceLiquidityFiltersProps> = ({
  idea,
  onChangeRange,
}) => {
  const [open, setOpen] = useState(true);
  const cfg = idea.priceLiquidity;

  return (
    <section className="border border-slate-800 rounded-lg bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wide border-b border-slate-800 bg-slate-900/70 hover:bg-slate-800/80"
      >
        <span className="font-semibold text-slate-200">
          Price &amp; Liquidity Filters
        </span>
        <span className="text-slate-400 text-sm">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Price */}
            <div>
              <p className="text-slate-400 mb-1">Price ($)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.price?.min ?? ""}
                  onChange={(e) => onChangeRange("price", "min", e.target.value)}
                />
                <input
                  type="number"
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.price?.max ?? ""}
                  onChange={(e) => onChangeRange("price", "max", e.target.value)}
                />
              </div>
            </div>

            {/* Avg $ Volume */}
            <div>
              <p className="text-slate-400 mb-1">Avg $ Volume (daily)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.averageDailyDollarVolume?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "averageDailyDollarVolume",
                      "min",
                      e.target.value
                    )
                  }
                />
                <input
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.averageDailyDollarVolume?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "averageDailyDollarVolume",
                      "max",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            {/* Avg Share Volume */}
            <div>
              <p className="text-slate-400 mb-1">Avg Share Volume (daily)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.averageDailyShareVolume?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "averageDailyShareVolume",
                      "min",
                      e.target.value
                    )
                  }
                />
                <input
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.averageDailyShareVolume?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange(
                      "averageDailyShareVolume",
                      "max",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            {/* Float Shares */}
            <div>
              <p className="text-slate-400 mb-1">Float Shares (millions)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Min"
                  value={cfg.floatShares?.min ?? ""}
                  onChange={(e) =>
                    onChangeRange("floatShares", "min", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  placeholder="Max"
                  value={cfg.floatShares?.max ?? ""}
                  onChange={(e) =>
                    onChangeRange("floatShares", "max", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PriceLiquidityFilters;