// frontend/src/pages/LoginPage.tsx
import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { loginRequest } from '../api';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !code.trim()) {
      setError('Email and entry code are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginRequest(email.trim(), code.trim());
      // Save to AuthContext + localStorage
      login(res.email, res.token);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Login failed', err);
      setError('Invalid email or entry code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
        <div className="mb-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-50">TradePopping Lab</h1>
          <p className="text-xs text-slate-400 mt-1">
            Enter your lab email and entry code to access the workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-300">Email</label>
            <input
              type="email"
              autoComplete="email"
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-300">Entry code</label>
            <div className="flex items-center gap-1">
              <input
                type={showCode ? 'text' : 'password'}
                autoComplete="current-password"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="text-[10px] px-2 py-1 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {showCode ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Must match the <span className="font-mono">TP_ENTRY_CODE</span> in your backend
              environment.
            </p>
          </div>

          {error && (
            <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-700/70 rounded-md px-2 py-1">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-semibold"
          >
            {submitting ? 'Signing in…' : 'Sign in to Lab'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
