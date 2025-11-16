import React from "react";

const CandidatesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-semibold mb-2">Candidates</h1>
        <p className="text-sm text-slate-300 mb-4">
          This page will show today&apos;s opportunity list across all ideas:
          symbols found by your Lab strategies, with filters and promotions to
          the test stand.
        </p>
        <p className="text-xs text-slate-400">
          Placeholder route at <code>/candidates</code>.
        </p>
      </div>
    </div>
  );
};

export default CandidatesPage;