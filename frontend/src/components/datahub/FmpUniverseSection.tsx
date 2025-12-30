// frontend/src/components/datahub/FmpUniverseSection.tsx

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api';
import CollapsibleSection from './CollapsibleSection';
import UniverseBrowserSection from './UniverseBrowserSection';

interface FmpUniverseSummary {
  total_symbols: number;
  exchanges: string[];
  last_ingested_at: string | null;
  min_market_cap: number | null;
  max_market_cap: number | null;
}

interface FmpUniverseIngestResponse {
  symbols_ingested: number;
  symbols_updated: number;
  symbols_skipped: number;
  total_symbols_after: number;
  started_at: string;
  finished_at: string;
}

const SUMMARY_PATH = '/datalake/fmp/universe/summary';
const INGEST_PATH = '/datalake/fmp/universe/ingest';

const FmpUniverseSection: React.FC = () => {
  const [summary, setSummary] = useState<FmpUniverseSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<FmpUniverseIngestResponse | null>(null);

  // ---- Universe filter controls ----
  const [minCap, setMinCap] = useState('50000000');
  const [maxCap, setMaxCap] = useState('');
  const [exchanges, setExchanges] = useState('NYSE,NASDAQ');
  const [maxSymbols, setMaxSymbols] = useState('1000');

  // ---- Visible toggles (explicit) ----
  const [includeEtfs, setIncludeEtfs] = useState(false);
  const [includeFunds, setIncludeFunds] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  // IMPORTANT: includeAllShareClasses (controls warrants / share classes)
  // We send literal "true"/"false" to match FMP playground behavior.
  const [includeAllShareClasses, setIncludeAllShareClasses] = useState(false);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await apiClient.get<FmpUniverseSummary>(SUMMARY_PATH);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load FMP universe summary', err);
      setSummaryError(
        'Could not load FMP universe summary. Check backend route /datalake/fmp/universe/summary.',
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestError(null);
    setIngestResult(null);

    const minCapNum = parseInt(minCap || '0', 10);
    const maxCapNum = maxCap.trim().length > 0 ? parseInt(maxCap, 10) : null;
    const maxSymbolsNum = parseInt(maxSymbols || '0', 10) || 0;

    const payload = {
      min_market_cap: minCapNum,
      max_market_cap: maxCapNum,
      exchanges: exchanges
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),

      // visible toggles (even if backend doesn’t filter on them during ingest yet)
      include_etfs: includeEtfs,
      include_funds: includeFunds,
      active_only: activeOnly,

      // IMPORTANT: send literal "true"/"false"
      include_all_share_classes: includeAllShareClasses ? 'true' : 'false',

      max_symbols: maxSymbolsNum,
    };

    try {
      const data = await apiClient.post<FmpUniverseIngestResponse>(INGEST_PATH, payload);
      setIngestResult(data);
      void loadSummary();
    } catch (err) {
      console.error('Failed to ingest FMP universe', err);
      setIngestError(
        'Failed to ingest FMP universe. Confirm backend route /datalake/fmp/universe/ingest and FMP API key.',
      );
    } finally {
      setIngesting(false);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_fmp_universe_open"
      title="Symbol Universe Ingest"
      defaultOpen
    >
      {/* Inputs */}
      <div className="mb-2 grid gap-3 text-xs md:grid-cols-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-emerald-200/60">Min market cap (USD)</span>
          <input
            value={minCap}
            onChange={(e) => setMinCap(e.target.value.replace(/,/g, ''))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-emerald-200/60">Max market cap (optional)</span>
          <input
            value={maxCap}
            onChange={(e) => setMaxCap(e.target.value.replace(/,/g, ''))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-emerald-200/60">Exchanges (comma-separated)</span>
          <input
            value={exchanges}
            onChange={(e) => setExchanges(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="NYSE,NASDAQ"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-emerald-200/60">Max symbols (safety limit)</span>
          <input
            value={maxSymbols}
            onChange={(e) => setMaxSymbols(e.target.value.replace(/[^0-9]/g, ''))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>
      </div>

      {/* Checkboxes inline UNDER the inputs */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 bg-slate-900/40 px-3 py-2 text-xs">
        <label className="inline-flex items-center gap-2 text-slate-200">
          <input
            type="checkbox"
            checked={includeEtfs}
            onChange={(e) => setIncludeEtfs(e.target.checked)}
            className="h-3 w-3"
          />
          Include ETFs
        </label>

        <label className="inline-flex items-center gap-2 text-slate-200">
          <input
            type="checkbox"
            checked={includeFunds}
            onChange={(e) => setIncludeFunds(e.target.checked)}
            className="h-3 w-3"
          />
          Include Funds
        </label>

        <label className="inline-flex items-center gap-2 text-slate-200">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-3 w-3"
          />
          Active only
        </label>

        <div className="h-4 w-px bg-slate-800" />

        <label className="inline-flex items-center gap-2 text-slate-200">
          <input
            type="checkbox"
            checked={includeAllShareClasses}
            onChange={(e) => setIncludeAllShareClasses(e.target.checked)}
            className="h-3 w-3"
          />
          Include all share classes
        </label>
      </div>

      {/* Ingest */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={handleIngest}
          disabled={ingesting}
          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white  disabled:opacity-60"
        >
          {ingesting ? 'Ingesting from FMP…' : 'Ingest Universe'}
        </button>
        <button
          type="button"
          onClick={loadSummary}
          disabled={summaryLoading}
          className="rounded-md bg-sky-700 px-3 py-1 text-[11px] font-semibold text-white  disabled:opacity-60"
        >
          {summaryLoading ? 'Refreshing…' : 'Refresh Universe'}
        </button>
        {ingesting && (
          <span className="text-[11px] text-slate-300">
            This may take a bit depending on FMP response time and universe size.
          </span>
        )}
      </div>

      {ingestError && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {ingestError}
        </div>
      )}

      {ingestResult && (
        <div className="mt-3 grid gap-2 text-xs text-slate-100 sm:grid-cols-4">
          <div>
            <div className="text-slate-400">Symbols ingested</div>
            <div className="font-semibold">{ingestResult.symbols_ingested.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">Symbols updated</div>
            <div className="font-semibold">{ingestResult.symbols_updated.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">Symbols skipped</div>
            <div className="font-semibold">{ingestResult.symbols_skipped.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">Total after ingest</div>
            <div className="font-semibold">{ingestResult.total_symbols_after.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">Started at</div>
            <div className="font-mono text-[11px]}">{ingestResult.started_at}</div>
          </div>
          <div>
            <div className="text-slate-400">Finished at</div>
            <div className="font-mono text-[11px]}">{ingestResult.finished_at}</div>
          </div>
        </div>
      )}
      {/* Summary */}
      <div className="bg-slate-900/40 px-4 py-2 text-xs">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold text-slate-50">Current universe</span>
        </div>

        {summaryLoading && <Spinner label="Loading universe summary…" />}

        {summaryError && (
          <div className="mt-1 rounded-md border border-red-500/60 bg-red-900/40 px-2 py-1 text-[11px] text-red-100">
            {summaryError}
          </div>
        )}

        {!summaryLoading && !summaryError && summary && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-[11px] text-slate-400">Total symbols</div>
              <div className="text-sm font-semibold text-emerald-400">
                {summary.total_symbols.toLocaleString()}
              </div>
            </div>
            <div className="text-[11px] text-slate-100">
              <div className="text-[11px] text-slate-400">Market cap range</div>
              {summary.min_market_cap != null && summary.max_market_cap != null
                ? `$${summary.min_market_cap.toLocaleString()} → $${summary.max_market_cap.toLocaleString()}`
                : 'n/a'}
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Last ingested at</div>
              <div className="text-[11px] text-slate-100">
                {summary.last_ingested_at ?? 'never'}
              </div>
            </div>
            {/* <div>
                  <div className="text-[9px] text-slate-400">Exchanges</div>
                  <div className="text-[9px] text-slate-100">
                    {summary.exchanges.length > 0
                      ? summary.exchanges.join(", ")
                      : "—"}
                  </div>
                </div> */}
          </div>
        )}

        {!summaryLoading && !summaryError && !summary && (
          <p className="text-[11px] text-slate-400">
            No universe summary yet. Run an ingest to populate{' '}
            <span className="font-mono">symbol_universe</span>.
          </p>
        )}
      </div>
      <UniverseBrowserSection></UniverseBrowserSection>
    </CollapsibleSection>
  );
};

export default FmpUniverseSection;
