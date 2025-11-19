import React from "react";

interface FilterComposerPanelProps {
  ideaName?: string;
}

const FilterComposerPanel: React.FC<FilterComposerPanelProps> = ({
  ideaName,
}) => {
  const name = ideaName ?? "no idea selected";

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/40 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
          Filter Composer
        </span>
        <span className="text-[10px] text-slate-500">
          Candidate engine for:{" "}
          <span className="font-semibold text-slate-200">{name}</span>
        </span>
      </div>

      {/* Body (stub for now) */}
      <div className="px-4 py-3 text-xs text-slate-300 space-y-2">
        <p>
          This panel will act like a StockFetcher-style filter builder for{" "}
          <span className="font-semibold">{name}</span>.
        </p>
        <p className="text-slate-400">
          Planned features:
        </p>
        <ul className="list-disc list-inside text-slate-400 space-y-1">
          <li>Human-readable filter sentences (price, volume, float, etc.)</li>
          <li>Underlying DSL expression that can be sent to the scanner</li>
          <li>Quick presets for common patterns (VCP, squeeze, mean reversion)</li>
          <li>Link to backtests and candidate list for this idea</li>
        </ul>
        <p className="text-[11px] text-slate-500">
          Also a stub for now – we&apos;re just carving out the layout so the
          Lab has clear “where things live” zones.
        </p>
      </div>
    </section>
  );
};

export default FilterComposerPanel;