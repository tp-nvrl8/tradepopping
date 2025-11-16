import React from "react";

const SettingsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-slate-300 mb-4">
          This page will use /api/user/settings to control UI preferences like
          theme, default app, and experimental features.
        </p>
        <p className="text-xs text-slate-400">
          Placeholder route at <code>/settings</code>.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;