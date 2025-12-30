// frontend/src/api.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// ========================================================================
// API LOGGING
// ========================================================================

export interface ApiLogEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number | null;
  durationMs: number;
  requestBody?: any;
  responseBody?: any;
  error?: string;
}

type ApiLogListener = (entry: ApiLogEntry) => void;
let listeners: ApiLogListener[] = [];
let nextId = 1;

export function registerApiLogListener(fn: ApiLogListener) {
  listeners.push(fn);
}

export function unregisterApiLogListener(fn: ApiLogListener) {
  listeners = listeners.filter((l) => l !== fn);
}

function emit(entry: ApiLogEntry) {
  for (const fn of listeners) {
    try {
      fn(entry);
    } catch {
      // ignore listener errors
    }
  }
}

// ========================================================================
// AXIOS CLIENT
// ========================================================================

/**
 * Shared API client for calling the FastAPI backend.
 *
 * - baseURL `/api` means: apiClient.get("/data/sources")
 *   actually goes to `/api/data/sources`.
 * - Automatically attaches Bearer token from AuthContext's localStorage entry.
 *
 * AuthContext stores JSON under "tp_auth":
 *   { email: string; token: string }
 */
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: false, // bearer tokens, not cookies
});

// ----------------------------------------------------
// REQUEST INTERCEPTOR
// ----------------------------------------------------
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // ---- Auth token from AuthContext ("tp_auth") ----
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('tp_auth') : null;

      if (raw) {
        const parsed = JSON.parse(raw) as { token?: string | null };
        const token = parsed?.token ?? null;

        if (token) {
          config.headers = config.headers ?? {};
          (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch {
      // If parsing fails, just continue without a token
    }

    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const method = (config.method || 'GET').toUpperCase();
    const url = config.baseURL ? config.baseURL + (config.url || '') : config.url || '';

    const fullUrl =
      url +
      (config.params
        ? '?' +
          new URLSearchParams(
            Object.fromEntries(Object.entries(config.params).map(([k, v]) => [k, String(v)])),
          ).toString()
        : '');

    const entry: ApiLogEntry = {
      id: String(nextId++),
      timestamp: Date.now(),
      method,
      url: fullUrl,
      status: null,
      durationMs: 0,
      requestBody: config.data,
    };

    (config as any).__tpLogMeta = { start, entry };

    return config;
  },
  (error: AxiosError) => {
    const entry: ApiLogEntry = {
      id: String(nextId++),
      timestamp: Date.now(),
      method: 'ERROR',
      url: '',
      status: null,
      durationMs: 0,
      error: error.message,
    };

    emit(entry);
    return Promise.reject(error);
  },
);

// ----------------------------------------------------
// RESPONSE INTERCEPTOR
// ----------------------------------------------------
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const meta = (response.config as any).__tpLogMeta;

    if (meta) {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const entry: ApiLogEntry = {
        ...meta.entry,
        status: response.status,
        durationMs: end - meta.start,
        responseBody: response.data,
      };

      emit(entry);
    }

    return response;
  },
  (error: AxiosError) => {
    const cfg = error.config as any;
    const meta = cfg?.__tpLogMeta;

    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();

    let entry: ApiLogEntry;

    if (meta) {
      entry = {
        ...meta.entry,
        status: error.response?.status || null,
        durationMs: end - meta.start,
        error: error.message,
        responseBody: error.response?.data,
      };
    } else {
      entry = {
        id: String(nextId++),
        timestamp: Date.now(),
        method: cfg?.method || 'GET',
        url: cfg?.url || '',
        status: error.response?.status || null,
        durationMs: 0,
        error: error.message,
      };
    }

    emit(entry);
    return Promise.reject(error);
  },
);

// ========================================================================
// API WRAPPER (unwrapped data, keeps usage simple)
// ========================================================================

export const apiClient = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return api.get<T>(url, config).then((r) => r.data as T);
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return api.post<T>(url, data, config).then((r) => r.data as T);
  },

  // expose raw axios instance if ever needed
  raw: api,
};

// --- Login wrapper using apiClient ---
export async function loginRequest(email: string, code: string) {
  const data = await apiClient.post<{ token: string; email: string }>('/auth/login', {
    email,
    code,
  });
  return data;
}

// default export for legacy imports
export default apiClient;
