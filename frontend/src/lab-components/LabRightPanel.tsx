import React from "react";

interface LabRightPanelProps {
  open: boolean;
}

const LabRightPanel: React.FC<LabRightPanelProps> = ({ open }) => {
  if (!open) return null;

  return (
    <aside className="w-72 border-l border-slate-800 bg-slate-950/80 flex flex-col">
      <div className="px-3 py-2 border-b border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Notes &amp; Meta
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 text-xs space-y-3">
        <section className="border border-slate-800 rounded-lg p-2 bg-slate-900/40">
          <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
            Idea Notes
          </h3>
          <p className="text-slate-400">
            This will store your written notes about the selected idea: why it
            exists, what it&apos;s good at, and what you&apos;ve learned.
          </p>
        </section>
        <section className="border border-slate-800 rounded-lg p-2 bg-slate-900/40">
          <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
            Future AI Copilot
          </h3>
          <p className="text-slate-400">
            Later, this panel can summarize idea performance, suggest parameter
            tweaks, and highlight patterns in backtests and candidates.
          </p>
        </section>
        <section className="border border-slate-800 rounded-lg p-2 bg-slate-900/40">
          <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
            Status &amp; Tags
          </h3>
          <p className="text-slate-400">
            This section will show or edit status (draft / active / retired),
            strategy family, and tags like &quot;VCP&quot; or &quot;Vanishing
            Float&quot; for the selected idea.
          </p>
        </section>
      </div>
    </aside>
  );
};

export default LabRightPanel;