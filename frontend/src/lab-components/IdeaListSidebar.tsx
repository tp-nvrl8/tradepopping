import React from 'react';
import { LabIdea } from '../lab/types';

interface IdeaListSidebarProps {
  ideas: LabIdea[];
  selectedIdeaId: string | null;
  onSelectIdea: (id: string | null) => void;
  onNewIdea: () => void;
}

const statusBadgeClasses: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  draft: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  retired: 'bg-slate-500/10 text-slate-300 border-slate-500/40',
};

const IdeaListSidebar: React.FC<IdeaListSidebarProps> = ({
  ideas,
  selectedIdeaId,
  onSelectIdea,
  onNewIdea,
}) => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/80 flex flex-col">
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ideas</span>
        <button className="text-xs text-sky-300 hover:text-sky-200" onClick={onNewIdea}>
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {ideas.length === 0 ? (
          <div className="px-3 py-4 text-xs text-slate-500">No ideas loaded yet.</div>
        ) : (
          ideas.map((idea) => {
            const isActive = idea.meta.id === selectedIdeaId;
            const status = idea.meta.status ?? 'draft';

            return (
              <button
                key={idea.meta.id}
                onClick={() => onSelectIdea(idea.meta.id ?? null)}
                className={`w-full text-left px-3 py-2 border-b border-slate-900/60 text-xs hover:bg-slate-900/80 transition ${
                  isActive ? 'bg-slate-900/90' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`truncate ${isActive ? 'text-sky-100' : 'text-slate-100'}`}>
                    {idea.meta.name}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${
                      statusBadgeClasses[status]
                    }`}
                  >
                    {status.toUpperCase()}
                  </span>
                  {idea.meta.family && (
                    <span className="text-[10px] text-slate-400 ml-2 truncate">
                      {idea.meta.family}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default IdeaListSidebar;
