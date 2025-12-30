import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppConfig = {
  app_name: string;
  environment: string;
  version: string;
  backend_environment: string;
  auth: {
    mode: string;
    email: string | null;
  };
};

type ConfigContextType = {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) {
          throw new Error(`Config request failed: ${res.status}`);
        }
        const data = (await res.json()) as AppConfig;
        setConfig(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load config');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, error }}>{children}</ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextType => {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return ctx;
};
