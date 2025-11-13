function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="border border-slate-700 rounded-xl px-8 py-6 shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-semibold mb-2 tracking-wide">
          TradePopping Lab Console
        </h1>
        <p className="text-sm text-slate-300 mb-4">
          Frontend is online. Next we’ll route this through the reverse proxy and
          hook it to the backend.
        </p>
        <div className="text-xs text-slate-400">
          status: <span className="text-emerald-400">OK</span> · env: dev
        </div>
      </div>
    </div>
  );
}

export default App;