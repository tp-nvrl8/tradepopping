// frontend/src/pages/DevToolsPage.tsx
import React, { useEffect, useState } from 'react';
import { useUiScopedTokens } from '../config/useUiScopedTokens';
import { apiClient, registerApiLogListener, unregisterApiLogListener } from '../api';

// ---------------------------------------------------------------------------
// Types for config / health / data sources
// ---------------------------------------------------------------------------

interface AppConfig {
  environment: string;
  version: string;
}

interface HealthResponse {
  status: string;
  environment: string;
}

interface DataSourceStatus {
  id: string;
  name: string;
  enabled: boolean;
  has_api_key: boolean;
  last_success: string | null;
  last_error: string | null;
}

// Match ApiLogEntry from api.ts
interface ApiLogEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number | null;
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return String(ts);
  }
}

function truncateMiddle(value: string, max = 48) {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return value.slice(0, half) + '…' + value.slice(-half);
}

function safeJson(value: unknown, maxChars = 2000) {
  try {
    const s = JSON.stringify(value, null, 2) ?? '';
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars) + '\n…(truncated)…';
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------

const DevToolsPage: React.FC = () => {
  const tokens = useUiScopedTokens(['global', 'page:devtools']);

  // Core backend info
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // API logs
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Auth token viewer
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // -------------------------------------------------------------------------
  // Initial load: /config, /health, /data/sources
  // -------------------------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const [cfg, healthRes, srcs] = await Promise.all([
          apiClient.get<AppConfig>('/config'),
          apiClient.get<HealthResponse>('/health'),
          apiClient.get<DataSourceStatus[]>('/data/sources'),
        ]);

        setConfig(cfg);
        setHealth(healthRes);
        setSources(srcs);
      } catch (err) {
        console.error('DevTools load failed', err);
        setLoadError('Failed to load dev tools info. Check backend logs.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // -------------------------------------------------------------------------
  // Subscribe to API log stream
  // -------------------------------------------------------------------------
  useEffect(() => {
    const listener = (entry: ApiLogEntry) => {
      setLogs((prev) => {
        const next = [entry, ...prev];
        // keep most recent 200
        return next.slice(0, 200);
      });
    };

    registerApiLogListener(listener);
    return () => {
      unregisterApiLogListener(listener);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Read auth token from localStorage
  // -------------------------------------------------------------------------
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('tp_auth');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        email?: string | null;
        token?: string | null;
      };
      setAuthEmail(parsed.email ?? null);
      setAuthToken(parsed.token ?? null);
    } catch (err) {
      console.warn('Unable to parse tp_auth from localStorage', err);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Token copy handler
  // -------------------------------------------------------------------------
  const handleCopyToken = async () => {
    if (!authToken) return;
    try {
      await navigator.clipboard.writeText(authToken);
      setCopyStatus('copied');
    } catch (err) {
      console.error('Failed to copy token', err);
      setCopyStatus('error');
    } finally {
      setTimeout(() => setCopyStatus('idle'), 1500);
    }
  };

  const tokenPreview = authToken ? truncateMiddle(authToken, 48) : '';

  const isProd = config?.environment === 'production';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      className="min-h-screen flex flex-col text-slate-100"
      style={{
        background: tokens.surface,
        color: tokens.textPrimary,
      }}
    >
      <header
        className="border-b border-slate-800 px-4 py-3 flex items-center justify-between"
        style={{ borderColor: tokens.border }}
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Developer Tools</h1>
          <p className="text-xs text-slate-400">
            App config, health, data sources, live API log, and auth token inspector.
          </p>
        </div>
        {config && (
          <div className="text-[11px] text-slate-400 flex gap-3">
            <span className="px-2 py-1 rounded-md border border-slate-700 bg-slate-900">
              env: <span className="font-mono text-slate-200">{config.environment}</span>
            </span>
            <span className="px-2 py-1 rounded-md border border-slate-700 bg-slate-900">
              version: <span className="font-mono text-slate-200">{config.version}</span>
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-5xl mx-auto space-y-4 text-sm">
          {loading && <div className="text-[12px] text-slate-400">Loading…</div>}
          {loadError && <div className="text-[12px] text-amber-400">{loadError}</div>}

          {/* App Config */}
          <section className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <h2 className="text-sm font-semibold mb-1">App Config</h2>
            {config ? (
              <>
                <div className="text-[12px] text-slate-300 mb-1">
                  <div>
                    <span className="text-slate-400">Environment:</span>{' '}
                    <span className="font-mono">{config.environment}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Version:</span>{' '}
                    <span className="font-mono">{config.version}</span>
                  </div>
                </div>
                <pre className="mt-2 text-[11px] bg-slate-900/80 border border-slate-800 rounded-md p-2 overflow-x-auto">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </>
            ) : (
              <div className="text-[11px] text-slate-500">No config loaded yet.</div>
            )}
          </section>

          {/* Health */}
          <section className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <h2 className="text-sm font-semibold mb-1">Health Check</h2>
            {health ? (
              <>
                <div className="text-[12px] text-slate-300 mb-1">
                  <div>
                    <span className="text-slate-400">Status:</span>{' '}
                    <span
                      className={
                        health.status === 'ok'
                          ? 'text-emerald-300 font-semibold'
                          : 'text-rose-300 font-semibold'
                      }
                    >
                      {health.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Environment:</span>{' '}
                    <span className="font-mono">{health.environment}</span>
                  </div>
                </div>
                <pre className="mt-2 text-[11px] bg-slate-900/80 border border-slate-800 rounded-md p-2 overflow-x-auto">
                  {JSON.stringify(health, null, 2)}
                </pre>
              </>
            ) : (
              <div className="text-[11px] text-slate-500">No health response loaded yet.</div>
            )}
          </section>

          {/* Data Sources */}
          <section className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <h2 className="text-sm font-semibold mb-1">Data Sources</h2>
            {sources.length === 0 ? (
              <div className="text-[11px] text-slate-500">No data sources reported.</div>
            ) : (
              <>
                <ul className="space-y-1 text-[12px]">
                  {sources.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 border-b border-slate-900/70 pb-1 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">
                          {s.name} <span className="font-mono text-slate-500">({s.id})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Env key:{' '}
                          <span className="font-mono">{s.has_api_key ? 'present' : 'missing'}</span>
                          {' • '}
                          Enabled: <span className="font-mono">{s.enabled ? 'yes' : 'no'}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 text-right">
                        <div>
                          last ok: <span className="font-mono">{s.last_success ?? '—'}</span>
                        </div>
                        <div>
                          last error: <span className="font-mono">{s.last_error ?? '—'}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <pre className="mt-2 text-[11px] bg-slate-900/80 border border-slate-800 rounded-md p-2 overflow-x-auto">
                  {JSON.stringify(sources, null, 2)}
                </pre>
              </>
            )}
          </section>

          {/* Auth token viewer (dev-only) */}
          {!isProd && (
            <section className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <h2 className="text-sm font-semibold mb-1">Auth Token</h2>
              {authToken ? (
                <>
                  {authEmail && (
                    <div className="text-[12px] text-slate-300 mb-1">
                      <span className="text-slate-400">Email:</span>{' '}
                      <span className="font-mono">{authEmail}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 text-[11px]">
                    <div className="font-mono break-all bg-slate-900/80 border border-slate-800 rounded-md px-2 py-1">
                      {tokenVisible ? authToken : tokenPreview}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTokenVisible((v) => !v)}
                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px]"
                      >
                        {tokenVisible ? 'Hide full token' : 'Show full token'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyToken}
                        className="px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-[11px]"
                      >
                        Copy token
                      </button>
                      {copyStatus === 'copied' && (
                        <span className="text-emerald-300 self-center text-[11px]">Copied ✓</span>
                      )}
                      {copyStatus === 'error' && (
                        <span className="text-rose-300 self-center text-[11px]">Copy failed</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-slate-500">
                  No token found in <span className="font-mono">tp_auth</span> localStorage key.
                </div>
              )}
            </section>
          )}

          {/* API Log Viewer */}
          <section className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <h2 className="text-sm font-semibold mb-1">
              Live API Request Log (latest {logs.length} {logs.length === 1 ? 'entry' : 'entries'})
            </h2>
            {logs.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                No requests logged yet. Interact with the app to see traffic.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-md">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-900/80 sticky top-0 z-10">
                    <tr className="text-left text-slate-300">
                      <th className="px-2 py-1 border-b border-slate-800">Time</th>
                      <th className="px-2 py-1 border-b border-slate-800">Method</th>
                      <th className="px-2 py-1 border-b border-slate-800">URL</th>
                      <th className="px-2 py-1 border-b border-slate-800 text-right">Status</th>
                      <th className="px-2 py-1 border-b border-slate-800 text-right">ms</th>
                      <th className="px-2 py-1 border-b border-slate-800">Error</th>
                      <th className="px-2 py-1 border-b border-slate-800">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const statusClass =
                        log.status && log.status >= 200 && log.status < 300
                          ? 'text-emerald-300'
                          : log.status
                            ? 'text-rose-300'
                            : 'text-slate-400';

                      return (
                        <React.Fragment key={log.id}>
                          <tr className="odd:bg-slate-950 even:bg-slate-900/40">
                            <td className="px-2 py-1 border-b border-slate-900/40 font-mono">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 font-mono">
                              {log.method}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 font-mono break-all">
                              {log.url}
                            </td>
                            <td
                              className={`px-2 py-1 border-b border-slate-900/40 text-right font-mono ${statusClass}`}
                            >
                              {log.status ?? '—'}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-right font-mono">
                              {Math.round(log.durationMs)}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40 text-rose-300">
                              {log.error ? truncateMiddle(log.error, 32) : ''}
                            </td>
                            <td className="px-2 py-1 border-b border-slate-900/40">
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700"
                              >
                                {isExpanded ? 'Hide' : 'View'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-950">
                              <td colSpan={7} className="px-2 py-2 border-b border-slate-900/60">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div>
                                    <div className="text-[10px] text-slate-400 mb-1">
                                      Request body
                                    </div>
                                    <pre className="text-[10px] bg-slate-900 border border-slate-800 rounded-md p-2 overflow-x-auto">
                                      {log.requestBody ? safeJson(log.requestBody) : '∅'}
                                    </pre>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-slate-400 mb-1">
                                      Response body
                                    </div>
                                    <pre className="text-[10px] bg-slate-900 border border-slate-800 rounded-md p-2 overflow-x-auto">
                                      {log.responseBody ? safeJson(log.responseBody) : '∅'}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default DevToolsPage;
