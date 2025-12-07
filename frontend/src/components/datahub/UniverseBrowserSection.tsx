// frontend/src/components/datahub/UniverseBrowserSection.tsx

import React, { useEffect, useState } from "react";
import { apiClient } from "../../api";
import CollapsibleSection from "./CollapsibleSection";

type SortBy = "symbol" | "market_cap" | "exchange";
type SortDir = "asc" | "desc";

interface UniverseSymbolDTO {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
  market_cap?: number | null;
  is_etf?: boolean | null;
  is_actively_trading?: boolean | null;
}

interface UniverseBrowseResponse {
  total_count: number;
  page: number;
  page_size: number;
  symbols: UniverseSymbolDTO[];
}

const UniverseBrowserSection: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<SortBy>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [data, setData] = useState<UniverseBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  const loadPage = async (
    pageArg: number = page,
    sortByArg: SortBy = sortBy,
    sortDirArg: SortDir = sortDir,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const resp = await apiClient.get<UniverseBrowseResponse>(
        "/datalake/universe/browse",
        {
          params: {
            page: pageArg,
            page_size: pageSize,
            sort_by: sortByArg,
            sort_dir: sortDirArg,
          },
        },
      );
      setData(resp);
      setPage(pageArg);
      setSortBy(sortByArg);
      setSortDir(sortDirArg);
    } catch (err) {
      console.error("Failed to browse universe", err);
      setError(
        "Failed to load symbol_universe. Check backend route /datalake/universe/browse.",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage(1, "symbol", "asc");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (field: SortBy) => {
    const nextDir: SortDir =
      sortBy === field && sortDir === "asc" ? "desc" : "asc";
    void loadPage(1, field, nextDir);
  };

  const totalCount = data?.total_count ?? 0;
  const symbols = data?.symbols ?? [];
  const totalPages =
    totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  return (
    <CollapsibleSection
      storageKey="tp_datahub_universe_browser_open"
      title="Universe Browser"
      defaultOpen
    >
      <p className="mb-2 text-xs text-slate-300">
        Browse the{" "}
        <span className="font-mono text-slate-100">symbol_universe</span> table
        stored in DuckDB. Use this to confirm that the FMP universe ingest is
        populated and looks sane.
      </p>

      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="text-[11px] text-slate-300">
          {totalCount > 0 ? (
            <>
              Showing page{" "}
              <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> (
              {totalCount.toLocaleString()} symbols)
            </>
          ) : (
            "No symbols loaded yet. Try ingesting the FMP universe first."
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadPage(page - 1)}
            disabled={loading || page <= 1}
            className="rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => loadPage(page + 1)}
            disabled={loading || page >= totalPages}
            className="rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {loading && <Spinner label="Loading symbol universe…" />}

      {error && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {!loading && !error && symbols.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          No symbols to display. If you expect data, check that the FMP universe
          ingest has run and that the symbol_universe table exists.
        </p>
      )}

      {!loading && !error && symbols.length > 0 && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-slate-800">
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="bg-slate-900 text-left text-slate-200">
              <tr>
                <th
                  className="cursor-pointer px-2 py-1"
                  onClick={() => handleSort("symbol")}
                >
                  Symbol
                  {sortBy === "symbol" && (
                    <span className="ml-1 text-[9px]">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                <th className="px-2 py-1">Name</th>
                <th
                  className="cursor-pointer px-2 py-1"
                  onClick={() => handleSort("exchange")}
                >
                  Exchange
                  {sortBy === "exchange" && (
                    <span className="ml-1 text-[9px]">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                <th
                  className="cursor-pointer px-2 py-1 text-right"
                  onClick={() => handleSort("market_cap")}
                >
                  Market cap
                  {sortBy === "market_cap" && (
                    <span className="ml-1 text-[9px]">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
                <th className="px-2 py-1 text-center">ETF?</th>
                <th className="px-2 py-1 text-center">Active?</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((row) => (
                <tr
                  key={row.symbol}
                  className="border-t border-slate-800 odd:bg-slate-950/40"
                >
                  <td className="px-2 py-1 font-mono text-[11px] text-slate-50">
                    {row.symbol}
                  </td>
                  <td className="px-2 py-1 text-slate-200">
                    {row.name ?? ""}
                  </td>
                  <td className="px-2 py-1 text-slate-200">
                    {row.exchange ?? ""}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-200">
                    {row.market_cap != null
                      ? `$${row.market_cap.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-2 py-1 text-center text-slate-200">
                    {row.is_etf == null ? "?" : row.is_etf ? "Yes" : "No"}
                  </td>
                  <td className="px-2 py-1 text-center text-slate-200">
                    {row.is_actively_trading == null
                      ? "?"
                      : row.is_actively_trading
                      ? "Yes"
                      : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
  );
};

export default UniverseBrowserSection;