import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../api';
import type { EodhdJobProgress, EodhdJobStatus, JobState } from './types';

type Props = {
  /**
   * If provided, gauge will track this job id.
   * If omitted, it will try to discover the latest job via /jobs/latest.
   */
  jobId?: string | null;

  /**
   * Polling interval in ms.
   */
  pollMs?: number;

  /**
   * Show Resume button (calls /jobs/{job_id}/resume) when failed or paused.
   */
  showResume?: boolean;

  /**
   * Called when the gauge discovers a job id (helpful to sync parent state).
   */
  onJobId?: (jobId: string) => void;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const stateColorClass = (state: JobState) => {
  if (state === 'succeeded') return 'text-emerald-300';
  if (state === 'running') return 'text-yellow-300';
  return 'text-red-300';
};

const EodhdJobGauge: React.FC<Props> = ({ jobId, pollMs = 1500, showResume = true, onJobId }) => {
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(jobId ?? null);
  const [status, setStatus] = useState<EodhdJobStatus | null>(null);
  const [progress, setProgress] = useState<EodhdJobProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // keep resolved id in sync if parent passes a new one
  useEffect(() => {
    if (jobId) setResolvedJobId(jobId);
  }, [jobId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const fetchLatestJob = async (): Promise<EodhdJobStatus | null> => {
    try {
      const data = await apiClient.get<EodhdJobStatus>('/datalake/eodhd/jobs/latest');
      return data ?? null;
    } catch {
      return null; // no job yet or endpoint not reachable
    }
  };

  const fetchProgress = async (id: string): Promise<EodhdJobProgress | null> => {
    try {
      const data = await apiClient.get<EodhdJobProgress>(`/datalake/eodhd/jobs/${id}/progress`);
      return data ?? null;
    } catch (e) {
      return null;
    }
  };

  const tick = async () => {
    try {
      setErr(null);

      // Resolve job id if we don't have one yet
      let id = resolvedJobId;
      if (!id) {
        const latest = await fetchLatestJob();
        if (latest?.id) {
          id = latest.id;
          if (!mountedRef.current) return;
          setResolvedJobId(id);
          setStatus(latest);
          onJobId?.(id);
        }
      } else {
        // keep status fresh too (useful for last_error + window dates)
        const latest = await fetchLatestJob();
        if (latest?.id === id) setStatus(latest);
      }

      if (!id) {
        setProgress(null);
        return;
      }

      const p = await fetchProgress(id);
      if (!mountedRef.current) return;
      if (p) setProgress(p);

      // If job looks done, slow/stop polling a bit (optional)
      // We'll just keep polling; it's cheap.
    } catch (e: any) {
      if (!mountedRef.current) return;
      setErr('Failed to fetch job progress.');
    }
  };

  useEffect(() => {
    // start polling
    void tick();
    timerRef.current = window.setInterval(() => void tick(), pollMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedJobId, pollMs]);

  const pct = useMemo(() => clamp(progress?.pct_complete ?? 0, 0, 100), [progress?.pct_complete]);
  const state: JobState = (progress?.state ?? status?.state ?? 'running') as JobState;

  const canResume =
    showResume &&
    !!resolvedJobId &&
    (state === 'failed' || (progress && progress.pending > 0) || (progress && progress.failed > 0));

  const handleResume = async () => {
    if (!resolvedJobId) return;
    setResuming(true);
    setErr(null);
    try {
      await apiClient.post(`/datalake/eodhd/jobs/${resolvedJobId}/resume`, {});
      // immediate refresh
      await tick();
    } catch (e) {
      setErr('Resume failed. Check backend logs.');
    } finally {
      setResuming(false);
    }
  };

  if (!resolvedJobId && !status && !progress) {
    return (
      <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Ingest gauge</span>
          <span className="text-slate-400">No job yet</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Start an ingest to see live progress here.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-100">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Ingest gauge</span>
          <span className={`text-[11px] ${stateColorClass(state)}`}>{state.toUpperCase()}</span>
        </div>

        <div className="flex items-center gap-2">
          {canResume && (
            <button
              type="button"
              onClick={handleResume}
              disabled={resuming}
              className="rounded-md border border-slate-600 px-2 py-1 text-[11px] hover:bg-slate-800 disabled:opacity-60"
            >
              {resuming ? 'Resuming…' : 'Resume'}
            </button>
          )}
          <span className="text-[11px] text-slate-500">
            {resolvedJobId ? `Job: ${resolvedJobId.slice(0, 8)}…` : ''}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
          <div
            className="h-2 bg-sky-600"
            style={{ width: `${pct}%` }}
            aria-label={`Progress ${pct.toFixed(1)}%`}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>{pct.toFixed(1)}%</span>
          {progress ? (
            <span>
              total {progress.total.toLocaleString()} • done{' '}
              {(progress.succeeded + progress.failed).toLocaleString()}
            </span>
          ) : (
            <span>loading…</span>
          )}
        </div>
      </div>

      {/* Counters */}
      {progress && (
        <div className="mt-2 grid gap-1 sm:grid-cols-5 text-[11px]">
          <div>
            <span className="text-slate-400">Pending: </span>
            <span className="font-semibold">{progress.pending.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400">Running: </span>
            <span className="font-semibold">{progress.running.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400">Succeeded: </span>
            <span className="font-semibold">{progress.succeeded.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400">Failed: </span>
            <span className="font-semibold">{progress.failed.toLocaleString()}</span>
          </div>
          <div className="sm:text-right">
            <span className="text-slate-400">Window: </span>
            <span className="font-semibold">
              {status ? `${status.requested_start} → ${status.requested_end}` : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {(err || status?.last_error) && (
        <div className="mt-2 rounded border border-red-500/40 bg-red-900/30 px-2 py-1 text-[11px] text-red-100">
          {err ?? `Last error: ${status?.last_error}`}
        </div>
      )}
    </div>
  );
};

export default EodhdJobGauge;
