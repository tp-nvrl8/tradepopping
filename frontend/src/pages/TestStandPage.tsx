import React from "react";

const TestStandPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-semibold mb-2">Test Stand</h1>
        <p className="text-sm text-slate-300 mb-4">
          This is where promising ideas and candidates will be paper traded and
          monitored before any real capital is used.
        </p>
        <p className="text-xs text-slate-400">
          Placeholder route at <code>/test-stand</code>.
        </p>
      </div>
    </div>
  );
};

export default TestStandPage;