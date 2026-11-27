import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User,
  ShieldCheck,
  Laptop,
  History,
  KeyRound,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import {
  confirmMfa,
  disableMfa,
  getMyProfile,
  listLoginHistory,
  listMySessions,
  revokeOtherSessions,
  revokeSessionById,
  setupMfa,
  updateMyProfile,
  type CentralAddress,
} from '../../lib/authServiceApi';

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none';

export function UserProfilePage() {
  const queryClient = useQueryClient();
  const { authMe, user, personalSignedIn, zolexoraOrgId } = useAuth();
  const isPerson = personalSignedIn && authMe?.member_kind !== 'employee';

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['central-my-profile'],
    queryFn: getMyProfile,
    enabled: isPerson,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['central-my-sessions'],
    queryFn: listMySessions,
  });

  const { data: loginHistory = [] } = useQuery({
    queryKey: ['central-login-history'],
    queryFn: listLoginHistory,
  });

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [addresses, setAddresses] = useState<CentralAddress[]>([]);

  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setAddresses(profile.addresses || []);
    }
  }, [profile]);

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        display_name: displayName.trim() || undefined,
        avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
        addresses: addresses.filter((a) => a.line1 && a.city && a.state && a.pincode),
      }),
    onSuccess: () => {
      toast.success('Zolexora profile updated');
      queryClient.invalidateQueries({ queryKey: ['central-my-profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: revokeSessionById,
    onSuccess: () => {
      toast.success('Session revoked');
      queryClient.invalidateQueries({ queryKey: ['central-my-sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: (count) => {
      toast.success(`Signed out ${count} other session${count === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: ['central-my-sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startMfaMutation = useMutation({
    mutationFn: setupMfa,
    onSuccess: (data) => setMfaSetup(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmMfaMutation = useMutation({
    mutationFn: () => confirmMfa(mfaCode.trim()),
    onSuccess: () => {
      toast.success('Authenticator 2FA enabled');
      setMfaSetup(null);
      setMfaCode('');
      queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disableMfaMutation = useMutation({
    mutationFn: () => disableMfa(disableCode.trim()),
    onSuccess: () => {
      toast.success('Authenticator 2FA disabled');
      setDisableCode('');
      queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addAddress = () => {
    setAddresses((prev) => [
      ...prev,
      { label: 'Office', line1: '', city: '', state: '', pincode: '', country: 'IN' },
    ]);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="h-6 w-6 text-cyan-400" />
          My Zolexora Account & Security
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Centralised identity profile, two-factor authentication, and active sessions across Zolexora.
        </p>
      </div>

      {/* Centralised Account Profile */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-12 w-12 rounded-xl object-cover border border-slate-700" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-cyan-400 font-bold">
                {(displayName || authMe?.full_name || user?.email || 'ZX').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {profile?.display_name || authMe?.full_name || user?.email || 'Zolexora Account'}
              </h2>
              <p className="text-xs font-mono text-slate-400">
                {profile?.zolexora_id || authMe?.zolexora_id || 'ZX-ID pending'} ·{' '}
                {isPerson ? 'Personal Zolexora Account' : `Staff Account (${zolexoraOrgId || 'Org'})`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {(profile?.email || authMe?.email) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                {profile?.email_verified_at && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                {profile?.email || authMe?.email}
              </span>
            )}
            {(profile?.phone_number || authMe?.phone_number) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                {profile?.phone_verified_at && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                {profile?.phone_number || authMe?.phone_number}
              </span>
            )}
          </div>
        </div>

        {isPerson ? (
          profileLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading centralised profile…
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                saveProfileMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-xs font-medium text-slate-300">
                  Display Name
                  <input
                    className={`${inputCls} mt-1.5`}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    minLength={1}
                    maxLength={120}
                    placeholder="Your name"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Avatar URL (optional)
                  <input
                    className={`${inputCls} mt-1.5`}
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Saved Addresses
                  </span>
                  <button
                    type="button"
                    onClick={addAddress}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Address
                  </button>
                </div>

                {addresses.map((addr, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <input
                      className={`${inputCls} md:col-span-1`}
                      placeholder="Label"
                      value={addr.label || ''}
                      onChange={(e) => {
                        const next = [...addresses];
                        next[idx] = { ...addr, label: e.target.value };
                        setAddresses(next);
                      }}
                    />
                    <input
                      className={`${inputCls} md:col-span-2`}
                      placeholder="Address line 1"
                      value={addr.line1}
                      onChange={(e) => {
                        const next = [...addresses];
                        next[idx] = { ...addr, line1: e.target.value };
                        setAddresses(next);
                      }}
                    />
                    <input
                      className={inputCls}
                      placeholder="City"
                      value={addr.city}
                      onChange={(e) => {
                        const next = [...addresses];
                        next[idx] = { ...addr, city: e.target.value };
                        setAddresses(next);
                      }}
                    />
                    <input
                      className={inputCls}
                      placeholder="State"
                      value={addr.state}
                      onChange={(e) => {
                        const next = [...addresses];
                        next[idx] = { ...addr, state: e.target.value };
                        setAddresses(next);
                      }}
                    />
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        value={addr.pincode}
                        onChange={(e) => {
                          const next = [...addresses];
                          next[idx] = { ...addr, pincode: e.target.value };
                          setAddresses(next);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setAddresses(addresses.filter((_, i) => i !== idx))}
                        className="rounded-lg border border-slate-800 px-2.5 text-slate-400 hover:text-red-400"
                        title="Remove address"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saveProfileMutation.isPending}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {saveProfileMutation.isPending ? 'Saving…' : 'Save Central Profile'}
                </button>
              </div>
            </form>
          )
        ) : (
          <p className="text-xs text-slate-400">
            Staff profiles are managed centrally by your organisation administrator in Auth Service ({authMe?.role_code || 'member'}).
          </p>
        )}
      </div>

      {/* Two-Factor Authentication (TOTP MFA) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <KeyRound className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Authenticator App (2FA / MFA)</h2>
          {authMe?.mfa_setup_required && (
            <span className="ml-auto rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs text-amber-300">
              Required by Organisation Policy
            </span>
          )}
        </div>

        {mfaSetup ? (
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-300">
              Add this setup key to your authenticator app (Google Authenticator, 1Password, Authy):
            </p>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-sm text-cyan-300 select-all">
              {mfaSetup.secret}
            </div>
            <p className="text-[11px] text-slate-500 break-all">OTPAuth URI: {mfaSetup.otpauth_url}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className={`${inputCls} max-w-xs`}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              <button
                type="button"
                disabled={!mfaCode.trim() || confirmMfaMutation.isPending}
                onClick={() => confirmMfaMutation.mutate()}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {confirmMfaMutation.isPending ? 'Verifying…' : 'Confirm & Enable'}
              </button>
              <button
                type="button"
                onClick={() => setMfaSetup(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              disabled={startMfaMutation.isPending}
              onClick={() => startMfaMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              Set Up Authenticator App
            </button>

            <div className="flex items-center gap-2">
              <input
                className={`${inputCls} w-40`}
                placeholder="6-digit code"
                inputMode="numeric"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
              />
              <button
                type="button"
                disabled={!disableCode.trim() || disableMfaMutation.isPending}
                onClick={() => disableMfaMutation.mutate()}
                className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/60 disabled:opacity-50"
              >
                Disable 2FA
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Business Sessions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Active Business Sessions</h2>
          </div>
          {sessions.length > 1 && (
            <button
              type="button"
              onClick={() => revokeOthersMutation.mutate()}
              disabled={revokeOthersMutation.isPending}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Sign out other devices
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="text-sm text-slate-400">Loading active sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-slate-500">No active business sessions found.</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{s.product || 'platform'}</span>
                    {s.current && (
                      <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] text-cyan-300">
                        Current
                      </span>
                    )}
                    {s.mfa && (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300">
                        MFA Verified
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 truncate max-w-xl">
                    {s.ip || 'Unknown IP'} · {s.user_agent || 'Unknown device'}
                  </p>
                  <p className="text-slate-500">
                    Last used: {new Date(s.last_used_at).toLocaleString()}
                  </p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    onClick={() => revokeSessionMutation.mutate(s.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:text-red-400"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Login History */}
      {loginHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <History className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Recent Login Activity</h2>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {loginHistory.slice(0, 15).map((attempt, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2 text-xs">
                <span className="text-slate-300">
                  {String(attempt.ip || 'Unknown IP')} · {attempt.success ? 'Success' : 'Failed'}
                </span>
                <span className="text-slate-500">
                  {attempt.created_at ? new Date(String(attempt.created_at)).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
