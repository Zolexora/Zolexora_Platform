import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth as useZolexoraAuth } from '@zolexora/auth-client/react';
import { TurnstileWidget } from '@zolexora/auth-client/turnstile';
import { usePublicSignIn } from '@zolexora/auth-client/public-sign-in';
import {
  AuthServiceError,
  createBusiness,
  employeeSignIn,
  employeeVerifyMfa,
  listBusinesses,
  type Business,
} from '@zolexora/auth-client/business-session';
import { Building2, Users, ShieldAlert, Loader2, Plus, ChevronRight } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { firebaseAuth } from '../../lib/firebase';
import { AUTH_SERVICE_PUBLIC_URL, IMS_PRODUCT, TURNSTILE_SITE_KEY } from '../../lib/runtime';

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#0c0e18] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
const buttonCls =
  'w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 px-4 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed';
const linkCls = 'text-xs text-indigo-400 hover:text-indigo-300';
const spinner = <Loader2 className="w-4 h-4 animate-spin" />;

async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${AUTH_SERVICE_PUBLIC_URL()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Request failed');
  return data;
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-xs font-medium text-slate-300">
      {label}
      <input className={`${inputCls} mt-1.5`} required {...props} />
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

function ErrorBox({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2">
      <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0e18]/90 p-7 shadow-2xl space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

/** Runs an async action with busy + error state. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

/** After an owner signs in: pick a business (always listed), create one with its PAN, or confirm with an authenticator code. */
function BusinessPicker() {
  const zx = useZolexoraAuth();
  const { enterBusiness, signOut } = useAuth();
  const { busy, error, setError, run } = useAction();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [mfaFor, setMfaFor] = useState<Business | null>(null);
  const [code, setCode] = useState('');
  const [pan, setPan] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [registered, setRegistered] = useState<'' | 'yes' | 'no'>('');

  useEffect(() => {
    void run(async () => {
      const token = await zx.getToken();
      if (!token) throw new Error('Your sign-in expired. Sign in again.');
      const list = await listBusinesses(AUTH_SERVICE_PUBLIC_URL(), token);
      setBusinesses(list);
      setCreating(list.length === 0);
    });
  }, [zx, run]);

  const open = (b: Business, mfaCode?: string) =>
    run(async () => {
      try {
        await enterBusiness(b.zolexora_org_id, mfaCode);
      } catch (err) {
        if (err instanceof AuthServiceError && err.code === 'AUTH_MFA_REQUIRED') {
          setMfaFor(b);
          return;
        }
        throw err;
      }
    });

  if (!businesses) {
    return (
      <Card title="Your businesses" subtitle="Loading…">
        <ErrorBox message={error} />
        {error ? <button className={buttonCls} onClick={() => signOut()}>Sign out</button> : <div className="flex justify-center">{spinner}</div>}
      </Card>
    );
  }

  if (mfaFor) {
    return (
      <Card title="Confirm it's you" subtitle={`Enter the code from your authenticator app for ${mfaFor.name}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void open(mfaFor, code.trim()); }}>
          <Field label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <ErrorBox message={error} />
          <button className={buttonCls} disabled={busy}>{busy ? spinner : 'Continue'}</button>
          <button type="button" className={`${linkCls} w-full`} onClick={() => { setMfaFor(null); setCode(''); setError(null); }}>Back</button>
        </form>
      </Card>
    );
  }

  if (!creating) {
    return (
      <Card title="Choose a business" subtitle="Businesses on your Zolexora account">
        <div className="space-y-2">
          {businesses.map((b) => (
            <button key={b.zolexora_org_id} type="button" disabled={busy} onClick={() => void open(b)}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#07080e] px-4 py-3 text-left hover:border-indigo-500 disabled:opacity-50">
              <span>
                <span className="block text-sm font-semibold text-white">{b.name}</span>
                <span className="block text-[11px] text-slate-400">
                  {[b.zolexora_org_id, b.role_name || b.role, b.status !== 'active' ? b.status : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          ))}
        </div>
        <ErrorBox message={error} />
        <button type="button" className={`${buttonCls} !bg-transparent border border-white/10 hover:!bg-white/5`} onClick={() => { setCreating(true); setError(null); }}>
          <Plus className="w-4 h-4" /> Create a business
        </button>
        <button type="button" className={`${linkCls} w-full`} onClick={() => signOut()}>Sign out</button>
      </Card>
    );
  }

  const panUpper = pan.trim().toUpperCase();
  const personalPan = panUpper[3] === 'P';
  const firmPan = panUpper[3] === 'F';
  return (
    <Card title="Create a business" subtitle="You will be its owner. The PAN is checked and kept encrypted.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const token = await zx.getToken();
            if (!token) throw new Error('Your sign-in expired. Sign in again.');
            const created = await createBusiness(AUTH_SERVICE_PUBLIC_URL(), token, {
              pan: panUpper,
              legal_name: legalName.trim(),
              trade_name: tradeName.trim() || null,
              ...(personalPan ? { has_business_registration: registered === 'yes' } : {}),
              ...(firmPan ? { has_llpin: registered === 'yes' } : {}),
            });
            await enterBusiness(created.zolexora_org_id);
          });
        }}
      >
        <Field label="PAN" className={`${inputCls} mt-1.5 font-mono uppercase`} maxLength={10} placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value)} />
        <Field label="Legal name (as on PAN)" minLength={2} maxLength={200} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        <label className="block text-xs font-medium text-slate-300">
          Trade name (optional)
          <input className={`${inputCls} mt-1.5`} minLength={2} maxLength={200} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        </label>
        {(personalPan || firmPan) && (
          <label className="block text-xs font-medium text-slate-300">
            {personalPan ? 'Is the business registered (e.g. GST, Udyam, shop licence)?' : 'Is this firm an LLP (has an LLPIN)?'}
            <select className={`${inputCls} mt-1.5`} required value={registered} onChange={(e) => setRegistered(e.target.value as 'yes' | 'no')}>
              <option value="" disabled>Choose</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        )}
        <ErrorBox message={error} />
        <button className={buttonCls} disabled={busy}>{busy ? spinner : 'Create business'}</button>
        {businesses.length > 0
          ? <button type="button" className={`${linkCls} w-full`} onClick={() => { setCreating(false); setError(null); }}>Back to my businesses</button>
          : <button type="button" className={`${linkCls} w-full`} onClick={() => signOut()}>Sign out</button>}
      </form>
    </Card>
  );
}

/** Track 2: staff sign in with their work email or user ID. */
function StaffSignIn() {
  const { adoptSession } = useAuth();
  const { busy, error, run } = useAction();
  const [orgId, setOrgId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [choice, setChoice] = useState<{ ticket: string; businesses: { zolexora_org_id: string; name: string }[] } | null>(null);
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const signIn = (params: Parameters<typeof employeeSignIn>[1]) =>
    run(async () => {
      try {
        const r = await employeeSignIn(AUTH_SERVICE_PUBLIC_URL(), params);
        if (r.status === 'choose_business') setChoice({ ticket: r.login_ticket, businesses: r.businesses });
        else if (r.status === 'mfa_required') { setChoice(null); setMfaTicket(r.mfa_ticket); }
        else await adoptSession();
      } finally {
        // Turnstile tokens are single-use.
        setTurnstileToken('');
        setTurnstileKey((k) => k + 1);
      }
    });

  if (mfaTicket) {
    return (
      <Card title="Confirm it's you" subtitle="Enter the code from your authenticator app">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await employeeVerifyMfa(AUTH_SERVICE_PUBLIC_URL(), mfaTicket, code.trim()); await adoptSession(); }); }}>
          <Field label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <ErrorBox message={error} />
          <button className={buttonCls} disabled={busy}>{busy ? spinner : 'Continue'}</button>
          <button type="button" className={`${linkCls} w-full`} onClick={() => { setMfaTicket(null); setCode(''); }}>Start again</button>
        </form>
      </Card>
    );
  }

  if (choice) {
    return (
      <Card title="Choose a business" subtitle="Your login works for more than one business">
        <div className="space-y-2">
          {choice.businesses.map((b) => (
            <button key={b.zolexora_org_id} type="button" disabled={busy}
              onClick={() => void signIn({ product: IMS_PRODUCT, loginTicket: choice.ticket, orgId: b.zolexora_org_id })}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#07080e] px-4 py-3 text-left hover:border-indigo-500 disabled:opacity-50">
              <span>
                <span className="block text-sm font-semibold text-white">{b.name}</span>
                <span className="block text-[11px] text-slate-400 font-mono">{b.zolexora_org_id}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          ))}
        </div>
        <ErrorBox message={error} />
        <button type="button" className={`${linkCls} w-full`} onClick={() => setChoice(null)}>Start again</button>
      </Card>
    );
  }

  return (
    <Card title="Staff sign in" subtitle="Use the login your business gave you">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn({ product: IMS_PRODUCT, orgId: orgId.trim().toUpperCase() || undefined, identifier: identifier.trim(), password, turnstileToken });
        }}
      >
        <Field label="Work email or user ID" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="block text-xs font-medium text-slate-300">
          Business ID (optional)
          <input className={`${inputCls} mt-1.5 font-mono`} placeholder="ZX-ORG-XXXX-XXXX-XXXX" value={orgId} onChange={(e) => setOrgId(e.target.value.toUpperCase())} />
        </label>
        <Turnstile key={turnstileKey} action="track2-employee-login" onToken={setTurnstileToken} />
        <ErrorBox message={error} />
        <button className={buttonCls} disabled={busy || !turnstileToken}>{busy ? spinner : 'Sign in'}</button>
      </form>
    </Card>
  );
}

type OwnerMode = 'flow' | 'reset' | 'reset_confirm';

/** Track 1: "Continue with Google / email / phone" for owners and anyone with a Zolexora account. */
function OwnerSignIn() {
  const [mode, setMode] = useState<OwnerMode>('flow');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, setError, run } = useAction();

  const flow = usePublicSignIn({ firebaseAuth, product: IMS_PRODUCT, authUrl: AUTH_SERVICE_PUBLIC_URL() });
  const withTurnstile = async (action: (token: string) => Promise<boolean>) => {
    await action(turnstileToken);
    setTurnstileToken('');
    setTurnstileKey((k) => k + 1);
  };
  const go = (next: OwnerMode) => {
    setMode(next);
    setError(null);
    setTurnstileToken('');
  };
  const submit = (action: () => void) => (e: React.FormEvent) => { e.preventDefault(); action(); };
  const flowError = <ErrorBox message={flow.error?.message} />;
  const startOver = <button type="button" className={`${linkCls} w-full`} onClick={() => { flow.restart(); setPassword(''); setCode(''); }}>Use a different account</button>;

  if (mode === 'reset') {
    return (
      <Card title="Reset password" subtitle="We'll email you a reset code">
        <form className="space-y-4" onSubmit={submit(() => void run(async () => { await authPost('/api/v1/auth/public/reset-password', { email: email.trim(), turnstile_token: turnstileToken }); go('reset_confirm'); }))}>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Turnstile action="track1-public-reset-password" onToken={setTurnstileToken} />
          <ErrorBox message={error} />
          <button className={buttonCls} disabled={busy || !turnstileToken}>{busy ? spinner : 'Send code'}</button>
          <button type="button" className={`${linkCls} w-full`} onClick={() => go('flow')}>Back to sign in</button>
        </form>
      </Card>
    );
  }
  if (mode === 'reset_confirm') {
    return (
      <Card title="Choose a new password" subtitle={`If ${email} has an account, a code was sent to it`}>
        <form className="space-y-4" onSubmit={submit(() => void run(async () => {
          await authPost('/api/v1/auth/public/reset-password/confirm', { email: email.trim(), otp: code.trim(), new_password: password });
          go('flow'); flow.restart(); setPassword(''); setCode(''); setNotice('Password changed. Sign in with your new password.');
        }))}>
          <Field label="Reset code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Field label="New password (12+ characters)" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorBox message={error} />
          <button className={buttonCls} disabled={busy}>{busy ? spinner : 'Change password'}</button>
        </form>
      </Card>
    );
  }

  switch (flow.step) {
    case 'password':
      return (
        <Card title="Enter your password" subtitle={flow.email ?? flow.phoneNumber ?? ''}>
          <form className="space-y-4" onSubmit={submit(() => void withTurnstile((t) => flow.signInWithPassword(password, t)))}>
            <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Turnstile key={turnstileKey} action="track1-public-login" onToken={setTurnstileToken} />
            {flowError}
            <button className={buttonCls} disabled={flow.busy || !turnstileToken}>{flow.busy ? spinner : 'Sign in'}</button>
            <div className="flex justify-between">
              {startOver}
              {flow.email && <button type="button" className={linkCls} onClick={() => { setEmail(flow.email!); go('reset'); }}>Forgot password?</button>}
            </div>
          </form>
        </Card>
      );
    case 'verify_email':
      return (
        <Card title="Verify your email" subtitle={`Enter the code sent to ${flow.email}`}>
          <form className="space-y-4" onSubmit={submit(() => void flow.verifyEmailCode(code).then((ok) => ok && setCode('')))}>
            <Field label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            {flowError}
            <button className={buttonCls} disabled={flow.busy}>{flow.busy ? spinner : 'Verify email'}</button>
            {startOver}
          </form>
        </Card>
      );
    case 'enter_email':
      return (
        <Card title="Add your email" subtitle="We'll email you a verification code">
          <form className="space-y-4" onSubmit={submit(() => void flow.sendEmailCode(email))}>
            <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {flowError}
            <button className={buttonCls} disabled={flow.busy}>{flow.busy ? spinner : 'Send code'}</button>
            {startOver}
          </form>
        </Card>
      );
    case 'enter_phone':
      return (
        <Card title={flow.mobileVerificationRequired ? 'Verify your mobile number' : 'Your mobile number'}
          subtitle={flow.mobileVerificationRequired ? "We'll text you a verification code" : 'Used to reach you about your account'}>
          <form className="space-y-4" onSubmit={submit(() => void flow.sendPhoneCode(phone))}>
            <Field label="Phone (with country code)" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {flowError}
            <button className={buttonCls} disabled={flow.busy}>{flow.busy ? spinner : flow.mobileVerificationRequired ? 'Send code' : 'Continue'}</button>
            {startOver}
          </form>
        </Card>
      );
    case 'verify_phone':
      return (
        <Card title="Enter the SMS code" subtitle={`Sent to ${flow.phoneNumber}`}>
          <form className="space-y-4" onSubmit={submit(() => void flow.verifyPhoneCode(code).then((ok) => ok && setCode('')))}>
            <Field label="SMS code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            {flowError}
            <button className={buttonCls} disabled={flow.busy}>{flow.busy ? spinner : 'Verify number'}</button>
            {startOver}
          </form>
        </Card>
      );
    case 'profile':
      return (
        <Card title="Finish your account" subtitle={[flow.email, flow.phoneNumber].filter(Boolean).join(' · ')}>
          <form className="space-y-4" onSubmit={submit(() => void flow.completeProfile(displayName || flow.suggestedName || '', password))}>
            <Field label="Full name" autoComplete="name" value={displayName || flow.suggestedName || ''} onChange={(e) => setDisplayName(e.target.value)} />
            <Field label="Set a password (12+ characters)" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
            {flowError}
            <button className={buttonCls} disabled={flow.busy}>{flow.busy ? spinner : 'Create account'}</button>
          </form>
        </Card>
      );
    case 'done':
      return <div className="flex justify-center text-slate-400">{spinner}</div>;
    default:
      return (
        <Card title="Sign in or create an account" subtitle="Zolexora IMS · Inventory & Point of Sale">
          <div className="space-y-4">
            <button type="button" className={`${buttonCls} !bg-white !text-slate-900 hover:!bg-slate-100`} disabled={flow.busy || !turnstileToken}
              onClick={() => void withTurnstile((t) => flow.continueWithGoogle(t))}>
              <GoogleIcon /> Continue with Google
            </button>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
            <div className="grid grid-cols-2 rounded-xl bg-[#07080e] p-1 border border-white/10 text-xs">
              {(['email', 'phone'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={`py-2 rounded-lg font-medium ${method === m ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
                  {m === 'email' ? 'Email' : 'Phone'}
                </button>
              ))}
            </div>
            <form className="space-y-4" onSubmit={submit(() => void withTurnstile((t) => (method === 'email' ? flow.continueWithEmail(email, t) : flow.continueWithPhone(phone, t))))}>
              {method === 'email'
                ? <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                : <Field label="Phone (with country code)" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />}
              <Turnstile key={turnstileKey} action="track1-public-continue" onToken={setTurnstileToken} />
              {flowError}
              {notice && <p className="text-xs text-emerald-400">{notice}</p>}
              <button className={buttonCls} disabled={flow.busy || !turnstileToken}>{flow.busy ? spinner : `Continue with ${method}`}</button>
            </form>
          </div>
        </Card>
      );
  }
}

export default function LoginPage() {
  const { user, loading, personalSignedIn } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<'owner' | 'staff'>('owner');
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  let body: React.ReactNode;
  if (loading) body = <div className="flex justify-center text-slate-400">{spinner}</div>;
  else if (user) return <Navigate to={from} replace />;
  else if (personalSignedIn) body = <BusinessPicker />;
  else {
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-[#0c0e18] p-1 border border-white/10 text-sm">
          {([['owner', 'Owner', Building2], ['staff', 'Staff', Users]] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium ${tab === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        {tab === 'owner' ? <OwnerSignIn /> : <StaffSignIn />}
      </>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#07080e] p-6">
      <div className="w-full max-w-md">
        {body}
        <div id="zx-recaptcha" />
      </div>
    </div>
  );
}
