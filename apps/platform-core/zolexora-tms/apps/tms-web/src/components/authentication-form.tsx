import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth as useZolexoraAuth } from '@zolexora/auth-client/react';
import { TurnstileWidget } from '@zolexora/auth-client/turnstile';
import { isValidZolexoraOrgId, isPublicWebmailDomain } from '@zolexora/auth-client';
import { usePublicSignIn } from '@zolexora/auth-client/public-sign-in';
import { Building2, Users, ShieldAlert, Loader2, Plus, ChevronRight } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { apiClient } from '../lib/api';
import { AUTH_SERVICE_PUBLIC_URL, TURNSTILE_SITE_KEY } from '../lib/runtime';
import { firebaseAuth } from '../lib/firebase';

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

type OwnerMode = 'flow' | 'reset' | 'reset_confirm';

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
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
 * - Owner / Commander: Track 1 account — Continue with Google, email or phone (Firebase verifies
 *   Google and the phone; the auth service issues the session), then picks one of their organisations
 *   (always listed, even if there is only one) or creates another.
 * - Staff & Drivers: Track 2 employee login with the ZX-ORG id.
 */
export function AuthenticationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, authMe, isLoading, signOut } = useAuth();
  const { orgSignIn } = useZolexoraAuth();

  const [tab, setTab] = useState<'owner' | 'staff'>('owner');
  const [mode, setMode] = useState<OwnerMode>('flow');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [turnstileKey, setTurnstileKey] = useState(0);
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

  const [creatingOrg, setCreatingOrg] = useState(false);
  const isOwner = Boolean(user && authMe && !authMe.zolexora_org_id);
  const myOrgs = useQuery({
    queryKey: ['my-organisations', authMe?.user_id],
    queryFn: () => apiClient<{ id: string; name: string; organisation_type?: string; is_commander: boolean }[]>('/api/v1/auth/my-organisations'),
    enabled: isOwner,
  });

  // Staff land in their organisation's workspace; owners choose below.
  useEffect(() => {
    if (!isLoading && user && authMe?.organisation_id && authMe.zolexora_org_id) navigate('/dashboard', { replace: true });
  }, [user, authMe, isLoading, navigate]);

  const openOrganisation = async (orgId: string) => {
    localStorage.setItem('zolexora_active_org_id', orgId);
    await queryClient.invalidateQueries();
    navigate('/dashboard', { replace: true });
  };

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

  const flow = usePublicSignIn({ firebaseAuth, product: 'zolexora-tms', authUrl: AUTH_SERVICE_PUBLIC_URL(), onSignedIn: () => void refreshAuth() });
  /** Turnstile tokens are single-use: get a fresh widget after every attempt that spent one. */
  const withTurnstile = async (action: (token: string) => Promise<boolean>) => {
    await action(turnstileToken);
    setTurnstileToken('');
    setTurnstileKey((k) => k + 1);
  };

  // Signed in: owners always choose (or create) an organisation; staff without a linked workspace wait
  if (user && !isLoading && authMe && (isOwner || !authMe.organisation_id)) {
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
    if (myOrgs.isLoading) return <Loader2 className="h-8 w-8 animate-spin text-slate-400" />;
    const orgs = myOrgs.data ?? [];
    if (orgs.length > 0 && !creatingOrg) {
      return (
        <Card title="Choose an organisation" subtitle="Organisations connected to your Zolexora account">
          <div className="space-y-2">
            {orgs.map((o) => (
              <button key={o.id} type="button" onClick={() => openOrganisation(o.id)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left hover:border-cyan-500">
                <span>
                  <span className="block text-sm font-semibold text-white">{o.name}</span>
                  <span className="block text-[11px] text-slate-400">{[o.organisation_type, o.is_commander ? 'Commander' : 'Member'].filter(Boolean).join(' · ')}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
          <button type="button" className={`${button} !bg-none border border-slate-700 bg-slate-900 hover:bg-slate-800`} onClick={() => setCreatingOrg(true)}>
            <Plus className="w-4 h-4" /> Create another organisation
          </button>
          <button type="button" className={`${link} w-full`} onClick={() => signOut()}>Sign out</button>
        </Card>
      );
    }
    return (
      <Card title={orgs.length ? 'Create another organisation' : 'Create your workspace'} subtitle="You will be the Commander of this organisation">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const created = await apiClient<{ organisation: { id: string } }>('/api/v1/onboarding', {
                method: 'POST',
                body: JSON.stringify({ name: orgName.trim(), organisation_type: orgType }),
              });
              setOrgName('');
              setCreatingOrg(false);
              await openOrganisation(created.organisation.id);
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
          <button className={button} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create organisation'}</button>
          {orgs.length > 0
            ? <button type="button" className={`${link} w-full`} onClick={() => setCreatingOrg(false)}>Back to my organisations</button>
            : <button type="button" className={`${link} w-full`} onClick={() => signOut()}>Sign out</button>}
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

  const busyIcon = <Loader2 className="w-4 h-4 animate-spin" />;
  const flowError = <ErrorBox message={flow.error?.message ?? null} />;
  const startOver = <button type="button" className={`${link} w-full`} onClick={() => { flow.restart(); setPassword(''); setCode(''); }}>Use a different account</button>;
  const submit = (action: () => void) => (e: React.FormEvent) => { e.preventDefault(); action(); };

  const flowScreens: Record<string, React.ReactNode> = {
    start: (
      <Card title="Sign in or create an account" subtitle="Zolexora TMS · Transport Management System">
        <div className="space-y-4">
          <button type="button" className={`${button} !bg-none bg-white text-slate-900 hover:bg-slate-100`} disabled={flow.busy || !turnstileToken}
            onClick={() => withTurnstile((t) => flow.continueWithGoogle(t))}>
            <GoogleIcon /> Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500"><span className="h-px flex-1 bg-slate-800" />or<span className="h-px flex-1 bg-slate-800" /></div>
          <div className="grid grid-cols-2 rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-xs">
            {(['email', 'phone'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={`py-2 rounded-lg font-medium ${method === m ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                {m === 'email' ? 'Email' : 'Phone'}
              </button>
            ))}
          </div>
          <form className="space-y-4" onSubmit={submit(() => withTurnstile((t) => (method === 'email' ? flow.continueWithEmail(email, t) : flow.continueWithPhone(phone, t))))}>
            {method === 'email'
              ? <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              : <Field label="Phone (with country code)" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />}
            <Turnstile key={turnstileKey} action="track1-public-continue" onToken={setTurnstileToken} />
            {flowError}
            {notice && <p className="text-xs text-emerald-400">{notice}</p>}
            <button className={button} disabled={flow.busy || !turnstileToken}>{flow.busy ? busyIcon : `Continue with ${method}`}</button>
          </form>
        </div>
      </Card>
    ),
    password: (
      <Card title="Enter your password" subtitle={flow.email ?? flow.phoneNumber ?? ''}>
        <form className="space-y-4" onSubmit={submit(() => withTurnstile((t) => flow.signInWithPassword(password, t)))}>
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Turnstile key={turnstileKey} action="track1-public-login" onToken={setTurnstileToken} />
          {flowError}
          <button className={button} disabled={flow.busy || !turnstileToken}>{flow.busy ? busyIcon : 'Sign in'}</button>
          <div className="flex justify-between">
            {startOver}
            {flow.email && <button type="button" className={link} onClick={() => { setEmail(flow.email!); go('reset'); }}>Forgot password?</button>}
          </div>
        </form>
      </Card>
    ),
    verify_email: (
      <Card title="Verify your email" subtitle={`Enter the code sent to ${flow.email}`}>
        <form className="space-y-4" onSubmit={submit(() => flow.verifyEmailCode(code).then((ok) => ok && setCode('')))}>
          <Field label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          {flowError}
          <button className={button} disabled={flow.busy}>{flow.busy ? busyIcon : 'Verify email'}</button>
          {startOver}
        </form>
      </Card>
    ),
    enter_email: (
      <Card title="Add your email" subtitle="We'll email you a verification code">
        <form className="space-y-4" onSubmit={submit(() => flow.sendEmailCode(email))}>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {flowError}
          <button className={button} disabled={flow.busy}>{flow.busy ? busyIcon : 'Send code'}</button>
          {startOver}
        </form>
      </Card>
    ),
    enter_phone: (
      <Card title={flow.mobileVerificationRequired ? 'Verify your mobile number' : 'Your mobile number'}
        subtitle={flow.mobileVerificationRequired ? "We'll text you a verification code" : 'Used to reach you about your account'}>
        <form className="space-y-4" onSubmit={submit(() => flow.sendPhoneCode(phone))}>
          <Field label="Phone (with country code)" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {flowError}
          <button className={button} disabled={flow.busy}>{flow.busy ? busyIcon : flow.mobileVerificationRequired ? 'Send code' : 'Continue'}</button>
          {startOver}
        </form>
      </Card>
    ),
    verify_phone: (
      <Card title="Enter the SMS code" subtitle={`Sent to ${flow.phoneNumber}`}>
        <form className="space-y-4" onSubmit={submit(() => flow.verifyPhoneCode(code).then((ok) => ok && setCode('')))}>
          <Field label="SMS code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          {flowError}
          <button className={button} disabled={flow.busy}>{flow.busy ? busyIcon : 'Verify number'}</button>
          {startOver}
        </form>
      </Card>
    ),
    profile: (
      <Card title="Finish your account" subtitle={[flow.email, flow.phoneNumber].filter(Boolean).join(' · ')}>
        <form className="space-y-4" onSubmit={submit(() => flow.completeProfile(displayName || flow.suggestedName || '', password))}>
          <Field label="Full name" autoComplete="name" value={displayName || flow.suggestedName || ''} onChange={(e) => setDisplayName(e.target.value)} />
          <Field label="Set a password (12+ characters)" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
          {flowError}
          <button className={button} disabled={flow.busy}>{flow.busy ? busyIcon : 'Create account'}</button>
        </form>
      </Card>
    ),
    done: <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto" />,
  };

  const ownerForms: Record<OwnerMode, React.ReactNode> = {
    flow: flowScreens[flow.step],
    reset: (
      <Card title="Reset password" subtitle="We'll email you a reset code">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await authPost('/api/v1/auth/public/reset-password', { email: email.trim(), turnstile_token: turnstileToken }); go('reset_confirm'); }); }}>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Turnstile action="track1-public-reset-password" onToken={setTurnstileToken} />
          <ErrorBox message={error} />
          <button className={button} disabled={busy || !turnstileToken}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send code'}</button>
          <button type="button" className={`${link} w-full`} onClick={() => go('flow')}>Back to sign in</button>
        </form>
      </Card>
    ),
    reset_confirm: (
      <Card title="Choose a new password" subtitle={`If ${email} has an account, a code was sent to it`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await authPost('/api/v1/auth/public/reset-password/confirm', { email: email.trim(), otp: code.trim(), new_password: password }); go('flow'); flow.restart(); setPassword(''); setCode(''); setNotice('Password changed. Sign in with your new password.'); }); }}>
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
      <div id="zx-recaptcha" />
    </div>
  );
}
