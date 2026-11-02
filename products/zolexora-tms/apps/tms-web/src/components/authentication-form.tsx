import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth as useZolexoraAuth } from '@zolexora/auth-client/react';
import { TurnstileWidget } from '@zolexora/auth-client/turnstile';
import { isValidZolexoraOrgId, isPublicWebmailDomain } from '@zolexora/auth-client';
import { Building2, Users, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { apiClient } from '../lib/api';
import { AUTH_SERVICE_PUBLIC_URL, TURNSTILE_SITE_KEY } from '../lib/runtime';

const ORGANISATION_TYPES = [
  'Sole Proprietorship / Proprietor', 'Partnership Firm', 'Limited Liability Partnership (LLP)',
  'Private Limited Company', 'Public Limited Company', 'One Person Company (OPC)', 'Limited Company',
  'Section 8 Company', 'Non-Profit Organisation', 'Trust', 'Public Trust', 'Private Trust',
  'Charitable Trust', 'Society', 'Co-operative Society', 'Hindu Undivided Family (HUF)',
  'Government Organisation', 'Government Department', 'Public Sector Undertaking (PSU)',
  'Municipal Corporation', 'Local Government Body', 'Educational Institution', 'University', 'School',
  'College', 'Hospital', 'Healthcare Organisation', 'NGO', 'Religious Organisation', 'Foundation',
  'Family Office', 'Startup', 'Freelancer / Individual', 'Self Employed', 'Other',
];

type OwnerMode = 'signin' | 'signup' | 'verify' | 'reset' | 'reset_confirm';

const input =
  'w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500';
const button =
  'w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-2.5 px-4 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed';
const link = 'text-xs text-cyan-400 hover:text-cyan-300';

/** POSTs to a Zolexora auth-service public endpoint and returns the JSON body (throws its message). */
async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${AUTH_SERVICE_PUBLIC_URL()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || data.error?.message || 'Request failed');
  }
  return data;
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-xs font-medium text-slate-300">
      {label}
      <input className={`${input} mt-1.5`} required {...props} />
    </label>
  );
}

function Turnstile({ action, onToken }: { action: string; onToken: (t: string) => void }) {
  return (
    <div className="flex justify-center">
      <TurnstileWidget siteKey={TURNSTILE_SITE_KEY()} action={action} theme="dark" onVerify={onToken} onExpire={() => onToken('')} />
    </div>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 flex items-start gap-2">
      <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-7 shadow-2xl backdrop-blur space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Zolexora TMS sign-in, all through the Zolexora auth service:
 * - Owner / Commander: Track 1 account (sign in, sign up with email code, password reset),
 *   then a TMS workspace is created on first sign-in.
 * - Staff & Drivers: Track 2 employee login with the ZX-ORG id.
 */
export function AuthenticationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, authMe, isLoading, signOut } = useAuth();
  const { signIn, orgSignIn } = useZolexoraAuth();

  const [tab, setTab] = useState<'owner' | 'staff'>('owner');
  const [mode, setMode] = useState<OwnerMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [orgId, setOrgId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState(ORGANISATION_TYPES[0]);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user && authMe?.organisation_id) navigate('/dashboard', { replace: true });
  }, [user, authMe, isLoading, navigate]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const go = (next: OwnerMode) => {
    setMode(next);
    setError(null);
    setTurnstileToken('');
  };

  const refreshAuth = () => queryClient.invalidateQueries({ queryKey: ['auth-me'] });

  // Signed in but no workspace yet
  if (user && !isLoading && authMe && !authMe.organisation_id) {
    if (authMe.zolexora_org_id) {
      return (
        <Card title="Workspace not linked" subtitle={`Organisation ${authMe.zolexora_org_id}`}>
          <p className="text-sm text-slate-300">
            Your organisation is not connected to a TMS workspace yet, or your access is suspended. Ask your
            administrator to link it.
          </p>
          <button className={button} onClick={() => signOut()}>Sign out</button>
        </Card>
      );
    }
    return (
      <Card title="Create your workspace" subtitle="You will be the Commander of this organisation">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await apiClient('/api/v1/onboarding', {
                method: 'POST',
                body: JSON.stringify({ name: orgName.trim(), organisation_type: orgType }),
              });
              await refreshAuth();
            });
          }}
        >
          <Field label="Organisation name" minLength={2} maxLength={160} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <label className="block text-xs font-medium text-slate-300">
            Organisation type
            <select className={`${input} mt-1.5`} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
              {ORGANISATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <ErrorBox message={error} />
          <button className={button} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create workspace'}</button>
          <button type="button" className={`${link} w-full`} onClick={() => signOut()}>Sign out</button>
        </form>
      </Card>
    );
  }

  if (user && isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-slate-400" />;
  }

  const tabs = (
    <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-sm">
      {([['owner', 'Owner / Commander', Building2], ['staff', 'Staff & Drivers', Users]] as const).map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          onClick={() => { setTab(key); setError(null); setTurnstileToken(''); }}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium ${tab === key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Icon className="w-4 h-4" /> {label}
        </button>
      ))}
    </div>
  );

  if (tab === 'staff') {
    const webmail = staffId.includes('@') && isPublicWebmailDomain(staffId);
    return (
      <div className="w-full max-w-md mx-auto">
        {tabs}
        <Card title="Staff & Driver Login" subtitle="Sign in to your organisation's workspace">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const cleanOrgId = orgId.trim().toUpperCase();
              if (!isValidZolexoraOrgId(cleanOrgId)) {
                setError('Invalid Organisation ID. Expected ZX-ORG-XXXX-XXXX-XXXX');
                return;
              }
              run(async () => {
                await orgSignIn({ product: 'zolexora-tms', org_id: cleanOrgId, user_id_or_email: staffId.trim(), password, turnstileToken });
                localStorage.removeItem('zolexora_active_org_id'); // the backend picks the linked workspace
                await refreshAuth();
              });
            }}
          >
            <Field label="Organisation ID" className={`${input} mt-1.5 font-mono`} value={orgId} onChange={(e) => setOrgId(e.target.value.toUpperCase())} />
            <Field label="Corporate email or user ID" autoComplete="username" value={staffId} onChange={(e) => setStaffId(e.target.value)} />
            {webmail && <p className="text-[11px] text-amber-400">Staff accounts use a corporate email or employee ID.</p>}
            <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Turnstile action="track2-employee-login" onToken={setTurnstileToken} />
            <ErrorBox message={error} />
            <button className={button} disabled={busy || webmail || !turnstileToken}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in as staff'}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const ownerForms: Record<OwnerMode, React.ReactNode> = {
    signin: (
      <Card title="Sign in" subtitle="Zolexora TMS · Transport Management System">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await signIn({ email_or_phone: email.trim(), password, turnstileToken, product: 'zolexora-tms' }); await refreshAuth(); }); }}>
          <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Turnstile action="track1-public-login" onToken={setTurnstileToken} />
          <ErrorBox message={error} />
          {notice && <p className="text-xs text-emerald-400">{notice}</p>}
          <button className={button} disabled={busy || !turnstileToken}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}</button>
          <div className="flex justify-between">
            <button type="button" className={link} onClick={() => go('signup')}>Create an account</button>
            <button type="button" className={link} onClick={() => go('reset')}>Forgot password?</button>
          </div>
        </form>
      </Card>
    ),
    signup: (
      <Card title="Create your Zolexora account" subtitle="We'll email you a verification code">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await authPost('/api/v1/auth/public/signup', { email: email.trim(), password, phone_number: phone.trim(), display_name: displayName.trim(), turnstile_token: turnstileToken }); go('verify'); }); }}>
          <Field label="Full name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field label="Password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Turnstile action="track1-public-signup" onToken={setTurnstileToken} />
          <ErrorBox message={error} />
          <button className={button} disabled={busy || !turnstileToken}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}</button>
          <button type="button" className={`${link} w-full`} onClick={() => go('signin')}>Already have an account? Sign in</button>
        </form>
      </Card>
    ),
    verify: (
      <Card title="Verify your email" subtitle={`Enter the code sent to ${email}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await authPost('/api/v1/auth/public/verify-email-otp', { email: email.trim(), otp: code.trim() }); go('signin'); setNotice('Email verified. Sign in to continue.'); }); }}>
          <Field label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <ErrorBox message={error} />
          <button className={button} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}</button>
        </form>
      </Card>
    ),
    reset: (
      <Card title="Reset password" subtitle="We'll email you a reset code">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await authPost('/api/v1/auth/public/reset-password', { email: email.trim(), turnstile_token: turnstileToken }); go('reset_confirm'); }); }}>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Turnstile action="track1-public-reset-password" onToken={setTurnstileToken} />
          <ErrorBox message={error} />
          <button className={button} disabled={busy || !turnstileToken}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send code'}</button>
          <button type="button" className={`${link} w-full`} onClick={() => go('signin')}>Back to sign in</button>
        </form>
      </Card>
    ),
    reset_confirm: (
      <Card title="Choose a new password" subtitle={`If ${email} has an account, a code was sent to it`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await authPost('/api/v1/auth/public/reset-password/confirm', { email: email.trim(), otp: code.trim(), new_password: password }); go('signin'); setNotice('Password changed. Sign in with your new password.'); }); }}>
          <Field label="Reset code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorBox message={error} />
          <button className={button} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change password'}</button>
        </form>
      </Card>
    ),
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {tabs}
      {ownerForms[mode]}
    </div>
  );
}
