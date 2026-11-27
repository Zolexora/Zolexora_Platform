import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
import { Building2, Users, ShieldAlert, Loader2, Plus, ChevronRight, Truck, Eye, EyeOff } from 'lucide-react';
import type { WorkspaceType } from '../types';
import { useAuth } from '../features/auth/useAuth';
import { apiClient } from '../lib/api';
import { listActivityGroups, type ActivityGroup } from '../lib/authServiceApi';
import { AUTH_SERVICE_PUBLIC_URL, TURNSTILE_SITE_KEY } from '../lib/runtime';
import { firebaseAuth } from '../lib/firebase';

type OwnerMode = 'flow' | 'reset' | 'reset_confirm';

const input =
  'w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500';
const button =
  'w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-2.5 px-4 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed';
const link = 'text-xs text-cyan-400 hover:text-cyan-300';

/** Maps auth-service PAN-based business_kind to TMS's legal classification label. */
function mapBusinessKindToTmsType(kind?: string | null): string {
  switch ((kind || '').toLowerCase()) {
    case 'individual':
      return 'Freelancer / Individual';
    case 'proprietor':
    case 'sole_proprietorship':
      return 'Sole Proprietorship / Proprietor';
    case 'llp':
      return 'Limited Liability Partnership (LLP)';
    case 'partnership':
      return 'Partnership Firm';
    case 'huf':
      return 'Hindu Undivided Family (HUF)';
    case 'trust':
      return 'Trust';
    case 'society':
    case 'association':
      return 'Society';
    case 'government':
    case 'public_body':
      return 'Government Organisation';
    case 'company':
    default:
      return 'Private Limited Company';
  }
}

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

function Field({ label, type, className, required = true, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputEl = (
    <input
      type={isPassword && showPassword ? 'text' : type}
      className={`${className ?? input}${isPassword ? ' pr-10' : ''} ${isPassword ? '' : 'mt-1.5'}`.trim()}
      required={required}
      {...props}
    />
  );

  return (
    <label className="block text-xs font-medium text-slate-300">
      {label}
      {isPassword ? (
        <div className="relative mt-1.5 flex items-center">
          {inputEl}
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={(e) => {
              e.preventDefault();
              setShowPassword((prev) => !prev);
            }}
            className="absolute right-3 text-slate-400 hover:text-slate-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        inputEl
      )}
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

function ErrorBox({ message }: { message: string | null | undefined }) {
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

/** Track 1 business picker & PAN-driven centralised business creation (ADR 0004 §2/§3a). */
function BusinessPicker() {
  const { getToken } = useZolexoraAuth();
  const { enterBusiness, signOut } = useAuth();
  const { busy, error, setError, run } = useAction();

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [activities, setActivities] = useState<ActivityGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const [mfaFor, setMfaFor] = useState<Business | null>(null);
  const [code, setCode] = useState('');

  const [pan, setPan] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [activityPrimary, setActivityPrimary] = useState('');
  const [registered, setRegistered] = useState<'' | 'yes' | 'no'>('');

  useEffect(() => {
    let active = true;
    void run(async () => {
      const token = await getToken();
      if (!token) throw new Error('Your sign-in expired. Sign in again.');
      const [list, groups] = await Promise.all([
        listBusinesses(AUTH_SERVICE_PUBLIC_URL(), token),
        listActivityGroups().catch(() => [] as ActivityGroup[]),
      ]);
      if (!active) return;
      setBusinesses(list);
      setActivities(groups);
      setCreating(list.length === 0);
    });
    return () => {
      active = false;
    };
  }, [getToken, run]);

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
      <Card title="Your businesses" subtitle="Loading from Zolexora Auth Service…">
        <ErrorBox message={error} />
        {error ? (
          <button className={button} onClick={() => signOut()}>Sign out</button>
        ) : (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>
        )}
      </Card>
    );
  }

  if (mfaFor) {
    return (
      <Card title="Confirm it's you" subtitle={`Enter authenticator code for ${mfaFor.name}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void open(mfaFor, code.trim()); }}>
          <Field label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <ErrorBox message={error} />
          <button className={button} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}</button>
          <button type="button" className={`${link} w-full`} onClick={() => { setMfaFor(null); setCode(''); setError(null); }}>Back</button>
        </form>
      </Card>
    );
  }

  if (!creating) {
    return (
      <Card title="Choose a business" subtitle="Centralised organisations on your Zolexora account">
        <div className="space-y-2">
          {businesses.map((b) => (
            <button
              key={b.zolexora_org_id}
              type="button"
              disabled={busy}
              onClick={() => void open(b)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left hover:border-cyan-500 disabled:opacity-50"
            >
              <span>
                <span className="block text-sm font-semibold text-white">{b.name}</span>
                <span className="block text-[11px] text-slate-400">
                  <span className="font-mono">{b.zolexora_org_id}</span>
                  {' · '}
                  {[b.role_name || b.role, b.business_kind, b.status !== 'active' ? b.status : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          ))}
        </div>
        <ErrorBox message={error} />
        <button type="button" className={`${button} !bg-none border border-slate-700 bg-slate-900 hover:bg-slate-800`} onClick={() => { setCreating(true); setError(null); }}>
          <Plus className="w-4 h-4" /> Create a business
        </button>
        <button type="button" className={`${link} w-full`} onClick={() => signOut()}>Sign out</button>
      </Card>
    );
  }

  const panUpper = pan.trim().toUpperCase();
  const personalPan = panUpper[3] === 'P';
  const firmPan = panUpper[3] === 'F';

  return (
    <Card title="Create a business" subtitle="Registered centrally via Zolexora Auth (PAN encrypted)">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const token = await getToken();
            if (!token) throw new Error('Your sign-in expired. Sign in again.');
            const created = await createBusiness(AUTH_SERVICE_PUBLIC_URL(), token, {
              pan: panUpper,
              legal_name: legalName.trim(),
              trade_name: tradeName.trim() || null,
              email: email.trim() || null,
              phone: phone.trim() || null,
              activity_primary: activityPrimary || null,
              ...(personalPan ? { has_business_registration: registered === 'yes' } : {}),
              ...(firmPan ? { has_llpin: registered === 'yes' } : {}),
            });
            await enterBusiness(created.zolexora_org_id);
          });
        }}
      >
        <Field label="PAN" className={`${input} mt-1.5 font-mono uppercase`} maxLength={10} placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value)} />
        <Field label="Legal name (as on PAN)" minLength={2} maxLength={200} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        <Field label="Trade name (optional)" required={false} minLength={2} maxLength={200} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        {(personalPan || firmPan) && (
          <label className="block text-xs font-medium text-slate-300">
            {personalPan ? 'Is the business registered (GST, Udyam, shop licence)?' : 'Is this firm an LLP (has an LLPIN)?'}
            <select className={`${input} mt-1.5`} required value={registered} onChange={(e) => setRegistered(e.target.value as 'yes' | 'no')}>
              <option value="" disabled>Choose</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        )}
        {activities.length > 0 && (
          <label className="block text-xs font-medium text-slate-300">
            Primary business activity (optional)
            <select className={`${input} mt-1.5`} value={activityPrimary} onChange={(e) => setActivityPrimary(e.target.value)}>
              <option value="">Select activity group…</option>
              {activities.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Business email (optional)" required={false} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Business phone (optional)" required={false} type="tel" placeholder="+919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <ErrorBox message={error} />
        <button className={button} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create business'}</button>
        {businesses.length > 0
          ? <button type="button" className={`${link} w-full`} onClick={() => { setCreating(false); setError(null); }}>Back to my businesses</button>
          : <button type="button" className={`${link} w-full`} onClick={() => signOut()}>Sign out</button>}
      </form>
    </Card>
  );
}

/** First-time TMS workspace setup once a business session is active for a ZX-ORG. */
function WorkspaceSetup() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { businessSession, authMe, switchBusiness, signOut } = useAuth();
  const { busy, error, run } = useAction();
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('SERVICE_PROVIDER');
  const [workspaceName, setWorkspaceName] = useState(() => businessSession?.org.name || '');

  const isOwner = authMe?.is_commander || businessSession?.org.role === 'owner';

  if (!isOwner) {
    return (
      <Card title="TMS workspace not set up" subtitle={businessSession?.org.zolexora_org_id || ''}>
        <p className="text-sm text-slate-300">
          Your business owner hasn&apos;t initialized Zolexora TMS for <strong>{businessSession?.org.name}</strong> yet.
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" className={button} onClick={() => void switchBusiness()}>Switch business</button>
          <button type="button" className={`${link} w-full`} onClick={() => void signOut()}>Sign out</button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Initialize TMS Workspace" subtitle={`${businessSession?.org.name} · ${businessSession?.org.zolexora_org_id}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const created = await apiClient<{ organisation: { id: string; workspace_type: WorkspaceType } }>('/api/v1/onboarding', {
              method: 'POST',
              body: JSON.stringify({
                name: workspaceName.trim() || businessSession?.org.name || 'Zolexora TMS',
                organisation_type: mapBusinessKindToTmsType(authMe?.business_kind),
                workspace_type: workspaceType,
                zolexora_org_id: businessSession?.org.zolexora_org_id,
              }),
            });
            localStorage.setItem('zolexora_active_org_id', created.organisation.id);
            await queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
            navigate(created.organisation.workspace_type === 'CLIENT' ? '/client/dashboard' : '/sp/dashboard', { replace: true });
          });
        }}
      >
        <Field label="Workspace Display Name" minLength={2} maxLength={160} value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
        <div>
          <p className="mb-2 text-xs font-medium text-slate-300">How will {businessSession?.org.name} use TMS?</p>
          <div className="grid grid-cols-2 gap-3">
            {(['SERVICE_PROVIDER', 'CLIENT'] as const).map((wt) => (
              <button
                key={wt}
                type="button"
                onClick={() => setWorkspaceType(wt)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-semibold transition ${
                  workspaceType === wt
                    ? 'border-cyan-500 bg-cyan-500/10 text-white'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                }`}
              >
                {wt === 'SERVICE_PROVIDER' ? <Truck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                {wt === 'SERVICE_PROVIDER' ? 'Service Provider' : 'Client'}
                <span className="text-[10px] font-normal text-slate-500">
                  {wt === 'SERVICE_PROVIDER' ? 'Manage fleet & dispatch' : 'Book & track transport'}
                </span>
              </button>
            ))}
          </div>
        </div>
        <ErrorBox message={error} />
        <button className={button} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Launch TMS Workspace'}
        </button>
        <div className="flex justify-between pt-1">
          <button type="button" className={link} onClick={() => void switchBusiness()}>Switch business</button>
          <button type="button" className={link} onClick={() => void signOut()}>Sign out</button>
        </div>
      </form>
    </Card>
  );
}

/** Track 2 employee sign in (ZX-id, phone, or corporate email + optional business picker + MFA). */
function StaffSignIn({ tabs }: { tabs: React.ReactNode }) {
  const { adoptBusinessSession } = useAuth();
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
        else await adoptBusinessSession();
      } finally {
        setTurnstileToken('');
        setTurnstileKey((k) => k + 1);
      }
    });

  if (mfaTicket) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card title="Confirm it's you" subtitle="Enter the code from your authenticator app">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await employeeVerifyMfa(AUTH_SERVICE_PUBLIC_URL(), mfaTicket, code.trim()); await adoptBusinessSession(); }); }}>
            <Field label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            <ErrorBox message={error} />
            <button className={button} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}</button>
            <button type="button" className={`${link} w-full`} onClick={() => { setMfaTicket(null); setCode(''); }}>Start again</button>
          </form>
        </Card>
      </div>
    );
  }

  if (choice) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card title="Choose a business" subtitle="Your employee login belongs to multiple businesses">
          <div className="space-y-2">
            {choice.businesses.map((b) => (
              <button
                key={b.zolexora_org_id}
                type="button"
                disabled={busy}
                onClick={() => void signIn({ product: 'zolexora-tms', loginTicket: choice.ticket, orgId: b.zolexora_org_id })}
                className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left hover:border-cyan-500 disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-white">{b.name}</span>
                  <span className="block text-[11px] font-mono text-slate-400">{b.zolexora_org_id}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
          <ErrorBox message={error} />
          <button type="button" className={`${link} w-full`} onClick={() => setChoice(null)}>Start again</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {tabs}
      <Card title="Staff & Driver Login" subtitle="Sign in with your ZX ID, phone, or work email">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void signIn({
              product: 'zolexora-tms',
              orgId: orgId.trim().toUpperCase() || undefined,
              identifier: identifier.trim(),
              password,
              turnstileToken,
            });
          }}
        >
          <Field label="Work email, phone, or Zolexora ID" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label="Business ID (optional)" required={false} className={`${input} mt-1.5 font-mono`} placeholder="ZX-ORG-XXXX-XXXX-XXXX" value={orgId} onChange={(e) => setOrgId(e.target.value.toUpperCase())} />
          <Turnstile key={turnstileKey} action="track2-employee-login" onToken={setTurnstileToken} />
          <ErrorBox message={error} />
          <button className={button} disabled={busy || !turnstileToken}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in as staff'}
          </button>
        </form>
      </Card>
    </div>
  );
}

/**
 * Zolexora TMS sign-in (ADR 0004 / ADR 0005):
 * - Owner / Person (Track 1): signs into Zolexora account, picks or creates a PAN-typed business,
 *   and opens an ES256 business session for TMS.
 * - Staff & Drivers (Track 2): signs straight into a TMS business session.
 */
export function AuthenticationForm() {
  const navigate = useNavigate();
  const { businessSession, personalSignedIn, authMe, isLoading } = useAuth();

  const [tab, setTab] = useState<'owner' | 'staff'>('owner');
  const [mode, setMode] = useState<OwnerMode>('flow');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    if (!isLoading && businessSession && authMe?.organisation_id) {
      navigate(authMe.workspace_type === 'CLIENT' ? '/client/dashboard' : '/sp/dashboard', { replace: true });
    }
  }, [businessSession, authMe, isLoading, navigate]);

  const go = (next: OwnerMode) => {
    setMode(next);
    setError(null);
    setTurnstileToken('');
  };

  const flow = usePublicSignIn({ firebaseAuth, product: 'zolexora-tms', authUrl: AUTH_SERVICE_PUBLIC_URL() });
  const withTurnstile = async (action: (token: string) => Promise<boolean>) => {
    await action(turnstileToken);
    setTurnstileToken('');
    setTurnstileKey((k) => k + 1);
  };

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin text-slate-400" />;
  }

  if (businessSession && authMe && !authMe.organisation_id) {
    return (
      <div className="w-full max-w-md mx-auto">
        <WorkspaceSetup />
      </div>
    );
  }

  if (personalSignedIn && !businessSession) {
    return (
      <div className="w-full max-w-md mx-auto">
        <BusinessPicker />
      </div>
    );
  }

  const tabs = (
    <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-sm">
      {([['owner', 'Owner / Account', Building2], ['staff', 'Staff & Drivers', Users]] as const).map(([key, label, Icon]) => (
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
    return <StaffSignIn tabs={tabs} />;
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
