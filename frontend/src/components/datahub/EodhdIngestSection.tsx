// frontend/src/components/datahub/EodhdIngestSection.tsx

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api';
import CollapsibleSection from './CollapsibleSection';
import DataLakeBarsSection from './DataLakeBarsSection';
import { EodhdIngestResponse, EodhdJobStatus, EodhdJobProgress } from './types';

type IngestMode = 'window' | 'full';

const EodhdIngestSection: React.FC = () => {
  // -------------------------
  // Window (test) inputs
  // -------------------------
  const [start, setStart] = useState('2024-01-02');
  const [end, setEnd] = useState('2024-01-31');

  // -------------------------
  // Resumable full-history inputs
  // -------------------------
  const [fullHistoryStart, setFullHistoryStart] = useState('2015-01-01');
  const [fullHistoryEnd, setFullHistoryEnd] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  ); // default: ~1 week ahead (just a placeholder "future-ish")
  const [windowDays, setWindowDays] = useState('365');

  // -------------------------
  // Shared universe filters
  // -------------------------
  const [minCap, setMinCap] = useState('300000');
  const [maxCap, setMaxCap] = useState('');
  const [exchanges, setExchanges] = useState('NYSE,NASDAQ');
  const [includeEtfs, setIncludeEtfs] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [maxSymbols, setMaxSymbols] = useState('2');

  // -------------------------
  // UI state
  // -------------------------
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EodhdIngestResponse | null>(null);

  const [jobStatus, setJobStatus] = useState<EodhdJobStatus | null>(null);
  const [jobRefreshing, setJobRefreshing] = useState(false);

  // Gas gauge progress
  const [progress, setProgress] = useState<EodhdJobProgress | null>(null);
  const [progressPolling, setProgressPolling] = useState(false);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  const refreshJobStatus = async () => {
    setJobRefreshing(true);
    try {
      const data = await apiClient.get<EodhdJobStatus>('/datalake/eodhd/jobs/latest');
      setJobStatus(data);
    } catch (err) {
      console.error('Failed to refresh EODHD job status', err);
    } finally {
      setJobRefreshing(false);
    }
  };

  const refreshProgress = async (jobId: string) => {
    try {
      const data = await apiClient.get<EodhdJobProgress>(`/datalake/eodhd/jobs/${jobId}/progress`);
      setProgress(data);
    } catch (err) {
      console.error('Failed to refresh EODHD progress', err);
    }
  };

  // Poll progress only when a job is running
  useEffect(() => {
    const jobId = jobStatus?.id;
    const isRunning = jobStatus?.state === 'running';

    if (!jobId || !isRunning) {
      setProgressPolling(false);
      return;
    }

    setProgressPolling(true);
    void refreshProgress(jobId);

    const t = window.setInterval(() => {
      void refreshProgress(jobId);
    }, 2000);

    return () => {
      window.clearInterval(t);
      setProgressPolling(false);
    };
  }, [jobStatus?.id, jobStatus?.state]);

  const buildUniverseFilters = () => {
    const minCapNum = parseInt(minCap || '0', 10);
    const maxCapNum = maxCap.trim().length > 0 ? parseInt(maxCap, 10) : null;
    const maxSymbolsNum = parseInt(maxSymbols || '0', 10) || 0;

    return {
      min_market_cap: minCapNum,
      max_market_cap: maxCapNum,
      exchanges: exchanges
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      include_etfs: includeEtfs,
      active_only: activeOnly,
      max_symbols: maxSymbolsNum,
    };
  };

  const handleIngestWindow = async () => {
    setLoadingWindow(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        ...buildUniverseFilters(),
        start,
        end,
      };

      const data = await apiClient.post<EodhdIngestResponse>(
        '/datalake/eodhd/ingest-window',
        payload,
      );

      setResult(data);

      // If backend returns "running" one day, don't force finished_at
      setJobStatus({
        id: data.job_id,
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        finished_at: data.job_state === 'running' ? null : new Date().toISOString(),
        state: data.job_state,
        requested_start: data.requested_start,
        requested_end: data.requested_end,
        universe_symbols_considered: data.universe_symbols_considered,
        symbols_attempted: data.symbols_attempted,
        symbols_succeeded: data.symbols_succeeded,
        symbols_failed: data.symbols_failed,
        last_error: data.symbols_failed > 0 ? 'Some symbols failed during ingest.' : null,
      });

      void refreshJobStatus();
    } catch (err) {
      console.error('Failed to ingest EODHD window', err);
      setError('Failed to ingest EODHD daily bars for that window. Check backend logs.');
    } finally {
      setLoadingWindow(false);
    }
  };

  const handleStartResumableFullHistory = async () => {
    setLoadingFull(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        ...buildUniverseFilters(),
        start: fullHistoryStart,
        end: fullHistoryEnd,
        window_days: parseInt(windowDays || '365', 10) || 365,
      };

      // NOTE: This endpoint must exist in backend:
      // POST /datalake/eodhd/full-history/start-resumable
      const data = await apiClient.post<{ job_id: string }>(
        '/datalake/eodhd/full-history/start-resumable',
        payload,
      );

      // Pull latest status so UI shows running job right away
      void refreshJobStatus();

      // Also kick progress fetch (job status might lag 1 tick)
      if (data?.job_id) void refreshProgress(data.job_id);
    } catch (err) {
      console.error('Failed to start resumable full history', err);
      setError('Failed to start resumable full-history ingest. Confirm backend route + payload.');
    } finally {
      setLoadingFull(false);
    }
  };

  const handleResume = async () => {
    const jobId = jobStatus?.id;
    if (!jobId) return;

    try {
      await apiClient.post(`/datalake/eodhd/jobs/${jobId}/resume`, {});
      void refreshJobStatus();
      void refreshProgress(jobId);
    } catch (err) {
      console.error('Failed to resume EODHD job', err);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_eodhd_ingest_open"
      title="EODHD Daily Bar Ingest"
      defaultOpen
    >
      {/* =========================
          SHARED FILTERS (CLEAR + ALIGNED CHECKBOXES)
         ========================= */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-orange-400/90">Shared Ingest Filters</div>
      </div>

      <div className="grid gap-3 text-xs md:grid-cols-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-orange-100">Min market cap (USD)</span>
          <input
            value={minCap}
            onChange={(e) => setMinCap(e.target.value.replace(/,/g, ''))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-orange-100">Max market cap (optional)</span>
          <input
            value={maxCap}
            onChange={(e) => setMaxCap(e.target.value.replace(/,/g, ''))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-orange-100">Exchanges (comma-separated)</span>
          <input
            value={exchanges}
            onChange={(e) => setExchanges(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="NYSE,NASDAQ"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-orange-100">Max symbols (sample limit)</span>
          <input
            value={maxSymbols}
            onChange={(e) => setMaxSymbols(e.target.value.replace(/[^0-9]/g, ''))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>
      </div>

      {/* checkboxes aligned in one row */}
      <div className="mt-3 flex flex-wrap items-center gap-6 text-xs pb-2">
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
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-3 w-3"
          />
          Active only
        </label>
      </div>

      {/* Divider */}
      <CollapsibleSection
        storageKey="tp_datahub_eodhd_full_ingest_open"
        title="Full History Daily Bar Ingest"
        defaultOpen
      >
        {/* =========================
          RESUMABLE FULL-HISTORY BLOCK
         ========================= */}
        <div className="rounded-md border border-slate-800 bg-slate-950/40 border-l-orange-400/80 p-3">
          <div className="grid gap-3 text-xs md:grid-cols-3 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-sky-200">Start Date</span>
              <input
                value={fullHistoryStart}
                onChange={(e) => setFullHistoryStart(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sky-200">End Date</span>
              <input
                value={fullHistoryEnd}
                onChange={(e) => setFullHistoryEnd(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sky-200">Window days (chunk size)</span>
              <input
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value.replace(/[^0-9]/g, ''))}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>
          </div>

          {/* Resume/Refresh row */}
          <div className="mt-3 grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={handleStartResumableFullHistory}
              disabled={loadingWindow || loadingFull}
              className="w-full rounded-md bg-sky-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              title="Start resumable ingest using full start/end + window days."
            >
              {loadingFull ? 'Starting resumable…' : 'Full History Ingest'}
            </button>
            <button
              type="button"
              onClick={handleResume}
              disabled={!jobStatus}
              className="rounded-md border border-slate-600 px-3 py-2 text-[11px] hover:bg-slate-800 disabled:opacity-60"
              title="Resume the latest job (process pending + retry eligible failed items)."
            >
              Resume job
            </button>

            <button
              type="button"
              onClick={refreshJobStatus}
              disabled={jobRefreshing}
              className="ml-auto rounded-md border border-slate-600 px-3 py-2 text-[11px] hover:bg-slate-800 disabled:opacity-60"
            >
              {jobRefreshing ? 'Refreshing…' : 'Refresh job status'}
            </button>
          </div>
        </div>

        {/* Errors */}
        {error && (
          <div className="mt-3 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {/* Result summary */}
        {result && (
          <div className="mt-3 grid gap-2 text-xs text-slate-100 sm:grid-cols-3">
            <div>
              <div className="text-slate-400">Requested window</div>
              <div className="font-semibold">
                {result.requested_start} → {result.requested_end}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Symbols attempted</div>
              <div className="font-semibold">{result.symbols_attempted.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-slate-400">Rows observed in lake</div>
              <div className="font-semibold">
                {result.rows_observed_after_ingest.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Latest job status */}
        {jobStatus && (
          <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-100">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">Latest ingest job</span>
              <span
                className={
                  jobStatus.state === 'succeeded'
                    ? 'text-emerald-300'
                    : jobStatus.state === 'running'
                      ? 'text-yellow-300'
                      : 'text-red-300'
                }
              >
                {jobStatus.state.toUpperCase()}
              </span>
            </div>

            <div className="grid gap-1 sm:grid-cols-2">
              <div>
                <span className="text-slate-400">Window: </span>
                <span className="font-semibold">
                  {jobStatus.requested_start} → {jobStatus.requested_end}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Attempted: </span>
                <span className="font-semibold">
                  {jobStatus.symbols_attempted.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Succeeded: </span>
                <span className="font-semibold">
                  {jobStatus.symbols_succeeded.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Failed: </span>
                <span className="font-semibold">{jobStatus.symbols_failed.toLocaleString()}</span>
              </div>
              {jobStatus.last_error && (
                <div className="sm:col-span-2 text-red-300">Last error: {jobStatus.last_error}</div>
              )}
            </div>
          </div>
        )}

        {/* Gas gauge */}
        {jobStatus && progress && (
          <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-100">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">Job progress</span>
              <span className="text-[11px] text-slate-300">{progressPolling ? 'LIVE' : '—'}</span>
            </div>

            <div className="text-[11px] text-slate-300">
              {progress.succeeded + progress.failed} / {progress.total} (
              {progress.pct_complete.toFixed(1)}%)
            </div>

            <div className="mt-2 h-2 w-full rounded bg-slate-800">
              <div
                className="h-2 rounded bg-emerald-500"
                style={{
                  width: `${Math.max(0, Math.min(100, progress.pct_complete))}%`,
                }}
              />
            </div>

            <div className="mt-2 text-[10px] text-slate-400">
              pending {progress.pending} • running {progress.running} • succeeded{' '}
              {progress.succeeded} • failed {progress.failed}
            </div>
          </div>
        )}

        {(loadingWindow || loadingFull) && (
          <Spinner label="Ingest in progress… watch backend logs for details." />
        )}
      </CollapsibleSection>
      <DataLakeBarsSection />
    </CollapsibleSection>
  );
};

export default EodhdIngestSection;
