import { useState, useEffect } from "react";

const DEFAULT_SCOPE = "tp_token";

/**
 * Simple hook to read/write a token in localStorage.
 * We keep it generic so other scopes can reuse it later.
 */
export function useScopedTokens(scope: string = DEFAULT_SCOPE) {
  const [token, setTokenState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(scope);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(scope);
    if (stored !== token) {
      setTokenState(stored);
    }
  }, [scope]);

  const setToken = (value: string | null) => {
    if (typeof window === "undefined") return;
    if (value === null) {
      window.localStorage.removeItem(scope);
      setTokenState(null);
    } else {
      window.localStorage.setItem(scope, value);
      setTokenState(value);
    }
  };

  const clearToken = () => setToken(null);

  return { token, setToken, clearToken };
}