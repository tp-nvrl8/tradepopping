// frontend/src/components/datahub/EodhdIngestSection.tsx
import React, { useState } from "react";
import { apiClient } from "../api";
import CollapsibleSection from "./CollapsibleSection";
import { EodhdIngestResponse, EodhdJobStatus } from "./types";

const EodhdIngestSection: React.FC = () => {
  const [eodStart, setEodStart] = useState("2024-01-02");
  const [eodEnd, setEodEnd] = useState("2024-01-31");
  const [eodMinCap, setEodMinCap] = useState("50000000"); // 50M
  const [eodMaxCap, setEodMaxCap] = useState("");
  const [eodExchanges, setEodExchanges] = useState("NYSE,NASDAQ");
  const [eodIncludeEtfs, setEodIncludeEtfs] = useState(false);
  const [eodActiveOnly, setEodActiveOnly] = useState(true);
  const [eodMaxSymbols, setEodMaxSymbols] = useState("25");

  const [eodLoading, setEodLoading] = useState(false);
  const [eodError, setEodError] = useState<string | null>(null);
  const [eodResult, setEodResult] = useState<EodhdIngestResponse | null>(null);

  const [eodJobStatus, setEodJobStatus] = useState<EodhdJobStatus | null>(
    null,
  );
  const [eodJobRefreshing, setEodJobRefreshing] = useState(false);

  const refreshEodJobStatus = async () => {
    setEodJobRefreshing(true);
    try {
      const res = await apiClient.get<EodhdJobStatus>(
        "/datalake/eodhd/jobs/latest",
      );
      setEodJobStatus(res.data);
    } catch (err) {
      console.error("Failed to refresh EODHD job status", err);
    } finally {
      setEodJobRefreshing(false);
    }
  };

  const handleIngestEodhdWindow = async () => {
    setEodLoading(true);
    setEodError(null);
    setEodResult(null);

    try {
      const minCap = parseInt(eodMinCap || "0", 10);
      const maxCap =
        eodMaxCap.trim().length > 0 ? parseInt(eodMaxCap, 10) : null;
      const maxSymbols = parseInt(eodMaxSymbols || "0", 10) || 0;

      const payload = {
        start: eodStart,
        end: eodEnd,
        min_market_cap: minCap,
        max_market_cap: maxCap,
        exchanges: eodExchanges
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        include_etfs: eodIncludeEtfs,
        active_only: eodActiveOnly,
        max_symbols: maxSymbols,
      };

      const res = await apiClient.post<EodhdIngestResponse>(
        "/datalake/eodhd/ingest-window",
        payload,
      );
      setEodResult(res.data);

      // Snapshot job info from the response
      setEodJobStatus((prev) => ({
        id: res.data.job_id,
        created_at: prev?.created_at ?? new Date().toISOString(),
        started_at: prev?.started_at ?? new Date().toISOString(),
        finished_at: new Date().toISOString(),
        state: res.data.job_state,
        requested_start: res.data.requested_start,
        requested_end: res.data.requested_end,
        universe_symbols_considered: res.data.universe_symbols_considered,
        symbols_attempted: res.data.symbols_attempted,
        symbols_succeeded: res.data.symbols_succeeded,
        symbols_failed: res.data.symbols_failed,
        last_error:
          res.data.symbols_failed > 0
            ? "Some symbols failed during ingest."
            : null,
      }));

      // Also sync from backend registry (most recent job)
      void refreshEodJobStatus();
    } catch (err) {
      console.error("Failed to ingest EODHD window", err);
      setEodError(
        "Failed to ingest EODHD bars for that window. Check backend logs.",
      );
    } finally {
      setEodLoading(false);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_section_eodhd_window"
      title="EODHD Bars → Daily Window Ingest"
      defaultOpen={true}
    >
      <p className="text-[11px] text-slate-400 mb-2">
        Use the FMP symbol universe in DuckDB to bulk-ingest daily bars from
        EODHD for a specific date range. This runs as a tracked “job” so you can
        inspect the latest ingest status.
      </p>

      {/* Controls row */}
      <div className="mt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Start date</label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={eodStart}
            onChange={(e) => setEodStart(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">End date</label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={eodEnd}
            onChange={(e) => setEodEnd(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Min market cap (USD)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={eodMinCap}
            onChange={(e) =>
              setEodMinCap(e.target.value.replace(/,/g, ""))
            }
            placeholder="50000000"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Max market cap (optional)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={eodMaxCap}
            onChange={(e) =>
              setEodMaxCap(e.target.value.replace(/,/g, ""))
            }
            placeholder=""
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Exchanges (comma-separated)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={eodExchanges}
            onChange={(e) => setEodExchanges(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Max symbols</label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={eodMaxSymbols}
            onChange={(e) =>
              setEodMaxSymbols(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="25"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <label className="flex items-center gap-1 text-slate-300">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={eodIncludeEtfs}
              onChange={(e) => setEodIncludeEtfs(e.target.checked)}
            />
            <span className="text-[11px]">Include ETFs</span>
          </label>
          <label className="flex items-center gap-1 text-slate-300">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={eodActiveOnly}
              onChange={(e) => setEodActiveOnly(e.target.checked)}
            />
            <span className="text-[11px]">Active only</span>
          </label>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handleIngestEodhdWindow}
          disabled={eodLoading}
          className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
        >
          {eodLoading ? "Ingesting window…" : "Ingest EODHD window"}
        </button>
        <div className="flex items-center gap-2">
          {eodLoading && (
            <span className="text-[11px] text-slate-500">
              Talking to EODHD and DuckDB…
            </span>
          )}
          <button
            type="button"
            onClick={refreshEodJobStatus}
            disabled={eodJobRefreshing}
            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-[10px]"
          >
            {eodJobRefreshing ? "Refreshing…" : "Refresh job status"}
          </button>
        </div>
      </div>

      {eodError && (
        <div className="text-[11px] text-amber-400 mt-1">{eodError}</div>
      )}

      {eodResult && (
        <div className="mt-2 text-[11px] text-slate-300 border border-slate-800 rounded-md p-2 bg-slate-950/40">
          <div className="flex items-center justify-between mb-1">
            <div className="flex flex-col">
              <span className="font-semibold text-slate-200">
                Latest EODHD ingest
              </span>
              <span className="font-mono text-slate-400">
                {eodResult.requested_start} → {eodResult.requested_end}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              {eodJobStatus && (
                <span className="text-[10px]">
                  Job{" "}
                  <span className="font-mono">
                    {eodJobStatus.id.slice(0, 8)}…
                  </span>{" "}
                  <span
                    className={
                      eodJobStatus.state === "succeeded"
                        ? "text-emerald-300"
                        : eodJobStatus.state === "running"
                        ? "text-sky-300"
                        : "text-rose-300"
                    }
                  >
                    ({eodJobStatus.state})
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <div className="text-slate-400 text-[10px]">
                Universe symbols
              </div>
              <div className="font-semibold">
                {eodResult.universe_symbols_considered}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">
                Symbols attempted
              </div>
              <div className="font-semibold">
                {eodResult.symbols_attempted}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">
                Succeeded / Failed
              </div>
              <div className="font-semibold">
                {eodResult.symbols_succeeded} / {eodResult.symbols_failed}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">
                Rows observed
              </div>
              <div className="font-semibold">
                {eodResult.rows_observed_after_ingest.toLocaleString()}
              </div>
            </div>
          </div>
          {eodResult.failed_symbols.length > 0 && (
            <div className="mt-1 text-[10px] text-amber-300">
              Failed symbols: {eodResult.failed_symbols.join(", ")}
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
};

export default EodhdIngestSection;