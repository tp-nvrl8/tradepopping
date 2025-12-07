// frontend/src/components/datahub/DataLakeBarsSection.tsx

import React, { useState } from "react";
import { apiClient } from "../../api";
import CollapsibleSection from "./CollapsibleSection";
import PriceSparkline from "./PriceSparkline";
import { PriceBarDTO } from "./types";

const DataLakeBarsSection: React.FC = () => {
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2024-01-02");
  const [end, setEnd] = useState("2024-01-31");

  const [bars, setBars] = useState<PriceBarDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  const handleFetchBars = async () => {
    if (!symbol.trim()) return;

    setBars([]);
    setError(null);
    setLoading(true);

    try {
      const data = await apiClient.get<PriceBarDTO[]>(
        "/datalake/bars/daily",
        {
          params: {
            symbol: symbol.trim().toUpperCase(),
            start,
            end,
          },
        },
      );
      setBars(data);
    } catch (err) {
      console.error("Failed to fetch daily bars from data lake", err);
      setError(
        "Failed to read daily bars from the data lake. Confirm EODHD ingest and backend route.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_datalake_bars_open"
      title="Data Lake Bars Preview"
      defaultOpen
    >
      <p className="mb-2 text-xs text-slate-300">
        Read daily OHLCV bars directly from the DuckDB data lake (daily_bars
        table). Use this to verify that EODHD ingests are actually landing in
        storage.
      </p>

      {/* Controls */}
      <div className="grid gap-3 text-xs md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Symbol</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="AAPL"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Start date</span>
          <input
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">End date</span>
          <input
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={handleFetchBars}
          disabled={loading}
          className="rounded-md bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Fetch from data lake"}
        </button>

        {bars.length > 0 && (
          <span className="text-[11px] text-slate-300">
            {bars.length} bars returned
          </span>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {loading && <Spinner label="Reading bars from data lake…" />}

      {bars.length > 0 && !loading && (
        <>
          <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
            <div className="mb-1 text-[11px] text-slate-300">
              Close-price sparkline (from data lake)
            </div>
            <PriceSparkline bars={bars} />
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-slate-800">
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="bg-slate-900 text-left text-slate-200">
                <tr>
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1 text-right">Open</th>
                  <th className="px-2 py-1 text-right">High</th>
                  <th className="px-2 py-1 text-right">Low</th>
                  <th className="px-2 py-1 text-right">Close</th>
                  <th className="px-2 py-1 text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {bars.map((bar) => (
                  <tr
                    key={bar.time}
                    className="border-t border-slate-800 odd:bg-slate-950/40"
                  >
                    <td className="px-2 py-1 text-slate-200">
                      {bar.time.slice(0, 10)}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-200">
                      {bar.open.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-200">
                      {bar.high.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-200">
                      {bar.low.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-200">
                      {bar.close.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-200">
                      {bar.volume.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {bars.length === 0 && !loading && !error && (
        <p className="mt-2 text-xs text-slate-400">
          No bars found for that symbol and window in the data lake.
        </p>
      )}
    </CollapsibleSection>
  );
};

export default DataLakeBarsSection;