// frontend/src/components/datahub/FmpUniverseSection.tsx

import React, { useState } from "react";
import { apiClient } from "../../api";
import CollapsibleSection from "./CollapsibleSection";
import { UniverseIngestResult, UniverseStats } from "./types";

interface FmpUniverseSectionProps {
  onUniverseChanged?: () => void; // optional hook if you want to refresh browser
}

const FmpUniverseSection: React.FC<FmpUniverseSectionProps> = ({
  onUniverseChanged,
}) => {
  const [minCap, setMinCap] = useState("50000000");
  const [maxCap, setMaxCap] = useState("");
  const [exchanges, setExchanges] = useState("NYSE,NASDAQ");
  const [limit, setLimit] = useState("5000");
  const [includeEtfs, setIncludeEtfs] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<UniverseIngestResult | null>(
    null,
  );

  const [stats, setStats] = useState<UniverseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const data = await apiClient.get<UniverseStats>(
        "/datalake/universe/stats",
      );
      setStats(data);
    } catch (err) {
      console.error("Failed to load universe stats", err);
      setStatsError("Failed to load universe stats. Check backend logs.");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    setIngestError(null);
    setIngestResult(null);

    try {
      const minCapNum = parseInt(minCap || "0", 10);
      const maxCapNum =
        maxCap.trim().length > 0 ? parseInt(maxCap, 10) : null;
      const limitNum = parseInt(limit || "0", 10) || 0;

      const exchangesParam = exchanges
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .join(",");

      const params: Record<string, unknown> = {
        min_market_cap: minCapNum,
        exchanges: exchangesParam,
        limit: limitNum,
        include_etfs: includeEtfs,
        active_only: activeOnly,
      };

      if (maxCapNum !== null) {
        params.max_market_cap = maxCapNum;
      }

      const data = await apiClient.post<UniverseIngestResult>(
        "/datalake/fmp/universe/ingest",
        {},
        { params },
      );

      setIngestResult(data);
      await loadStats();
      if (onUniverseChanged) onUniverseChanged();
    } catch (err) {
      console.error("Failed to ingest FMP universe", err);
      setIngestError("Failed to ingest symbol universe from FMP.");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_fmp_universe_open"
      title="FMP Universe Ingest + Stats"
      defaultOpen
    >
      <p className="mb-2 text-xs text-slate-300">
        Pull the FMP symbol universe (with market cap, sector, etc.) into the
        data lake. This becomes the core stock list for TradePopping.
      </p>

      {/* Controls */}
      <div className="grid gap-3 text-xs md:grid-cols-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Min market cap (USD)</span>
          <input
            value={minCap}
            onChange={(e) => setMinCap(e.target.value.replace(/,/g, ""))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="50000000"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Max market cap (optional)</span>
          <input
            value={maxCap}
            onChange={(e) => setMaxCap(e.target.value.replace(/,/g, ""))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder=""
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
          <span className="text-slate-200">Max symbols (limit)</span>
          <input
            value={limit}
            onChange={(e) =>
              setLimit(e.target.value.replace(/[^0-9]/g, ""))
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="5000"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
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

        <button
          type="button"
          onClick={handleIngest}
          disabled={ingesting}
          className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {ingesting ? "Ingesting…" : "Ingest FMP Universe"}
        </button>
      </div>

      {ingestError && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {ingestError}
        </div>
      )}

      {ingestResult && (
        <div className="mt-3 grid gap-2 text-xs text-slate-100 sm:grid-cols-3">
          <div>
            <div className="text-slate-400">Source</div>
            <div className="font-semibold">{ingestResult.source}</div>
          </div>
          <div>
            <div className="text-slate-400">Symbols received</div>
            <div className="font-semibold">
              {ingestResult.symbols_received.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Rows upserted</div>
            <div className="font-semibold">
              {ingestResult.rows_upserted.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex items-center gap-3 text-xs">
        <span className="font-semibold text-slate-100">Universe stats</span>
        <button
          type="button"
          onClick={loadStats}
          className="rounded-md border border-slate-600 px-2 py-1 text-[11px] hover:bg-slate-800"
        >
          {statsLoading ? "Refreshing…" : "Refresh stats"}
        </button>
      </div>

      {statsError && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {statsError}
        </div>
      )}

      {statsLoading && <Spinner label="Loading universe stats…" />}

      {stats && !statsLoading && !statsError && (
        <div className="mt-3 grid gap-4 text-xs text-slate-100 md:grid-cols-2">
          <div>
            <div className="mb-1 text-slate-300">
              Total symbols:{" "}
              <span className="font-semibold">
                {stats.total_symbols.toLocaleString()}
              </span>
            </div>

            <div className="mt-2">
              <div className="mb-1 font-semibold text-slate-200">
                By exchange
              </div>
              <ul className="space-y-0.5 text-slate-300">
                {Object.entries(stats.by_exchange).map(([exch, count]) => (
                  <li key={exch}>
                    {exch}:{" "}
                    <span className="font-semibold">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 font-semibold text-slate-200">By type</div>
              <ul className="space-y-0.5 text-slate-300">
                {Object.entries(stats.by_type).map(([t, count]) => (
                  <li key={t}>
                    {t}:{" "}
                    <span className="font-semibold">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-1 font-semibold text-slate-200">By sector</div>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto pr-1 text-slate-300">
                {Object.entries(stats.by_sector).map(([sector, count]) => (
                  <li key={sector}>
                    {sector}:{" "}
                    <span className="font-semibold">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 font-semibold text-slate-200">
                By cap bucket
              </div>
              <ul className="space-y-0.5 text-slate-300">
                {Object.entries(stats.by_cap_bucket).map(([bucket, count]) => (
                  <li key={bucket}>
                    {bucket}:{" "}
                    <span className="font-semibold">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
};

export default FmpUniverseSection;