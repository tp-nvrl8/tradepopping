import React from "react";

const LabPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-semibold mb-2">Strategy Lab</h1>
        <p className="text-sm text-slate-300 mb-4">
          This will become the main Lab cockpit: ideas list on the left, idea
          builder in the center, scan/backtest panel at the bottom, and notes/AI
          on the right.
        </p>
        <p className="text-xs text-slate-400">
          For now this is just a placeholder route at <code>/lab</code>.
        </p>
      </div>
    </div>
  );
};

export default LabPage;