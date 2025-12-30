import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../api';
import CollapsibleSection from './CollapsibleSection';

type SortBy = 'symbol' | 'market_cap' | 'exchange';
type SortDir = 'asc' | 'desc';

interface UniverseSymbolDTO {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
  sector?: string | null;
  market_cap?: number | null;
  is_etf?: boolean | null;
  is_fund?: boolean | null;
  is_actively_trading?: boolean | null;
}

interface UniverseBrowseResponse {
  total_count: number;
  page: number;
  page_size: number;
  symbols: UniverseSymbolDTO[];
}

const UniverseBrowserSection: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<SortBy>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Search
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [data, setData] = useState<UniverseBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCount = data?.total_count ?? 0;
  const symbols = data?.symbols ?? [];
  const totalPages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  const startIdx = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  // Debounce query input (keeps UI snappy, avoids spamming backend)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  // Prevent out-of-order responses from overwriting newer state
  const reqSeq = useRef(0);

  const loadPage = async (
    pageArg: number = page,
    sortByArg: SortBy = sortBy,
    sortDirArg: SortDir = sortDir,
    qArg: string = debouncedQuery,
  ) => {
    const mySeq = ++reqSeq.current;

    setLoading(true);
    setError(null);

    try {
      const resp = await apiClient.get<UniverseBrowseResponse>('/datalake/universe/browse', {
        params: {
          page: pageArg,
          page_size: pageSize,
          sort_by: sortByArg,
          sort_dir: sortDirArg,
          // only send q if it has content (keeps URLs cleaner)
          ...(qArg ? { q: qArg } : {}),
        },
      });

      // Ignore stale responses
      if (mySeq !== reqSeq.current) return;

      setData(resp);
      setPage(pageArg);
      setSortBy(sortByArg);
      setSortDir(sortDirArg);
    } catch (err) {
      console.error('Failed to browse universe', err);
      setError('Failed to load symbol_universe. Check backend route /datalake/universe/browse.');
      setData(null);
    } finally {
      // only clear loading if this was the latest request
      if (mySeq === reqSeq.current) setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    void loadPage(1, 'symbol', 'asc', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when debounced query changes (reset to page 1)
  useEffect(() => {
    void loadPage(1, sortBy, sortDir, debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const handleSort = (field: SortBy) => {
    const nextDir: SortDir = sortBy === field && sortDir === 'asc' ? 'desc' : 'asc';
    void loadPage(1, field, nextDir, debouncedQuery);
  };

  const canGoFirst = !loading && page > 1;
  const canGoPrev = !loading && page > 1;
  const canGoNext = !loading && page < totalPages;
  const canGoLast = !loading && page < totalPages;

  const navBtnClass =
    'rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-50';

  return (
    <CollapsibleSection
      storageKey="tp_datahub_universe_browser_open"
      title="Symbol Universe Browser"
      defaultOpen
    >
      {/* Search + counts + nav */}
      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-300">Search (symbol or name)</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. AAPL or Tesla"
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 md:w-72"
          />
          <div className="text-[11px] text-slate-400">
            {totalCount > 0 ? (
              <>
                Showing{' '}
                <span className="font-semibold text-slate-200">{startIdx.toLocaleString()}</span>–
                <span className="font-semibold text-slate-200">{endIdx.toLocaleString()}</span> of{' '}
                <span className="font-semibold text-slate-200">{totalCount.toLocaleString()}</span>
                {debouncedQuery ? (
                  <>
                    {' '}
                    (filtered by <span className="font-mono text-slate-200">{debouncedQuery}</span>)
                  </>
                ) : null}
              </>
            ) : debouncedQuery ? (
              <>
                No matches for <span className="font-mono text-slate-200">{debouncedQuery}</span>.
              </>
            ) : (
              'No symbols loaded yet. Try ingesting the FMP universe first.'
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => loadPage(1, sortBy, sortDir, debouncedQuery)}
            disabled={!canGoFirst}
            className={navBtnClass}
            title="First page"
          >
            ◀◀
          </button>
          <button
            type="button"
            onClick={() => loadPage(page - 1, sortBy, sortDir, debouncedQuery)}
            disabled={!canGoPrev}
            className={navBtnClass}
            title="Previous page"
          >
            ◀
          </button>
          <div className="text-[11px] text-slate-300">
            Page <span className="font-semibold text-slate-100">{page}</span> /{' '}
            <span className="font-semibold text-slate-100">{totalPages}</span>
          </div>
          <button
            type="button"
            onClick={() => loadPage(page + 1, sortBy, sortDir, debouncedQuery)}
            disabled={!canGoNext}
            className={navBtnClass}
            title="Next page"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => loadPage(totalPages, sortBy, sortDir, debouncedQuery)}
            disabled={!canGoLast}
            className={navBtnClass}
            title="Last page"
          >
            ▶▶
          </button>

          <button
            type="button"
            onClick={() => loadPage(page, sortBy, sortDir, debouncedQuery)}
            disabled={loading}
            className="ml-2 rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <Spinner label="Loading symbol universe…" />}

      {error && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {!loading && !error && symbols.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          No symbols to display. If you expect data, check that the FMP universe ingest has run and
          that the symbol_universe table exists.
        </p>
      )}

      {!loading && !error && symbols.length > 0 && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-slate-800">
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="bg-slate-900 text-left text-slate-200">
              <tr>
                <th className="cursor-pointer px-2 py-1" onClick={() => handleSort('symbol')}>
                  Symbol
                  {sortBy === 'symbol' && (
                    <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
                <th className="px-2 py-1">Name</th>
                <th className="cursor-pointer px-2 py-1" onClick={() => handleSort('exchange')}>
                  Exchange
                  {sortBy === 'exchange' && (
                    <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
                <th
                  className="cursor-pointer px-2 py-1 text-right"
                  onClick={() => handleSort('market_cap')}
                >
                  Market cap
                  {sortBy === 'market_cap' && (
                    <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
                <th className="px-2 py-1 text-center">ETF?</th>
                <th className="px-2 py-1 text-center">Fund?</th>
                <th className="px-2 py-1 text-center">Active?</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((row) => (
                <tr key={row.symbol} className="border-t border-slate-800 odd:bg-slate-950/40">
                  <td className="px-2 py-1 font-mono text-[9px] text-slate-50">{row.symbol}</td>
                  <td className="px-2 py-1 text-slate-200">{row.name ?? ''}</td>
                  <td className="px-2 py-1 text-slate-200">{row.exchange ?? ''}</td>
                  <td className="px-2 py-1 text-right text-slate-200">
                    {row.market_cap != null ? `$${row.market_cap.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-2 py-1 text-center text-slate-200">
                    {row.is_etf == null ? '?' : row.is_etf ? 'Yes' : 'No'}
                  </td>
                  <td className="px-2 py-1 text-center text-slate-200">
                    {row.is_fund == null ? '?' : row.is_fund ? 'Yes' : 'No'}
                  </td>
                  <td className="px-2 py-1 text-center text-slate-200">
                    {row.is_actively_trading == null ? '?' : row.is_actively_trading ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
  );
};

export default UniverseBrowserSection;
