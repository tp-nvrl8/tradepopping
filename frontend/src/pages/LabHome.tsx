import React from "react";
import { useAuth } from "../auth/AuthContext";

const LabHome: React.FC = () => {
  const { email, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="border border-slate-700 rounded-xl px-8 py-6 shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-semibold mb-2 tracking-wide">
          TradePopping Lab Console
        </h1>
        <p className="text-sm text-slate-300 mb-4">
          Frontend is online and protected. You are logged in.
        </p>
        <div className="text-xs text-slate-400 mb-4 space-y-1">
          <div>
            status: <span className="text-emerald-400">OK</span> · env: dev
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