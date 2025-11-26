// frontend/src/api.ts
import axios from "axios";

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
export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: false, // bearer tokens, not cookies
});

// Auto-attach token to every request
apiClient.interceptors.request.use((config) => {
  try {
    const raw = window.localStorage.getItem("tp_auth");
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string | null };
      const token = parsed?.token ?? null;

      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>)["Authorization"] =
          `Bearer ${token}`;
      }
    }
  } catch {
    // If parsing fails, we just send the request without a token.
  }

  return config;
});

// --- Login wrapper using new apiClient ---
export async function loginRequest(email: string, code: string) {
  const res = await apiClient.post("/auth/login", { email, code });
  return res.data as { token: string; email: string };
}
export default apiClient;