import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TurnstileWidget } from '@zolexora/auth-client/turnstile';
import { Building2, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { acceptInvite, previewInvite } from '../lib/authServiceApi';
import { getPersonalToken } from '../lib/session';
import { TURNSTILE_SITE_KEY } from '../lib/runtime';
import { useAuth } from '../features/auth/useAuth';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { personalSignedIn } = useAuth();

  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ zolexora_id?: string; org_id?: string } | null>(null);

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: () => previewInvite(token),
    enabled: !!token,
    retry: false,
  });

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await acceptInvite(token, {
        password: invite?.kind === 'employee' ? password : undefined,
        turnstileToken: invite?.kind === 'employee' ? turnstileToken : undefined,
        personalToken: invite?.kind === 'person' ? getPersonalToken() : undefined,
      });
      setDone(res);
    } catch (ex: any) {
      setErr(ex?.message || 'Could not accept invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl space-y-5">
        {!token ? (
          <p className="text-sm text-red-400">Missing invitation token in URL.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>
        ) : error || !invite ? (
          <div className="space-y-3 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-red-400" />
            <p className="text-sm text-red-300">{(error as Error)?.message || 'This invite link is no longer valid.'}</p>
            <Link to="/authentication" className="inline-block text-xs text-cyan-400 hover:underline">Go to Sign In</Link>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Invitation Accepted</h2>
            {done.zolexora_id && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
                <p className="text-slate-400">Your Zolexora Staff ID</p>
                <p className="font-mono text-sm font-bold text-cyan-300 mt-1">{done.zolexora_id}</p>
              </div>
            )}
            <Link
              to="/authentication"
              className="block w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              Continue to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center space-y-1">
              <Building2 className="mx-auto h-8 w-8 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">
                {invite.reset ? 'Reset Staff Password' : `Join ${invite.organization.name}`}
              </h2>
              <p className="text-xs text-slate-400">
                <span className="font-mono">{invite.organization.zolexora_org_id}</span>
                {invite.role ? ` · Role: ${invite.role}` : ''}
              </p>
              <p className="text-xs text-slate-500">
                {invite.email || invite.phone_number}
              </p>
            </div>

            {invite.kind === 'person' && !personalSignedIn ? (
              <div className="space-y-3 text-center">
                <p className="text-xs text-slate-300">
                  Sign in with your Zolexora account ({invite.email}), then return to accept this invite.
                </p>
                <Link
                  to="/authentication"
                  className="block w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
                >
                  Sign In First
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleAccept}>
                {invite.kind === 'employee' && (
                  <>
                    <label className="block text-xs font-medium text-slate-300">
                      Choose a password (12+ characters)
                      <input
                        type="password"
                        minLength={12}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </label>
                    <div className="flex justify-center">
                      <TurnstileWidget
                        siteKey={TURNSTILE_SITE_KEY()}
                        action="invite-accept"
                        theme="dark"
                        onVerify={setTurnstileToken}
                        onExpire={() => setTurnstileToken('')}
                      />
                    </div>
                  </>
                )}

                {err && <p className="text-xs text-red-400">{err}</p>}

                <button
                  type="submit"
                  disabled={busy || (invite.kind === 'employee' && !turnstileToken)}
                  className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {busy ? 'Submitting…' : invite.reset ? 'Set New Password' : 'Accept Invitation'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
