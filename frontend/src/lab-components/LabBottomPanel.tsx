import React from "react";

export type LabTab = "scan" | "backtests" | "candidates";

interface LabBottomPanelProps {
  open: boolean;
  onToggle: () => void;
  activeTab: LabTab;
  onChangeTab: (tab: LabTab) => void;
  ideaName?: string;
}

const LabBottomPanel: React.FC<LabBottomPanelProps> = ({
  open,
  onToggle,
  activeTab,
  onChangeTab,
  ideaName,
}) => {
  const name = ideaName ?? "no idea selected";

  return (
    <section className="w-full border border-slate-800 bg-slate-950/90 rounded-md flex flex-col">
      {/* Header: collapsible */}
      <div
        className="px-3 py-2 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between cursor-pointer rounded-t-md"
        onClick={onToggle}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Analysis Panel
        </span>
        <span className="text-slate-400 text-sm">{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <>
          {/* Tabs row */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => onChangeTab("scan")}
                className={`px-3 py-1 rounded-md border ${
                  activeTab === "scan"
                    ? "border-sky-500 bg-sky-500/10 text-sky-100"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Scan
              </button>
              <button
                onClick={() => onChangeTab("backtests")}
                className={`px-3 py-1 rounded-md border ${
                  activeTab === "backtests"
                    ? "border-sky-500 bg-sky-500/10 text-sky-100"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Backtests
              </button>
              <button
                onClick={() => onChangeTab("candidates")}
                className={`px-3 py-1 rounded-md border ${
                  activeTab === "candidates"
                    ? "border-sky-500 bg-sky-500/10 text-sky-100"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Candidates
              </button>
            </div>
            <span className="text-[10px] text-slate-500">Idea: {name}</span>
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-[10rem] px-4 py-2 text-xs overflow-y-auto rounded-b-md">
            {activeTab === "scan" && (
              <div>
                <p className="text-slate-300 mb-2">
                  Scan panel for <span className="font-semibold">{name}</span>.
                </p>
                <p className="text-slate-400">
                  This will show the latest candidate list for this idea and a
                  button to run a scan. For now, it&apos;s just a placeholder.
                </p>
              </div>
            )}
            {activeTab === "backtests" && (
              <div>
                <p className="text-slate-300 mb-2">
                  Backtests panel for{" "}
                  <span className="font-semibold">{name}</span>.
                </p>
                <p className="text-slate-400">
                  This will show backtest runs, key metrics, and allow launching
                  new backtests for this idea.
                </p>
              </div>
            )}
            {activeTab === "candidates" && (
              <div>
                <p className="text-slate-300 mb-2">
                  Candidates panel for{" "}
                  <span className="font-semibold">{name}</span>.
                </p>
                <p className="text-slate-400">
                  This will pull candidate rows for this idea from the global
                  candidates pool and let you manage or promote them to the test
                  stand.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default LabBottomPanel;