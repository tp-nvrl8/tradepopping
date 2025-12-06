// frontend/src/components/datahub/PolygonOhlcvSection.tsx
import React, { useState } from "react";
import { apiClient } from "../api";
import CollapsibleSection from "./CollapsibleSection";
import PriceSparkline from "./PriceSparkline";
import { PriceBarDTO } from "./types";

const PolygonOhlcvSection: React.FC = () => {
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2024-01-02");
  const [end, setEnd] = useState("2024-01-31");
  const [bars, setBars] = useState<PriceBarDTO[]>([]);
  const [barsLoading, setBarsLoading] = useState(false);
  const [barsError, setBarsError] = useState<string | null>(null);

  const handleFetchBars = async () => {
    if (!symbol.trim()) return;
    setBars([]);
    setBarsError(null);
    setBarsLoading(true);

    try {
      const res = await apiClient.get<PriceBarDTO[]>(
        "/datahub/polygon/daily-ohlcv",
        {
          params: {
            symbol: symbol.trim().toUpperCase(),
            start,
            end,
          },
        },
      );
      setBars(res.data);
    } catch (err) {
      console.error("Failed to fetch polygon OHLCV", err);
      setBarsError("Failed to fetch OHLCV from Polygon. Check backend logs.");
    } finally {
      setBarsLoading(false);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_section_polygon_ohlcv"
      title="Polygon Daily OHLCV Window"
      defaultOpen={false}
    >
      <div className="flex items-center justify-between mb-1">
        {barsLoading && (
          <span className="text-[11px] text-slate-500">
            Fetching bars…
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-end text-[11px]">
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Symbol</label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="AAPL"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Start (YYYY-MM-DD)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            End (YYYY-MM-DD)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={handleFetchBars}
          disabled={barsLoading}
          className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-[11px]"
        >
          Fetch OHLCV
        </button>
      </div>

      {barsError && (
        <div className="text-[11px] text-amber-400 mt-1">{barsError}</div>
      )}

      {bars.length > 0 && (
        <>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <div>
              Received{" "}
              <span className="font-semibold text-slate-200">
                {bars.length}
              </span>{" "}
              bars for{" "}
              <span className="font-semibold text-slate-200">
                {symbol.toUpperCase()}
              </span>
              .
            </div>
            <div className="font-mono">
              {bars[0].time.slice(0, 10)} →{" "}
              {bars[bars.length - 1].time.slice(0, 10)}
            </div>
          </div>

          <div className="mt-2">
            <PriceSparkline bars={bars} />
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto border border-slate-800 rounded-md">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-900/80">
                <tr className="text-left text-slate-300">
                  <th className="px-2 py-1 border-b border-slate-800">
                    Date
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800 text-right">
                    Open
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800 text-right">
                    High
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800 text-right">
                    Low
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800 text-right">
                    Close
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800 text-right">
                    Volume
                  </th>
                </tr>
              </thead>
              <tbody>
                {bars.map((bar) => (
                  <tr
                    key={bar.time}
                    className="odd:bg-slate-950 even:bg-slate-900/40"
                  >
                    <td className="px-2 py-1 border-b border-slate-900/40">
                      {bar.time.slice(0, 10)}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                      {bar.open.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                      {bar.high.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                      {bar.low.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                      {bar.close.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                      {bar.volume.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
};

export default PolygonOhlcvSection;