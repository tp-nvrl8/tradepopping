// frontend/src/components/datahub/UniverseBrowserSection.tsx

import React, { useEffect, useState } from "react";
import { apiClient } from "../../api";
import CollapsibleSection from "./CollapsibleSection";
import {
  UniverseBrowseResponse,
  UniverseRow,
} from "./types";

const UniverseBrowserSection: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [minCap, setMinCap] = useState("");
  const [maxCap, setMaxCap] = useState("");
  const [sortBy, setSortBy] = useState<
    "symbol" | "name" | "sector" | "exchange" | "market_cap" | "price"
  >("symbol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [data, setData] = useState<UniverseBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  const loadPage = async (pageOverride?: number) => {
    const pageToLoad = pageOverride ?? page;
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {
        page: pageToLoad,
        page_size: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
      };

      if (search.trim()) params.search = search.trim();
      if (sector) params.sector = sector;
      if (minCap.trim())
        params.min_market_cap = parseInt(minCap.replace(/,/g, ""), 10);
      if (maxCap.trim())
        params.max_market_cap = parseInt(maxCap.replace(/,/g, ""), 10);

      const result = await apiClient.get<UniverseBrowseResponse>(
        "/datalake/universe/browse",
        { params },
      );
      setData(result);
      setPage(result.page);
    } catch (err) {
      console.error("Failed to load universe browser page", err);
      setError("Failed to load universe browser. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    void loadPage(1);
  };

  const handlePrev = () => {
    if (!data) return;
    if (data.page <= 1) return;
    void loadPage(data.page - 1);
  };

  const handleNext = () => {
    if (!data) return;
    if (data.page >= data.total_pages) return;
    void loadPage(data.page + 1);
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_universe_browser_open"
      title="Universe Browser"
      defaultOpen
    >
      <p className="mb-2 text-xs text-slate-300">
        Browse the stored symbol universe with paging, search, sector filters,
        and market cap bands. This is your truth table for what’s tradable.
      </p>

      {/* Controls */}
      <div className="grid gap-2 text-xs md:grid-cols-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Symbol or name"
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Sector</span>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          >
            <option value="">All</option>
            {data?.sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Min market cap (USD)</span>
          <input
            value={minCap}
            onChange={(e) => setMinCap(e.target.value.replace(/,/g, ""))}
            placeholder={
              data?.min_market_cap
                ? Math.round(data.min_market_cap).toString()
                : ""
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Max market cap (USD)</span>
          <input
            value={maxCap}
            onChange={(e) => setMaxCap(e.target.value.replace(/,/g, ""))}
            placeholder={
              data?.max_market_cap
                ? Math.round(data.max_market_cap).toString()
                : ""
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "symbol"
                  | "name"
                  | "sector"
                  | "exchange"
                  | "market_cap"
                  | "price",
              )
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          >
            <option value="symbol">Symbol</option>
            <option value="name">Name</option>
            <option value="sector">Sector</option>
            <option value="exchange">Exchange</option>
            <option value="market_cap">Market cap</option>
            <option value="price">Price</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Sort direction</span>
          <select
            value={sortDir}
            onChange={(e) =>
              setSortDir(e.target.value as "asc" | "desc")
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-200">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) =>
              setPageSize(parseInt(e.target.value, 10))
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-50 hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Apply filters"}
          </button>
        </div>
      </div>

      {data && (
        <div className="mt-2 text-[11px] text-slate-300">
          {data.total_items.toLocaleString()} symbols • page{" "}
          {data.page}/{data.total_pages}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {loading && <Spinner label="Loading symbols…" />}

      {data && data.items.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-md border border-slate-800">
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="bg-slate-900 text-left text-slate-200">
              <tr>
                <th className="px-2 py-1">Symbol</th>
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Exchange</th>
                <th className="px-2 py-1">Sector</th>
                <th className="px-2 py-1 text-right">Market cap</th>
                <th className="px-2 py-1 text-right">Price</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Active</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row: UniverseRow) => (
                <tr
                  key={row.symbol}
                  className="border-t border-slate-800 odd:bg-slate-950/40"
                >
                  <td className="px-2 py-1 font-semibold text-slate-50">
                    {row.symbol}
                  </td>
                  <td className="px-2 py-1 text-slate-200">{row.name}</td>
                  <td className="px-2 py-1 text-slate-300">
                    {row.exchange}
                  </td>
                  <td className="px-2 py-1 text-slate-300">
                    {row.sector ?? "UNKNOWN"}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-200">
                    {row.market_cap.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-200">
                    {row.price.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-slate-300">
                    {row.is_etf ? "ETF" : "EQUITY"}
                  </td>
                  <td className="px-2 py-1 text-slate-200">
                    {row.is_actively_trading ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200">
            <div>
              Rows{" "}
              {1 + (data.page - 1) * data.page_size} –{" "}
              {Math.min(data.page * data.page_size, data.total_items)} of{" "}
              {data.total_items.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={data.page <= 1 || loading}
                className="rounded-md border border-slate-600 px-2 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                {data.page}/{data.total_pages}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={data.page >= data.total_pages || loading}
                className="rounded-md border border-slate-600 px-2 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {data && !loading && data.items.length === 0 && !error && (
        <p className="mt-2 text-xs text-slate-400">
          No symbols match your filters.
        </p>
      )}
    </CollapsibleSection>
  );
};

export default UniverseBrowserSection;