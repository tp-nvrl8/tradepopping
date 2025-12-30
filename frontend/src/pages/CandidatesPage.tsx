import React, { useState } from 'react';
import { LabIdea } from '../lab/types';
import { useUiScopedTokens } from '../config/useUiScopedTokens';

type Candidate = {
  symbol: string;
  name: string;
  ideaId: string;
  score: number; // 0–100
  regime: string;
  notes?: string;
};

const mockIdeas: Pick<LabIdea, 'meta'>[] = [
  { meta: { id: 'idea-1', name: 'Vanishing Float Squeeze v1', status: 'active' } },
  { meta: { id: 'idea-2', name: 'Mean Reversion in Quiet Regimes', status: 'draft' } },
  { meta: { id: 'idea-3', name: 'Dark Flow Momentum Tracker', status: 'retired' } },
];

const mockCandidates: Candidate[] = [
  {
    symbol: 'ARRY',
    name: 'Array Technologies',
    ideaId: 'idea-1',
    score: 87,
    regime: 'expanding',
    notes: 'High sOBV + shrinking float pattern.',
  },
  {
    symbol: 'PLUG',
    name: 'Plug Power',
    ideaId: 'idea-1',
    score: 73,
    regime: 'expanding',
  },
  {
    symbol: 'TTD',
    name: 'Trade Desk',
    ideaId: 'idea-2',
    score: 62,
    regime: 'quiet',
  },
];

const CandidatesPage: React.FC = () => {
  const tokens = useUiScopedTokens(['global', 'page:candidates']);
  const [selectedIdeaFilter, setSelectedIdeaFilter] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const filtered = mockCandidates.filter((c) =>
    selectedIdeaFilter === 'all' ? true : c.ideaId === selectedIdeaFilter,
  );

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"
      style={{
        background: tokens.surface,
        color: tokens.textPrimary,
      }}
    >
      <header
        className="border-b border-slate-800 px-4 py-3 flex items-center justify-between"
        style={{ borderColor: tokens.border }}
      >
        <h1 className="text-sm font-semibold">Candidates</h1>
      </header>
      <main className="flex flex-1 p-4 gap-4">
        {/* LEFT — table */}
        <div className="flex-1 flex flex-col">
          <div
            className="rounded-lg border px-0 py-0 h-full flex flex-col"
            style={{
              background: tokens.surfaceMuted,
              borderColor: tokens.border,
              color: tokens.textPrimary,
            }}
          >
            {/* Filters */}
            <div className="border-b border-slate-800 p-3 bg-slate-950/90">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <label className="text-slate-400">Idea</label>
                  <select
                    value={selectedIdeaFilter}
                    onChange={(e) => setSelectedIdeaFilter(e.target.value)}
                    className="ml-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                  >
                    <option value="all">All Ideas</option>
                    {mockIdeas.map((i) => (
                      <option key={i.meta.id} value={i.meta.id}>
                        {i.meta.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-slate-400 text-[10px]">{filtered.length} candidates</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Idea</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    <th className="px-3 py-2 text-left">Regime</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isSelected = selectedCandidate?.symbol === c.symbol;
                    const ideaName =
                      mockIdeas.find((i) => i.meta.id === c.ideaId)?.meta.name || 'Unknown';

                    return (
                      <tr
                        key={c.symbol}
                        onClick={() => setSelectedCandidate(c)}
                        className={`cursor-pointer hover:bg-slate-900 ${
                          isSelected ? 'bg-slate-800/60' : ''
                        }`}
                      >
                        <td className="px-3 py-2">{c.symbol}</td>
                        <td className="px-3 py-2 text-slate-300">{c.name}</td>
                        <td className="px-3 py-2 text-slate-400">{ideaName}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-1 rounded-md border ${
                              c.score > 80
                                ? 'border-emerald-500 text-emerald-300'
                                : 'border-slate-600 text-slate-400'
                            }`}
                          >
                            {c.score}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300">{c.regime.toUpperCase()}</td>
                        <td className="px-3 py-2 text-slate-500">{c.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT — details panel */}
        <div className="w-80">
          <div
            className="rounded-lg border px-4 py-3 text-xs h-full"
            style={{
              background: tokens.surfaceMuted,
              borderColor: tokens.border,
              color: tokens.textPrimary,
            }}
          >
            {selectedCandidate ? (
              <>
                <h3 className="text-slate-100 font-semibold text-sm mb-2">
                  {selectedCandidate.symbol} — {selectedCandidate.name}
                </h3>

                <div className="mb-3">
                  <p className="text-slate-400 mb-1">Idea Source:</p>
                  <div className="text-slate-300">
                    {mockIdeas.find((i) => i.meta.id === selectedCandidate.ideaId)?.meta.name}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-slate-400 mb-1">Score:</p>
                  <span className="px-2 py-1 rounded-md border border-sky-500 bg-sky-500/10 text-sky-200">
                    {selectedCandidate.score}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-slate-400 mb-1">Regime:</p>
                  <div className="text-slate-300">{selectedCandidate.regime.toUpperCase()}</div>
                </div>

                <div className="mt-4">
                  <h4 className="text-slate-200 font-semibold text-xs mb-1">
                    Why this was selected
                  </h4>
                  <p className="text-slate-400">
                    Later this will list the indicator values that triggered this candidate, float &
                    short signals, volatility state, and more.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-slate-500">Select a row to see candidate details.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CandidatesPage;
