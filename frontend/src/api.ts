// frontend/src/api.ts
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosInstance,
} from "axios";

/* -------------------------------------------------------------------------- */
/*  Auth-related helpers (your original code, unchanged in behavior)          */
/* -------------------------------------------------------------------------- */

export type LoginResponse = {
  token: string;
  email: string;
};

export async function loginRequest(
  email: string,
  code: string
): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code }),
  });

  if (!res.ok) {
    throw new Error("Invalid email or code");
  }

  return res.json();
}

// Example protected call we can use later
export async function getSecret(token: string) {
  const res = await fetch("/api/secret", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Not authorized");
  }

  return res.json();
}

/* -------------------------------------------------------------------------- */
/*  Shared Axios API client for the rest of the app                           */
/* -------------------------------------------------------------------------- */

// baseURL "/api" means calls like apiClient.get("/data/sources") hit /api/data/sources
export const apiClient: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: false, // we use bearer tokens in headers, not cookies
});

// Auto-attach Bearer token from localStorage (tp_token) to every request
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = localStorage.getItem("tp_token");

    if (token) {
      // make sure headers exists and then attach Authorization
      if (!config.headers) {
        config.headers = {} as any;
      }
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    return config;
  }
);

export default apiClient;