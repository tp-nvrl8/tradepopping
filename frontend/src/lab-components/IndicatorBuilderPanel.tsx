import React from "react";

interface IndicatorBuilderPanelProps {
  ideaName?: string;
}

const IndicatorBuilderPanel: React.FC<IndicatorBuilderPanelProps> = ({
  ideaName,
}) => {
  const name = ideaName ?? "no idea selected";

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/40 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
          Indicator Builder
        </span>
        <span className="text-[10px] text-slate-500">
          Attached to idea:{" "}
          <span className="font-semibold text-slate-200">{name}</span>
        </span>
      </div>

      {/* Body (stub for now) */}
      <div className="px-4 py-3 text-xs text-slate-300 space-y-2">
        <p>
          This panel will let you compose indicator stacks for{" "}
          <span className="font-semibold">{name}</span> – things like sOBV,
          KAMA, Dark Flow, regime flags, and custom scores.
        </p>
        <p className="text-slate-400">
          Later we&apos;ll add:
        </p>
        <ul className="list-disc list-inside text-slate-400 space-y-1">
          <li>Pick indicators from a library</li>
          <li>Adjust parameters (lookbacks, thresholds, weights)</li>
          <li>Save indicator presets per idea</li>
          <li>Preview signals on recent price history</li>
        </ul>
        <p className="text-[11px] text-slate-500">
          For now this is just a structural stub so we can wire it into layout
          and Settings.
        </p>
      </div>
    </section>
  );
};

export default IndicatorBuilderPanel;