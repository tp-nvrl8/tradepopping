// frontend/src/layout/AppShell.tsx
import React, { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  { label: "Home", path: "/" },
  { label: "Lab", path: "/lab" },
  { label: "Candidates", path: "/candidates" },
  { label: "Test Stand", path: "/test-stand" },
  { label: "DataHub", path: "/datahub" },
  { label: "Settings", path: "/settings" },

  // ✅ New: Dev Tools entry
  { label: "Dev Tools", path: "/devtools" },
];

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top nav bar */}
      <div className="border-b border-slate-800 px-4 py-2 flex items-center justify-between bg-slate-950/95">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight">
            TradePopping Lab
          </span>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded-full border border-slate-700 bg-slate-900">
              v0.1 Lab Shell
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-2 py-1 rounded-md border text-xs ${
                  isActive
                    ? "border-sky-500 bg-sky-500/10 text-sky-100"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {email && (
            <span className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700">
              {email}
            </span>
          )}
          <button
            onClick={logout}
            className="px-2 py-1 rounded-md border border-rose-600 bg-rose-600/10 text-rose-200 hover:bg-rose-600/20"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default AppShell;