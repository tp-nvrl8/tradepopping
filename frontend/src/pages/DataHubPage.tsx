import React from "react";

const DataHubPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-semibold mb-2">DataHub</h1>
        <p className="text-sm text-slate-300 mb-4">
          This will connect to your data sources and ingest monitor:
          /api/data/sources, /api/data/sources/test, and
          /api/data/ingest/status.
        </p>
        <p className="text-xs text-slate-400">
          Placeholder route at <code>/datahub</code>.
        </p>
      </div>
    </div>
  );
};

export default DataHubPage;