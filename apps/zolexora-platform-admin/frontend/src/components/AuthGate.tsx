'use client';

import React, { FormEvent, useState } from 'react';
import { ZolexoraAuthProvider, useAuth } from '@zolexora/auth-client/react';
import { TurnstileWidget, type TurnstileWidgetProps } from '@zolexora/auth-client/turnstile';
import AppShell from './AppShell';

// auth-client ships React 19 typings; this app is on React 18 (same runtime API for this component).
const Turnstile = TurnstileWidget as unknown as React.ComponentType<TurnstileWidgetProps>;

interface AuthGateProps {
  authUrl: string;
  turnstileSiteKey: string;
  children: React.ReactNode;
}

/** Signs platform admins in through the Zolexora auth service (Track 3) before showing the console. */
export default function AuthGate({ authUrl, turnstileSiteKey, children }: AuthGateProps) {
  if (!authUrl || !turnstileSiteKey) {
    return (
      <Centered>
        <p className="text-sm text-rose-300">
          Sign-in is not configured: set AUTH_SERVICE_PUBLIC_URL and TURNSTILE_SITE_KEY in Infisical.
        </p>
      </Centered>
    );
  }
  return (
    <ZolexoraAuthProvider authUrl={authUrl} product="zolexora-platform-admin">
      <Gate turnstileSiteKey={turnstileSiteKey}>{children}</Gate>
    </ZolexoraAuthProvider>
  );
}

function Gate({ turnstileSiteKey, children }: { turnstileSiteKey: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Centered><p className="text-sm text-slate-400">Checking session…</p></Centered>;
  if (!user?.is_platform_admin) return <LoginForm turnstileSiteKey={turnstileSiteKey} />;
  return <AppShell>{children}</AppShell>;
}

function LoginForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const { adminSignIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminSignIn({ email, password, turnstileToken });
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none';

  return (
    <Centered>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-8">
        <div>
          <h1 className="text-lg font-bold text-white">Zolexora Platform Admin</h1>
          <p className="text-xs text-slate-400">Platform administrators only.</p>
        </div>
        <label className="block text-xs text-slate-400">
          Email or username
          <input className={`${input} mt-1`} autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-xs text-slate-400">
          Password
          <input className={`${input} mt-1`} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Turnstile siteKey={turnstileSiteKey} action="track3-admin-login" theme="dark" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <button
          type="submit"
          disabled={busy || !turnstileToken}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;
}
