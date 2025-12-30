// frontend/src/components/datahub/DataSourcesSection.tsx

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api';
import CollapsibleSection from './CollapsibleSection';
import { DataSourceStatus, DataSourceTestResponse } from './types';

const DataSourcesSection: React.FC = () => {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, DataSourceTestResponse | null>>({});

  // Load list of known data sources from backend
  useEffect(() => {
    const loadSources = async () => {
      try {
        setSourcesLoading(true);
        setSourcesError(null);

        const data = await apiClient.get<DataSourceStatus[]>('/data/sources');
        setSources(data);
      } catch (err) {
        console.error('Failed to load data sources', err);
        setSourcesError('Could not load data sources. Check backend logs or /api/data/sources.');
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
      const data = await apiClient.post<DataSourceTestResponse>('/data/sources/test', {
        source_id: sourceId,
      });

      setTestResults((prev) => ({
        ...prev,
        [sourceId]: data,
      }));
    } catch (err) {
      console.error(`Failed to test source ${sourceId}`, err);
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: {
          id: sourceId,
          name: sourceId,
          status: 'error',
          has_api_key: false,
          message: 'Test call failed. Check console / backend logs.',
        },
      }));
    } finally {
      setTestingSourceId(null);
    }
  };

  const Spinner = ({ label }: { label?: string }) => (
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
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
        Backend-reported external data sources (Polygon, FMP, Finnhub, Fintel, EODHD). This section
        only checks whether API keys are configured and reachable from the backend process.
      </p>

      {sourcesLoading && <Spinner label="Loading data sources…" />}

      {sourcesError && (
        <div className="mt-2 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {sourcesError}
        </div>
      )}

      {!sourcesLoading && !sourcesError && sources.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          No data sources reported. Check backend configuration (DATA_SOURCES in app.main and your
          environment variables).
        </p>
      )}

      {!sourcesLoading && !sourcesError && sources.length > 0 && (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {sources.map((src) => {
            const test = testResults[src.id] ?? null;
            const isTesting = testingSourceId === src.id;

            return (
              <div
                key={src.id}
                className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-50">{src.name}</div>
                    <div className="text-[10px] text-slate-400">
                      id: <span className="font-mono">{src.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-[2px] text-[10px] font-semibold ${
                        src.enabled
                          ? 'bg-emerald-900/60 text-emerald-100'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {src.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <span className="text-[10px] text-slate-300">
                      Env key: {src.has_api_key ? 'present' : 'missing'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestSource(src.id)}
                    disabled={isTesting || !src.has_api_key}
                    className="rounded-md bg-sky-600 px-2 py-1 text-[10px] font-semibold text-slate-50 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isTesting ? 'Testing…' : 'Test source'}
                  </button>

                  {test && (
                    <span
                      className={`rounded-full px-2 py-[2px] text-[10px] font-semibold ${
                        test.status === 'ok'
                          ? 'bg-emerald-900/60 text-emerald-100'
                          : 'bg-red-900/60 text-red-100'
                      }`}
                    >
                      {test.status.toUpperCase()}
                    </span>
                  )}
                </div>

                {test && <p className="mt-1 text-[10px] text-slate-300">{test.message}</p>}

                {!test && src.last_error && (
                  <p className="mt-1 text-[10px] text-red-300">Last error: {src.last_error}</p>
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
