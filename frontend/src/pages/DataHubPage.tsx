// frontend/src/pages/DataHubPage.tsx
import React from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";

import DataSourcesSection from "../components/datahub/DataSourcesSection";
import FmpUniverseSection from "../components/datahub/FmpUniverseSection";
import UniverseBrowserSection from "../components/datahub/UniverseBrowserSection";
import EodhdIngestSection from "../components/datahub/EodhdIngestSection";
import PolygonOhlcvSection from "../components/datahub/PolygonOhlcvSection";

// iPad-friendly error surface (avoids blank white screen)
window.onerror = function (msg) {
  document.body.innerHTML =
    "<pre style='color:red;font-size:20px;padding:20px;white-space:pre-wrap'>" +
    msg +
    "</pre>";
};

const DataHubPage: React.FC = () => {
  const tokens = useUiScopedTokens(["global", "page:datahub"]);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"
      style={{
        background: tokens.surface,
        color: tokens.textPrimary,
      }}
    >
      {/* Header */}
      <header
        className="border-b border-slate-800 px-4 py-3 flex items-center justify-between"
        style={{ borderColor: tokens.border }}
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Data Hub</h1>
          <p className="text-xs text-slate-400">
            Connect data sources, test API keys, ingest universes, browse
            symbols, and inspect raw OHLCV windows.
          </p>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col overflow-y-auto items-center">
          <div className="w-full max-w-5xl px-4 py-4 space-y-4">
            <DataSourcesSection />
            <FmpUniverseSection />
            <UniverseBrowserSection />
            <EodhdIngestSection />
            <PolygonOhlcvSection />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DataHubPage;