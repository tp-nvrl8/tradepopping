// frontend/src/components/datahub/UniverseBrowserSection.tsx
import React, { useEffect, useState } from "react";
import { apiClient } from "../api";
import CollapsibleSection from "./CollapsibleSection";
import { UniverseBrowseResponse } from "./types";

const UniverseBrowserSection: React.FC = () => {
  const [browserPage, setBrowserPage] = useState(1);
  const [browserPageSize, setBrowserPageSize] = useState(50);
  const [browserSearch, setBrowserSearch] = useState("");
  const [browserSector, setBrowserSector] = useState<string>("");
  const [browserMinCap, setBrowserMinCap] = useState("");
  const [browserMaxCap, setBrowserMaxCap] = useState("");
  const [browserSortBy, setBrowserSortBy] =
    useState<"symbol" | "name" | "sector" | "exchange" | "market_cap" | "price">(
      "symbol",
    );
  const [browserSortDir, setBrowserSortDir] =
    useState<"asc" | "desc">("asc");
  const [browserData, setBrowserData] =
    useState<UniverseBrowseResponse | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);

  const fetchUniverseBrowse = async (pageOverride?: number) => {
    const pageToLoad = pageOverride ?? browserPage;
    setBrowserLoading(true);
    setBrowserError(null);

    try {
      const params: Record<string, any> = {
        page: pageToLoad,
        page_size: browserPageSize,
        sort_by: browserSortBy,
        sort_dir: browserSortDir,
      };

      if (browserSearch.trim()) {
        params.search = browserSearch.trim();
      }
      if (browserSector) {
        params.sector = browserSector;
      }
      if (browserMinCap.trim()) {
        params.min_market_cap = parseInt(
          browserMinCap.replace(/,/g, ""),
          10,
        );
      }
      if (browserMaxCap.trim()) {
        params.max_market_cap = parseInt(
          browserMaxCap.replace(/,/g, ""),
          10,
        );
      }

      const res = await apiClient.get<UniverseBrowseResponse>(
        "/datalake/universe/browse",
        { params },
      );
      setBrowserData(res.data);
      setBrowserPage(res.data.page);
    } catch (err) {
      console.error("Failed to load universe browser page", err);
      setBrowserError(
        "Failed to load universe browser. Check backend logs.",
      );
    } finally {
      setBrowserLoading(false);
    }
  };

  useEffect(() => {
    void fetchUniverseBrowse(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CollapsibleSection
      storageKey="tp_datahub_section_universe_browser"
      title="Universe Browser (symbols & caps)"
      defaultOpen={true}
    >
      <p className="text-[11px] text-slate-400 mb-2">
        Browse the stored symbol universe with paging, search, sector and cap
        filters. This is your “truth table” for what&apos;s tradable in
        TradePopping.
      </p>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] mb-2">
        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Search</label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={browserSearch}
            onChange={(e) => setBrowserSearch(e.target.value)}
            placeholder="Symbol or name"
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Sector</label>
          <select
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={browserSector}
            onChange={(e) => setBrowserSector(e.target.value)}
          >
            <option value="">All</option>
            {browserData?.sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Min market cap (USD)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={browserMinCap}
            onChange={(e) =>
              setBrowserMinCap(e.target.value.replace(/,/g, ""))
            }
            placeholder={
              browserData?.min_market_cap
                ? Math.round(browserData.min_market_cap).toString()
                : ""
            }
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">
            Max market cap (USD)
          </label>
          <input
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={browserMaxCap}
            onChange={(e) =>
              setBrowserMaxCap(e.target.value.replace(/,/g, ""))
            }
            placeholder={
              browserData?.max_market_cap
                ? Math.round(browserData.max_market_cap).toString()
                : ""
            }
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Sort by</label>
          <select
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={browserSortBy}
            onChange={(e) =>
              setBrowserSortBy(
                e.target.value as
                  | "symbol"
                  | "name"
                  | "sector"
                  | "exchange"
                  | "market_cap"
                  | "price",
              )
            }
          >
            <option value="symbol">Symbol</option>
            <option value="name">Name</option>
            <option value="sector">Sector</option>
            <option value="exchange">Exchange</option>
            <option value="market_cap">Market cap</option>
            <option value="price">Price</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Sort direction</label>
          <select
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={browserSortDir}
            onChange={(e) =>
              setBrowserSortDir(e.target.value as "asc" | "desc")
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-0.5 text-slate-400">Rows per page</label>
          <select
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={browserPageSize}
            onChange={(e) =>
              setBrowserPageSize(parseInt(e.target.value, 10))
            }
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => fetchUniverseBrowse(1)}
          disabled={browserLoading}
          className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
        >
          {browserLoading ? "Loading…" : "Apply filters"}
        </button>
        {browserData && (
          <span className="text-[11px] text-slate-400">
            {browserData.total_items.toLocaleString()} symbols • page{" "}
            <span className="font-mono">
              {browserData.page}/{browserData.total_pages}
            </span>
          </span>
        )}
      </div>

      {browserError && (
        <div className="text-[11px] text-amber-400 mb-1">
          {browserError}
        </div>
      )}

      {browserData && browserData.items.length > 0 && (
        <>
          <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-md">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr className="text-left text-slate-300">
                  <th className="px-2 py-1 border-b border-slate-800">
                    Symbol
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800">
                    Name
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800">
                    Exchange
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800">
                    Sector
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800 text-right">
                    Market cap
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800 text-right">
                    Price
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800">
                    Type
                  </th>
                  <th className="px-2 py-1 border-b border-slate-800">
                    Active
                  </th>
                </tr>
              </thead>
              <tbody>
                {browserData.items.map((row) => (
                  <tr
                    key={row.symbol}
                    className="odd:bg-slate-950 even:bg-slate-900/40"
                  >
                    <td className="px-2 py-1 border-b border-slate-900/40 font-mono">
                      {row.symbol}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40">
                      {row.name}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40">
                      {row.exchange}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40">
                      {row.sector ?? "UNKNOWN"}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                      {row.market_cap.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40 text-right">
                      {row.price.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40">
                      {row.is_etf ? "ETF" : "EQUITY"}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-900/40">
                      {row.is_actively_trading ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <div>
              Rows{" "}
              {browserData.items.length > 0 && (
                <>
                  <span className="font-mono">
                    {1 +
                      (browserData.page - 1) * browserData.page_size}
                  </span>{" "}
                  –{" "}
                  <span className="font-mono">
                    {Math.min(
                      browserData.page * browserData.page_size,
                      browserData.total_items,
                    )}
                  </span>
                </>
              )}{" "}
              of{" "}
              <span className="font-mono">
                {browserData.total_items.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={browserLoading || browserData.page <= 1}
                onClick={() => fetchUniverseBrowse(browserData.page - 1)}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={
                  browserLoading ||
                  browserData.page >= browserData.total_pages
                }
                onClick={() => fetchUniverseBrowse(browserData.page + 1)}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {!browserLoading &&
        !browserError &&
        browserData &&
        browserData.items.length === 0 && (
          <div className="text-[11px] text-slate-500">
            No symbols match the current filters.
          </div>
        )}
    </CollapsibleSection>
  );
};

export default UniverseBrowserSection;