// frontend/src/components/datahub/DataSourcesSection.tsx
import React, { useEffect, useState } from "react";
import { apiClient } from "../api";
import CollapsibleSection from "./CollapsibleSection";
import {
  DataSourceStatus,
  DataSourceTestResponse,
} from "./types";

const DataSourcesSection: React.FC = () => {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, DataSourceTestResponse | null>
  >({});

  useEffect(() => {
    const loadSources = async () => {
      try {
        setSourcesLoading(true);
        setSourcesError(null);
        const res = await apiClient.get<DataSourceStatus[]>("/data/sources");
        setSources(res.data);
      } catch (err) {
        console.error("Failed to load data sources", err);
        setSourcesError("Could not load data sources. Check backend logs.");
      } finally {
        setSourcesLoading(false);
      }
    };

    void loadSources();
  }, []);

  const handleTestSource = async (sourceId: string) => {
    setTestingSourceId(sourceId);
    setTestResults((prev) => ({ ...prev, [sourceId]: null }));
    try {
      const res = await apiClient.post<DataSourceTestResponse>(
        "/data/sources/test",
        { source_id: sourceId },
      );
      setTestResults((prev) => ({ ...prev, [sourceId]: res.data }));
    } catch (err) {
      console.error(`Failed to test source ${sourceId}`, err);
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: {
          id: sourceId,
          name: sourceId,
          status: "error",
          has_api_key: false,
          message: "Test call failed. Check console / backend.",
        },
      }));
    } finally {
      setTestingSourceId(null);
    }
  };

  return (
    <CollapsibleSection
      storageKey="tp_datahub_section_sources"
      title="Data Sources"
      defaultOpen={true}
    >
      <div className="flex items-center justify-between mb-1">
        {sourcesLoading && (
          <span className="text-[11px] text-slate-500">Loading...</span>
        )}
      </div>

      {sourcesError ? (
        <div className="text-[11px] text-amber-400">{sourcesError}</div>
      ) : sources.length === 0 ? (
        <div className="text-[11px] text-slate-500">
          No data sources reported. Check backend configuration.
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((src) => {
            const test = testResults[src.id] ?? null;
            const isTesting = testingSourceId === src.id;

            return (
              <div
                key={src.id}
                className="text-[11px] border-b border-slate-800/40 pb-2 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">
                      {src.name}
                    </div>
                    <div className="text-slate-500">
                      Env key present:{" "}
                      <span className="font-mono">
                        {src.has_api_key ? "yes" : "no"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={
                        src.enabled
                          ? "inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/60"
                          : "inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600/60"
                      }
                    >
                      {src.enabled ? "ENABLED" : "DISABLED"}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTestSource(src.id)}
                      disabled={isTesting || !src.has_api_key}
                      className="px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold"
                    >
                      {isTesting ? "Testing…" : "Test source"}
                    </button>
                  </div>
                </div>

                {test && (
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    <span
                      className={
                        test.status === "ok"
                          ? "px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/60"
                          : "px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/60"
                      }
                    >
                      {test.status.toUpperCase()}
                    </span>
                    <span className="text-slate-300">{test.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
};

export default DataSourcesSection;