// frontend/src/components/datahub/FmpUniverseSection.tsx
import React, { useState } from "react";
import { apiClient } from "../../api";
import CollapsibleSection from "./CollapsibleSection";
import { UniverseIngestResult, UniverseStats } from "./types";

interface FmpUniverseSectionProps {
  onUniverseChanged?: () => void; // optional callback to refresh browser
}

const FmpUniverseSection: React.FC<FmpUniverseSectionProps> = ({
  onUniverseChanged,
}) => {
  const [ingestingUniverse, setIngestingUniverse] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] =
    useState<UniverseIngestResult | null>(null);

  const [universeStats, setUniverseStats] = useState<UniverseStats | null>(
    null,
  );
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Screener controls
  const [fmpMinCap, setFmpMinCap] = useState("50000000");
  const [fmpMaxCap, setFmpMaxCap] = useState("");
  const [fmpExchanges, setFmpExchanges] = useState("NYSE,NASDAQ");
  const [fmpIncludeEtfs, setFmpIncludeEtfs] = useState(false);
  const [fmpActiveOnly, setFmpActiveOnly] = useState(true);
  const [fmpLimit, setFmpLimit] = useState("5000");

  const fetchUniverseStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const res = await apiClient.get<UniverseStats>("/datalake/universe/stats");
      setUniverseStats(res.data);
    } catch (err) {
      console.error("Failed to load universe stats", err);
      setStatsError("Failed to load universe stats. Check backend logs.");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleIngestUniverse = async () => {
    setIngestingUniverse(true);
    setIngestError(null);
    setIngestResult(null);
    try {
      const minCap = parseInt(fmpMinCap || "0", 10);
      const maxCap =
        fmpMaxCap.trim().length > 0 ? parseInt(fmpMaxCap, 10) : null;
      const limit = parseInt(fmpLimit || "0", 10) || 0;

      const exchangesParam = fmpExchanges
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .join(",");

      const params: Record<string, any> = {
        min_market_cap: minCap,
        exchanges: exchangesParam,
        limit,
        include_etfs: fmpIncludeEtfs,
        active_only: fmpActiveOnly,
      };
      if (maxCap !== null) {
        params.max_market_cap = maxCap;
      }

      const res = await apiClient.post<UniverseIngestResult>(
        "/datalake/fmp/universe/ingest",
        {},
        { params },
      );
      setIngestResult(res.data);

      await fetchUniverseStats();
      if (onUniverseChanged) {
        onUniverseChanged();
      }
    } catch (err) {
      console.error("Failed to ingest FMP universe", err);
      setIngestError("Failed to ingest symbol universe from FMP.");
    } finally {
      setIngestingUniverse(false);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_section_fmp_universe"
      title="FMP Symbol Universe → DuckDB"
      defaultOpen={true}
    >
      <p className="text-[11px] text-slate-400 mb-2">
        Pull the FMP symbol universe (with market cap, sector, industry) into
        the data lake using the company screener filters below.
      </p>

      {/* FMP screener controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] mb-2">
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Min market cap (USD)</label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={fmpMinCap}
            onChange={(e) => setFmpMinCap(e.target.value.replace(/,/g, ""))}
            placeholder="50000000"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Max market cap (optional)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={fmpMaxCap}
            onChange={(e) => setFmpMaxCap(e.target.value.replace(/,/g, ""))}
            placeholder=""
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Exchanges (comma-separated)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={fmpExchanges}
            onChange={(e) => setFmpExchanges(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Max symbols (limit)</label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={fmpLimit}
            onChange={(e) =>
              setFmpLimit(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="5000"
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <label className="flex items-center gap-1 text-slate-300">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={fmpIncludeEtfs}
              onChange={(e) => setFmpIncludeEtfs(e.target.checked)}
            />
            <span className="text-[11px]">Include ETFs</span>
          </label>
          <label className="flex items-center gap-1 text-slate-300">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={fmpActiveOnly}
              onChange={(e) => setFmpActiveOnly(e.target.checked)}
            />
            <span className="text-[11px]">Active only</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleIngestUniverse}
          disabled={ingestingUniverse}
          className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
        >
          {ingestingUniverse ? "Ingesting…" : "Ingest FMP Universe"}
        </button>
      </div>

      {ingestError && (
        <div className="text-[11px] text-amber-400 mt-1">{ingestError}</div>
      )}

      {ingestResult && (
        <div className="mt-1 text-[11px] text-slate-300">
          <div>
            Source:{" "}
            <span className="font-semibold uppercase">
              {ingestResult.source}
            </span>
          </div>
          <div>
            Symbols received:{" "}
            <span className="font-semibold">
              {ingestResult.symbols_received}
            </span>
          </div>
          <div>
            Rows upserted:{" "}
            <span className="font-semibold">
              {ingestResult.rows_upserted}
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 border-t border-slate-800 pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-slate-300">
            Universe Stats
          </span>
          <button
            type="button"
            onClick={fetchUniverseStats}
            disabled={statsLoading}
            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-[10px]"
          >
            {statsLoading ? "Refreshing…" : "Refresh stats"}
          </button>
        </div>
        {statsError && (
          <div className="text-[11px] text-amber-400">{statsError}</div>
        )}
        {universeStats && !statsError && (
          <div className="text-[11px] text-slate-300 space-y-2">
            <div>
              Total symbols:{" "}
              <span className="font-semibold">
                {universeStats.total_symbols}
              </span>
            </div>

            <div className="flex flex-wrap gap-6">
              {/* Exchange breakdown */}
              <div>
                <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                  By exchange
                </div>
                <ul className="space-y-0.5">
                  {Object.entries(universeStats.by_exchange).map(
                    ([exch, count]) => (
                      <li key={exch}>
                        <span className="font-mono text-slate-400">
                          {exch}:
                        </span>{" "}
                        <span className="font-semibold">{count}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Type breakdown */}
              <div>
                <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                  By type
                </div>
                <ul className="space-y-0.5">
                  {Object.entries(universeStats.by_type).map(
                    ([t, count]) => (
                      <li key={t}>
                        <span className="font-mono text-slate-400">
                          {t}:
                        </span>{" "}
                        <span className="font-semibold">{count}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Sector breakdown */}
              <div>
                <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                  By sector
                </div>
                <ul className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                  {Object.entries(universeStats.by_sector).map(
                    ([sector, count]) => (
                      <li key={sector}>
                        <span className="font-mono text-slate-400">
                          {sector}:
                        </span>{" "}
                        <span className="font-semibold">{count}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Cap buckets */}
              <div>
                <div className="font-semibold text-slate-200 text-[10px] mb-0.5">
                  By cap bucket
                </div>
                <ul className="space-y-0.5">
                  {Object.entries(universeStats.by_cap_bucket).map(
                    ([bucket, count]) => (
                      <li key={bucket}>
                        <span className="font-mono text-slate-400">
                          {bucket}:
                        </span>{" "}
                        <span className="font-semibold">{count}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default FmpUniverseSection;