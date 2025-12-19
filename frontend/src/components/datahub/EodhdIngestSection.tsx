// frontend/src/components/datahub/EodhdIngestSection.tsx

import React, { useState } from "react";
import { apiClient } from "../../api";
import CollapsibleSection from "./CollapsibleSection";
import DataLakeBarsSection from "./DataLakeBarsSection";
import { EodhdIngestResponse, EodhdJobStatus } from "./types";

type IngestMode = "window" | "full";

const EodhdIngestSection: React.FC = () => {
  // Window-only dates
  const [start, setStart] = useState("2024-01-02");
  const [end, setEnd] = useState("2024-01-31");

  // Full-history start override
  const [fullHistoryStart, setFullHistoryStart] = useState("2015-01-01");

  // Filters shared by both window + full history
  const [minCap, setMinCap] = useState("50000000");
  const [maxCap, setMaxCap] = useState("");
  const [exchanges, setExchanges] = useState("NYSE,NASDAQ");
  const [includeEtfs, setIncludeEtfs] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [maxSymbols, setMaxSymbols] = useState("25");

  const [loadingWindow, setLoadingWindow] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EodhdIngestResponse | null>(null);

  const [jobStatus, setJobStatus] = useState<EodhdJobStatus | null>(null);
  const [jobRefreshing, setJobRefreshing] = useState(false);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  const refreshJobStatus = async () => {
    setJobRefreshing(true);
    try {
      const data = await apiClient.get<EodhdJobStatus>(
        "/datalake/eodhd/jobs/latest",
      );
      setJobStatus(data);
    } catch (err) {
      console.error("Failed to refresh EODHD job status", err);
    } finally {
      setJobRefreshing(false);
    }
  };

  const buildPayload = (mode: IngestMode) => {
    const minCapNum = parseInt(minCap || "0", 10);
    const maxCapNum =
      maxCap.trim().length > 0 ? parseInt(maxCap, 10) : null;
    const maxSymbolsNum = parseInt(maxSymbols || "0", 10) || 0;

    const base = {
      min_market_cap: minCapNum,
      max_market_cap: maxCapNum,
      exchanges: exchanges
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      include_etfs: includeEtfs,
      active_only: activeOnly,
      max_symbols: maxSymbolsNum,
    };

    if (mode === "window") {
      return {
        ...base,
        start,
        end,
      };
    }

    // mode === "full"
    const startOverride =
      fullHistoryStart.trim().length > 0 ? fullHistoryStart.trim() : start;

    return {
      ...base,
      start: startOverride,
    };
  };

  const handleIngestWindow = async () => {
    setLoadingWindow(true);
    setError(null);
    setResult(null);

    try {
      const payload = buildPayload("window");
      const data = await apiClient.post<EodhdIngestResponse>(
        "/datalake/eodhd/ingest-window",
        payload,
      );

      setResult(data);

      setJobStatus((prev) => ({
        id: data.job_id,
        created_at: prev?.created_at ?? new Date().toISOString(),
        started_at: prev?.started_at ?? new Date().toISOString(),
        finished_at: new Date().toISOString(),
        state: data.job_state,
        requested_start: data.requested_start,
        requested_end: data.requested_end,
        universe_symbols_considered: data.universe_symbols_considered,
        symbols_attempted: data.symbols_attempted,
        symbols_succeeded: data.symbols_succeeded,
        symbols_failed: data.symbols_failed,
        last_error:
          data.symbols_failed > 0
            ? "Some symbols failed during ingest."
            : null,
      }));

      void refreshJobStatus();
    } catch (err) {
      console.error("Failed to ingest EODHD window", err);
      setError(
        "Failed to ingest EODHD daily bars for that window. Check backend logs.",
      );
    } finally {
      setLoadingWindow(false);
    }
  };

  const handleIngestFullHistory = async () => {
    setLoadingFull(true);
    setError(null);
    setResult(null);

    try {
      const payload = buildPayload("full");
      const data = await apiClient.post<EodhdIngestResponse>(
        "/datalake/eodhd/ingest-full-history",
        payload,
      );

      setResult(data);
      void refreshJobStatus();
    } catch (err) {
      console.error("Failed to ingest EODHD full history", err);
      setError(
        "Failed to ingest full EODHD history. Confirm the backend route path and payload.",
      );
    } finally {
      setLoadingFull(false);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_eodhd_ingest_open"
      title="EODHD Daily Bar Ingest"
      defaultOpen
    >
      <p className="mb-2 text-xs text-slate-300">
        Ingest daily OHLCV bars from EODHD into the data lake. Use a small
        window for testing, then a full-history run from a chosen start date.
      </p>

      {/* Filters / controls */}
      <div className="grid gap-3 text-xs md:grid-cols-3 lg:grid-cols-4">
        {/* Window start/end */}
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Window start (YYYY-MM-DD)</span>
          <input
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Window end (YYYY-MM-DD)</span>
          <input
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        {/* Full-history start override */}
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">
            Full-history start (YYYY-MM-DD)
          </span>
          <input
            value={fullHistoryStart}
            onChange={(e) => setFullHistoryStart(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="2015-01-01"
          />
          <span className="mt-0.5 text-[10px] text-slate-400">
            Used only for “Ingest full history”. End date is always “today”.
          </span>
        </label>

        {/* Cap filters */}
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Min market cap (USD)</span>
          <input
            value={minCap}
            onChange={(e) => setMinCap(e.target.value.replace(/,/g, ""))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Max market cap (optional)</span>
          <input
            value={maxCap}
            onChange={(e) => setMaxCap(e.target.value.replace(/,/g, ""))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Exchanges (comma-separated)</span>
          <input
            value={exchanges}
            onChange={(e) => setExchanges(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="NYSE,NASDAQ"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Max symbols (sample limit)</span>
          <input
            value={maxSymbols}
            onChange={(e) =>
              setMaxSymbols(e.target.value.replace(/[^0-9]/g, ""))
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <div className="flex flex-col justify-end gap-1 text-xs">
          <label className="inline-flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={includeEtfs}
              onChange={(e) => setIncludeEtfs(e.target.checked)}
              className="h-3 w-3"
            />
            Include ETFs
          </label>
          <label className="inline-flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-3 w-3"
            />
            Active only
          </label>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={handleIngestWindow}
          disabled={loadingWindow || loadingFull}
          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loadingWindow ? "Ingesting window…" : "Ingest window"}
        </button>

        <button
          type="button"
          onClick={handleIngestFullHistory}
          disabled={loadingWindow || loadingFull}
          className="rounded-md bg-sky-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
        >
          {loadingFull ? "Ingesting full history…" : "Ingest full history"}
        </button>

        <button
          type="button"
          onClick={refreshJobStatus}
          disabled={jobRefreshing}
          className="ml-auto rounded-md border border-slate-600 px-2 py-1 text-[11px] hover:bg-slate-800 disabled:opacity-60"
        >
          {jobRefreshing ? "Refreshing job…" : "Refresh job status"}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

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
            <div className="font-semibold">
              {result.symbols_attempted.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Rows observed in lake</div>
            <div className="font-semibold">
              {result.rows_observed_after_ingest.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {jobStatus && (
        <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-100">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">Latest ingest job</span>
            <span
              className={
                jobStatus.state === "succeeded"
                  ? "text-emerald-300"
                  : jobStatus.state === "running"
                  ? "text-yellow-300"
                  : "text-red-300"
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
              <span className="text-slate-400">Symbols attempted: </span>
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
              <span className="font-semibold">
                {jobStatus.symbols_failed.toLocaleString()}
              </span>
            </div>
            {jobStatus.last_error && (
              <div className="sm:col-span-2 text-red-300">
                Last error: {jobStatus.last_error}
              </div>
            )}
          </div>
        </div>
      )}

      {(loadingWindow || loadingFull) && (
        <Spinner label="Ingest in progress… watch backend logs for details." />
      )}
      <div>
        <DataLakeBarsSection/>
      </div>
    </CollapsibleSection>
  );
};

export default EodhdIngestSection;