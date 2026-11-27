import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Link2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { listBusinesses } from '@zolexora/auth-client/business-session';
import { useAuth } from '../auth/useAuth';
import { apiClient } from '../../lib/api';
import { getPersonalToken } from '../../lib/session';
import { AUTH_SERVICE_PUBLIC_URL } from '../../lib/runtime';
import {
  closeCentralOrganisation,
  getCentralOrganisation,
  listActivityGroups,
  listCentralMembers,
  transferOrgOwnership,
  updateCentralOrganisation,
  updateOrgSecurity,
} from '../../lib/authServiceApi';

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none';

export function WorkspaceSettingsPage() {
  const queryClient = useQueryClient();
  const {
    isCommander,
    organisation,
    zolexoraOrgId,
    authMe,
    hasAuthPermission,
    signOut,
  } = useAuth();

  const canEditProfile = isCommander || hasAuthPermission('org:profile:edit');
  const canManageSecurity = isCommander || hasAuthPermission('org:security:manage');
  const canTransfer = isCommander || hasAuthPermission('org:ownership:transfer');
  const canClose = isCommander || hasAuthPermission('org:business:close');

  const { data: centralData, isLoading: centralLoading } = useQuery({
    queryKey: ['central-org', zolexoraOrgId],
    queryFn: () => getCentralOrganisation(zolexoraOrgId!),
    enabled: !!zolexoraOrgId,
  });

  const { data: activityGroups = [] } = useQuery({
    queryKey: ['central-activity-groups'],
    queryFn: listActivityGroups,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['central-members', zolexoraOrgId],
    queryFn: () => listCentralMembers(zolexoraOrgId!),
    enabled: !!zolexoraOrgId && canTransfer,
  });

  const personalToken = getPersonalToken();
  const { data: personalBusinesses = [] } = useQuery({
    queryKey: ['personal-businesses-for-link'],
    queryFn: () => listBusinesses(AUTH_SERVICE_PUBLIC_URL(), personalToken!),
    enabled: !zolexoraOrgId && !!personalToken && isCommander,
  });

  const org = centralData?.organization;

  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [activityPrimary, setActivityPrimary] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  const [linkZxOrgId, setLinkZxOrgId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferMemberId, setTransferMemberId] = useState('');
  const [transferMfa, setTransferMfa] = useState('');
  const [closeConfirm, setCloseConfirm] = useState('');

  useEffect(() => {
    if (org) {
      setLegalName(org.legal_name || org.name || '');
      setTradeName(org.trade_name || '');
      setEmail(org.email || '');
      setPhone(org.phone || '');
      setLogoUrl(org.logo_url || '');
      setActivityPrimary(org.activity_primary || '');
      setLine1(org.address?.line1 || '');
      setLine2(org.address?.line2 || '');
      setCity(org.address?.city || '');
      setStateName(org.address?.state || '');
      setPincode(org.address?.pincode || '');
    }
  }, [org]);

  const updateOrgMutation = useMutation({
    mutationFn: () =>
      updateCentralOrganisation(zolexoraOrgId!, {
        legal_name: legalName.trim(),
        trade_name: tradeName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        logo_url: logoUrl.trim() || null,
        activity_primary: activityPrimary || null,
        address: line1.trim()
          ? {
              line1: line1.trim(),
              line2: line2.trim() || undefined,
              city: city.trim(),
              state: stateName.trim(),
              pincode: pincode.trim(),
              country: 'IN',
            }
          : null,
      }),
    onSuccess: () => {
      toast.success('Central organisation profile updated');
      queryClient.invalidateQueries({ queryKey: ['central-org', zolexoraOrgId] });
      queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const mfaPolicyMutation = useMutation({
    mutationFn: (policy: 'off' | 'optional' | 'required') => updateOrgSecurity(zolexoraOrgId!, policy),
    onSuccess: () => {
      toast.success('Organisation MFA policy updated');
      queryClient.invalidateQueries({ queryKey: ['central-org', zolexoraOrgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkMutation = useMutation({
    mutationFn: (zxId: string) =>
      apiClient('/api/v1/organisations/me/link-zolexora-org', {
        method: 'POST',
        body: JSON.stringify({ zolexora_org_id: zxId }),
      }),
    onSuccess: () => {
      toast.success('Workspace linked to Zolexora Auth Service business');
      queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const transferMutation = useMutation({
    mutationFn: () => transferOrgOwnership(zolexoraOrgId!, transferMemberId, transferMfa.trim() || undefined),
    onSuccess: () => {
      toast.success('Business ownership transferred');
      setShowTransfer(false);
      queryClient.invalidateQueries({ queryKey: ['central-org', zolexoraOrgId] });
      queryClient.invalidateQueries({ queryKey: ['central-members', zolexoraOrgId] });
      queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeCentralOrganisation(zolexoraOrgId!, closeConfirm),
    onSuccess: async () => {
      toast.success('Business deactivated');
      await signOut();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verificationEntries = Object.entries(authMe?.verification || {});
  const personCandidates = members.filter((m) => m.kind === 'person' && m.status === 'active');

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Organisation Profile & Security</h1>
        <p className="text-sm text-slate-400">
          Centralised business profile, PAN classification, MFA policy, and ownership managed via Zolexora Auth Service.
        </p>
      </div>

      {/* Legacy Workspace Link Banner */}
      {!zolexoraOrgId && (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Link2 className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-white">Link Centralised Zolexora Business</h2>
              <p className="text-xs text-slate-300 mt-1">
                This TMS workspace ({organisation?.name}) is not yet linked to a centralised ZX-ORG business. Link an existing business to unlock centralised profile editing, team invites, and unified roles.
              </p>
            </div>
          </div>
          {personalBusinesses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {personalBusinesses.map((b) => (
                <button
                  key={b.zolexora_org_id}
                  type="button"
                  disabled={linkMutation.isPending}
                  onClick={() => linkMutation.mutate(b.zolexora_org_id)}
                  className="rounded-lg border border-cyan-700/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-900/50"
                >
                  Link {b.name} ({b.zolexora_org_id})
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 max-w-md">
            <input
              className={`${inputCls} font-mono`}
              placeholder="ZX-ORG-XXXX-XXXX-XXXX"
              value={linkZxOrgId}
              onChange={(e) => setLinkZxOrgId(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              disabled={!linkZxOrgId.trim() || linkMutation.isPending}
              onClick={() => linkMutation.mutate(linkZxOrgId.trim())}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Link
            </button>
          </div>
        </div>
      )}

      {/* Centralised Organisation Profile */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-cyan-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">{org?.name || organisation?.name || 'Organisation Profile'}</h2>
              <p className="text-xs font-mono text-slate-400">
                {zolexoraOrgId || organisation?.id} {org?.business_kind ? `· ${org.business_kind}` : ''}
                {org?.pan_last4 ? ` · PAN •••••${org.pan_last4}` : ''}
              </p>
            </div>
          </div>
          {verificationEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {verificationEntries.map(([check, status]) => (
                <span
                  key={check}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                    status === 'verified'
                      ? 'border-emerald-700/40 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                >
                  {status === 'verified' && <CheckCircle2 className="h-3 w-3" />}
                  {check}: {status}
                </span>
              ))}
            </div>
          )}
        </div>

        {!zolexoraOrgId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">Workspace Name</p>
              <p className="text-base text-slate-200">{organisation?.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Classification</p>
              <p className="text-base text-slate-200">{organisation?.organisation_type}</p>
            </div>
          </div>
        ) : centralLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading centralised business profile…
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              updateOrgMutation.mutate();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-xs font-medium text-slate-300">
                Legal Name (as on PAN)
                <input className={`${inputCls} mt-1.5`} disabled={!canEditProfile} required minLength={2} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Trade / Display Name
                <input className={`${inputCls} mt-1.5`} disabled={!canEditProfile} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Business Email
                <input className={`${inputCls} mt-1.5`} disabled={!canEditProfile} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Business Phone (E.164)
                <input className={`${inputCls} mt-1.5`} disabled={!canEditProfile} placeholder="+919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Primary Activity Group
                <select className={`${inputCls} mt-1.5`} disabled={!canEditProfile} value={activityPrimary} onChange={(e) => setActivityPrimary(e.target.value)}>
                  <option value="">None selected</option>
                  {activityGroups.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Logo URL
                <input className={`${inputCls} mt-1.5`} disabled={!canEditProfile} type="url" placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Registered Address</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className={`${inputCls} md:col-span-2`} disabled={!canEditProfile} placeholder="Address Line 1" value={line1} onChange={(e) => setLine1(e.target.value)} />
                <input className={inputCls} disabled={!canEditProfile} placeholder="Address Line 2 (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} />
                <input className={inputCls} disabled={!canEditProfile} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <input className={inputCls} disabled={!canEditProfile} placeholder="State" value={stateName} onChange={(e) => setStateName(e.target.value)} />
                <input className={inputCls} disabled={!canEditProfile} placeholder="6-digit PIN" maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
            </div>

            {canEditProfile && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateOrgMutation.isPending}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {updateOrgMutation.isPending ? 'Saving…' : 'Save Organisation Profile'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Centralised Security / MFA Policy */}
      {zolexoraOrgId && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Security & MFA Policy</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {(['off', 'optional', 'required'] as const).map((policy) => {
              const active = (org?.mfa_policy || 'off') === policy;
              return (
                <button
                  key={policy}
                  type="button"
                  disabled={!canManageSecurity || mfaPolicyMutation.isPending}
                  onClick={() => mfaPolicyMutation.mutate(policy)}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                    active
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                  } disabled:opacity-60`}
                >
                  MFA: {policy}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Owner Actions: Ownership Transfer & Close Business */}
      {zolexoraOrgId && (canTransfer || canClose) && (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-6 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            <h2 className="text-xl font-semibold text-white">Owner Governance</h2>
          </div>

          {canTransfer && (
            <div className="space-y-3">
              {!showTransfer ? (
                <button
                  type="button"
                  onClick={() => setShowTransfer(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Transfer Business Ownership
                </button>
              ) : (
                <div className="bg-slate-900 border border-red-900/50 rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3 text-red-400 bg-red-950/30 p-3 rounded border border-red-900/30">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm">
                      Transferring ownership promotes the selected person to Owner and steps you down to Admin.
                    </p>
                  </div>
                  <select
                    className={inputCls}
                    value={transferMemberId}
                    onChange={(e) => setTransferMemberId(e.target.value)}
                  >
                    <option value="">Select active person member…</option>
                    {personCandidates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name || m.email || m.zolexora_id} ({m.zolexora_id})
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputCls}
                    placeholder="Authenticator MFA code (if enrolled)"
                    value={transferMfa}
                    onChange={(e) => setTransferMfa(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => transferMutation.mutate()}
                      disabled={!transferMemberId || transferMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {transferMutation.isPending ? 'Transferring…' : 'Confirm Ownership Transfer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTransfer(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canClose && (
            <div className="border-t border-red-900/40 pt-4 space-y-3">
              <p className="text-xs text-slate-400">
                To permanently deactivate <strong className="text-slate-200">{zolexoraOrgId}</strong>, type the business ID below:
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
                <input
                  className={`${inputCls} font-mono`}
                  placeholder={zolexoraOrgId}
                  value={closeConfirm}
                  onChange={(e) => setCloseConfirm(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  disabled={closeConfirm.trim() !== zolexoraOrgId || closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                  className="rounded-lg border border-red-700 bg-red-950/60 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/60 disabled:opacity-40"
                >
                  Close Business
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
