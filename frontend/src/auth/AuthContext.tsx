import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type AuthContextType = {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "tp_auth";

type StoredAuth = {
  email: string;
  token: string;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  // On first mount, try to restore auth from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredAuth;
        if (parsed.token && parsed.email) {
          setToken(parsed.token);
          setEmail(parsed.email);
        }
      }
    } catch {
      // ignore parse errors and start clean
    } finally {
      setBooting(false);
    }
  }, []);

  const login = (email: string, token: string) => {
    setToken(token);
    setEmail(email);

    const payload: StoredAuth = { email, token };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const logout = () => {
    setToken(null);
    setEmail(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const value: AuthContextType = {
    token,
    email,
    isAuthenticated: !!token,
    login,
    logout,
  };

  // While we are checking localStorage, avoid flashing the login page
  if (booting) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Booting session…</div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};