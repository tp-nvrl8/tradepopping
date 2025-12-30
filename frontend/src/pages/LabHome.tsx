import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { useConfig } from '../config/ConfigContext';

const LabHome: React.FC = () => {
  const { email, logout } = useAuth();
  const { config, loading } = useConfig();

  const envLabel = config?.environment ?? 'unknown';
  const versionLabel = config?.version ?? '0.0.0';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="border border-slate-700 rounded-xl px-8 py-6 shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-semibold mb-2 tracking-wide">
          {config?.app_name ?? 'TradePopping Lab Console'}
        </h1>

        <p className="text-sm text-slate-300 mb-4">
          Frontend is online and protected. You are logged in.
        </p>

        <div className="text-xs text-slate-400 mb-4 space-y-1">
          <div>
            status: <span className="text-emerald-400">OK</span>
          </div>
          <div>
            env: <span className="text-amber-300">{loading ? 'loading...' : envLabel}</span> ·
            version: <span className="text-sky-300">{loading ? '…' : versionLabel}</span>
          </div>
          <div>
            user: <span className="text-sky-400">{email}</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="text-xs border border-slate-600 rounded px-3 py-1 hover:bg-slate-800"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default LabHome;
