// frontend/src/pages/DataHubPage.tsx

import React from "react";

import DataSourcesSection from "../components/datahub/DataSourcesSection";
import FmpUniverseSection from "../components/datahub/FmpUniverseSection";
import UniverseBrowserSection from "../components/datahub/UniverseBrowserSection";
import EodhdIngestSection from "../components/datahub/EodhdIngestSection";
import PolygonOhlcvSection from "../components/datahub/PolygonOhlcvSection";

const DataHubPage: React.FC = () => {
  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-slate-50">Data Hub</h1>
        <p className="mt-1 text-sm text-slate-300">
          Connect data sources, ingest universes, inspect stored symbols, and
          preview raw OHLCV windows for wiring up TradePopping’s data lake.
        </p>
      </header>

      <main className="space-y-4">
        <DataSourcesSection />
        <FmpUniverseSection />
        <UniverseBrowserSection />
        <EodhdIngestSection />
        <PolygonOhlcvSection />
      </main>
    </div>
  );
};

export default DataHubPage;