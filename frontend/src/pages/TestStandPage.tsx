import React from "react";
import TestStandPanel from "../teststand/TestStandPanel";

const TestStandPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Test Stand</h1>
            <p className="text-sm text-slate-300">
              Paper trading cockpit for finalists before they graduate to live capital.
            </p>
          </div>
          <div className="text-[11px] text-slate-500 max-w-sm text-right">
            Coming soon: live broker paper accounts, alerting, and longer-term hold periods.
          </div>
        </div>

        <TestStandPanel />
      </div>
    </div>
  );
};

export default TestStandPage;
