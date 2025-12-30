import React from 'react';
import { useTheme } from '../config/ThemeContext';
import { useUiScopedTokens } from '../config/useUiScopedTokens';

export type LabTab = 'scan' | 'backtests' | 'candidates';

interface LabBottomPanelProps {
  open: boolean; // like builderOpen
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
  const name = ideaName ?? 'no idea selected';
  const { theme } = useTheme(); // currently unused, but keeps hook aligned with engine
  const tokens = useUiScopedTokens(['global', 'page:lab', 'region:lab:analysis']);

  return (
    <section
      className="w-full max-w-5xl mx-auto rounded-md border border-[var(--tp-lab-analysis-border)] bg-[var(--tp-lab-analysis-bg)] flex flex-col"
      style={{
        background: tokens.surfaceMuted,
        borderColor: tokens.border,
        color: tokens.textPrimary,
      }}
    >
      {/* Header: collapsible, like Idea Builder */}
      <div
        className="px-3 py-2 border-b border-[var(--tp-lab-analysis-header-border)] bg-[var(--tp-lab-analysis-header-bg)] flex items-center justify-between cursor-pointer rounded-t-md"
        onClick={onToggle}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
          Analysis Panel
        </span>
        <span className="text-slate-400 text-sm">{open ? '▾' : '▸'}</span>
      </div>

      {/* Body only shows when open */}
      {open && (
        <>
          {/* Tabs row */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/70">
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => onChangeTab('scan')}
                className={`px-3 py-1 rounded-md border ${
                  activeTab === 'scan'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Scan
              </button>
              <button
                onClick={() => onChangeTab('backtests')}
                className={`px-3 py-1 rounded-md border ${
                  activeTab === 'backtests'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Backtests
              </button>
              <button
                onClick={() => onChangeTab('candidates')}
                className={`px-3 py-1 rounded-md border ${
                  activeTab === 'candidates'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Candidates
              </button>
            </div>
            <span className="text-[10px] text-slate-400">
              Idea: <span className="font-semibold text-slate-200">{name}</span>
            </span>
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-[10rem] px-4 py-2 text-xs overflow-y-auto rounded-b-md">
            {activeTab === 'scan' && (
              <div>
                <p className="text-slate-300 mb-2">
                  Scan panel for <span className="font-semibold">{name}</span>.
                </p>
                <p className="text-slate-400">
                  This will show the latest candidate list for this idea and a button to run a scan.
                  For now, it&apos;s just a placeholder.
                </p>
              </div>
            )}
            {activeTab === 'backtests' && (
              <div>
                <p className="text-slate-300 mb-2">
                  Backtests panel for <span className="font-semibold">{name}</span>.
                </p>
                <p className="text-slate-400">
                  This will show backtest runs, key metrics, and allow launching new backtests for
                  this idea.
                </p>
              </div>
            )}
            {activeTab === 'candidates' && (
              <div>
                <p className="text-slate-300 mb-2">
                  Candidates panel for <span className="font-semibold">{name}</span>.
                </p>
                <p className="text-slate-400">
                  This will pull candidate rows for this idea from the global candidates pool and
                  let you manage or promote them to the test stand.
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
