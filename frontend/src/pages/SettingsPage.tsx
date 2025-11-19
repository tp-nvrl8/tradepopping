import React, { useState } from "react";
import { useTheme, ThemeId } from "../config/ThemeContext";

type SettingsTab = "ui" | "data" | "security";

const themeOptions: { id: ThemeId; label: string; description: string }[] = [
  {
    id: "slate",
    label: "Slate",
    description: "Neutral ops baseline. Clean dark slate.",
  },
  {
    id: "trek-industrial",
    label: "Trek Industrial",
    description: "Warm engineering console. Bronze + amber accents.",
  },
  {
    id: "delta-flyer",
    label: "Delta Flyer",
    description: "Cool shuttle cockpit. Icy cyan + metal blue.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Reserved for your own palette (coming later).",
  },
];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("ui");
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="mb-4 border-b border-slate-800 pb-3">
          <h1 className="text-lg font-semibold tracking-tight">
            Settings
          </h1>
          <p className="text-xs text-slate-400">
            Tune TradePopping&apos;s environment: UI, data, and security.
          </p>
        </header>

        {/* Top-level settings tabs */}
        <div className="border-b border-slate-800 mb-4">
          <nav className="flex gap-4 text-xs">
            <button
              className={`pb-2 border-b-2 ${
                activeTab === "ui"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("ui")}
            >
              UI Settings
            </button>
            <button
              className={`pb-2 border-b-2 ${
                activeTab === "data"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("data")}
            >
              Data Providers
            </button>
            <button
              className={`pb-2 border-b-2 ${
                activeTab === "security"
                  ? "border-sky-500 text-sky-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("security")}
            >
              Security &amp; Access
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === "ui" && (
          <section className="space-y-4">
            {/* Theme selector */}
            <div className="border border-slate-800 rounded-lg bg-slate-900/40">
              <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Theme</h2>
                  <p className="text-[11px] text-slate-400">
                    Choose the console style for the Lab and other modules.
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  Active:{" "}
                  <span className="font-semibold text-slate-200">
                    {
                      themeOptions.find((t) => t.id === theme)?.label ??
                      theme
                    }
                  </span>
                </span>
              </header>

              {/* Theme tabs */}
              <div className="px-4 pt-3">
                <div className="flex flex-wrap gap-2 text-xs border-b border-slate-800 pb-2 mb-3">
                  {themeOptions.map((opt) => {
                    const isActive = opt.id === theme;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setTheme(opt.id)}
                        className={`px-3 py-1.5 rounded-t-md border-x border-t ${
                          isActive
                            ? "border-sky-500 bg-slate-900 text-sky-100"
                            : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Description + helper text */}
                <div className="text-[11px] text-slate-300 space-y-1 pb-4">
                  <p>
                    {
                      themeOptions.find((t) => t.id === theme)
                        ?.description
                    }
                  </p>
                  <p className="text-slate-500">
                    Theme changes apply instantly and persist per device
                    (stored in your browser). We&apos;ll add full custom
                    color editing under the Custom theme later.
                  </p>
                </div>
              </div>
            </div>

            {/* Placeholder for future UI options */}
            <div className="border border-slate-800 rounded-lg bg-slate-900/40 px-4 py-3">
              <h2 className="text-sm font-semibold mb-1">
                Layout &amp; Density (coming soon)
              </h2>
              <p className="text-[11px] text-slate-400">
                Here we&apos;ll let you adjust font size, spacing, and other
                cockpit layout details once more of the site is built.
              </p>
            </div>
          </section>
        )}

        {activeTab === "data" && (
          <section className="border border-slate-800 rounded-lg bg-slate-900/40 px-4 py-3 text-[11px] text-slate-300">
            <h2 className="text-sm font-semibold mb-1">
              Data Provider Settings (placeholder)
            </h2>
            <p className="text-slate-400">
              This is a stub for configuring Polygon, FMP, Fintel, Finnhub,
              and other providers. We&apos;ll wire this up when we hook
              TradePopping into live data.
            </p>
          </section>
        )}

        {activeTab === "security" && (
          <section className="border border-slate-800 rounded-lg bg-slate-900/40 px-4 py-3 text-[11px] text-slate-300">
            <h2 className="text-sm font-semibold mb-1">
              Security &amp; Access (placeholder)
            </h2>
            <p className="text-slate-400">
              This area will manage login, API key storage strategy, and
              future multi-device access rules. For now, access is still
              controlled via your SSO and backend config.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;