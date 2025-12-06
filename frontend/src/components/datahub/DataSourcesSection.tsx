// frontend/src/components/datahub/DataSourcesSection.tsx

import React, { useEffect, useState } from "react";
import { apiClient } from "../../api";
import CollapsibleSection from "./CollapsibleSection";
import {
  DataSourceStatus,
  DataSourceTestResponse,
} from "./types";

const DataSourcesSection: React.FC = () => {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, DataSourceTestResponse | null>
  >({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<DataSourceStatus[]>("/data/sources");
        setSources(data);
      } catch (err) {
        console.error("Failed to load data sources", err);
        setError("Could not load data sources. Check backend logs.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResults((prev) => ({ ...prev, [id]: null }));
    try {
      const result = await apiClient.post<DataSourceTestResponse>(
        "/data/sources/test",
        { source_id: id },
      );
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      console.error("Failed to test data source", err);
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          id,
          name: id,
          status: "error",
          has_api_key: false,
          message: "Test call failed. Check console / backend.",
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );

  return (
    <CollapsibleSection
      storageKey="tp_datahub_sources_open"
      title="Data Sources & API Keys"
      defaultOpen
    >
      <p className="mb-2 text-xs text-slate-300">
        Status of upstream providers and whether env keys are present. Use{" "}
        <span className="font-semibold text-slate-100">Test source</span> to
        verify connectivity.
      </p>

      {loading && <Spinner label="Loading data sources…" />}

      {error && !loading && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {!loading && !error && sources.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          No data sources reported. Check backend configuration.
        </p>
      )}

      {!loading && !error && sources.length > 0 && (
        <div className="mt-2 space-y-2 text-xs">
          {sources.map((src) => {
            const test = testResults[src.id] ?? null;
            const isTesting = testingId === src.id;

            return (
              <div
                key={src.id}
                className="flex flex-col gap-1 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-100">
                      {src.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-300">
                      <span>
                        Env key:{" "}
                        <span className="font-semibold">
                          {src.has_api_key ? "present" : "missing"}
                        </span>
                      </span>
                      <span>
                        Status:{" "}
                        <span
                          className={
                            src.enabled
                              ? "font-semibold text-emerald-300"
                              : "font-semibold text-yellow-300"
                          }
                        >
                          {src.enabled ? "ENABLED" : "DISABLED"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTest(src.id)}
                    disabled={isTesting || !src.has_api_key}
                    className="shrink-0 rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isTesting ? "Testing…" : "Test source"}
                  </button>
                </div>

                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px]">
                  {src.last_success && (
                    <span className="text-slate-400">
                      Last success: {src.last_success}
                    </span>
                  )}
                  {src.last_error && (
                    <span className="text-red-300">
                      Last error: {src.last_error}
                    </span>
                  )}
                </div>

                {test && (
                  <div className="mt-1 text-[11px]">
                    <span
                      className={
                        test.status === "ok"
                          ? "font-semibold text-emerald-300"
                          : "font-semibold text-red-300"
                      }
                    >
                      {test.status.toUpperCase()}
                    </span>{" "}
                    <span className="text-slate-100">{test.message}</span>
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