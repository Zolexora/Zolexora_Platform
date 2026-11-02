import React, { useState, useEffect } from 'react';
import { ZolexoraAuthCard } from '@zolexora/user-auth-firebase';
import { useAuth as useLegacyAuth } from '../features/auth/useAuth';
import { useAuth } from '@zolexora/auth-client/react';
import { TurnstileWidget } from '@zolexora/auth-client/turnstile';
import { isValidZolexoraOrgId, isPublicWebmailDomain } from '@zolexora/auth-client';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Lock, Mail, ShieldAlert, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';

/**
 * Unified Zolexora TMS Authentication Form.
 * Supports:
 * 1. Global User / Owner Portal (Track 1: Personal login, account creation & workspace onboarding)
 * 2. Company Staff & Driver Login (Track 2: Dedicated org employee login with ZX-ORG- ID)
 */
export function AuthenticationForm() {
  const { user, authMe, isLoading: isLegacyLoading, token } = useLegacyAuth();
  const { orgSignIn, loading: isOrgLoading } = useAuth();
  const navigate = useNavigate();

  // Tab state: 'owner' (Track 1) or 'staff' (Track 2)
  const [activeTab, setActiveTab] = useState<'owner' | 'staff'>('owner');

  // Staff login form state
  const [orgId, setOrgId] = useState('');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [staffError, setStaffError] = useState<string | null>(null);
  const [webmailWarning, setWebmailWarning] = useState<string | null>(null);

  // If user is already authenticated and has an active organisation assigned, redirect to dashboard
  useEffect(() => {
    if (!isLegacyLoading && user && authMe?.organisation_id) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authMe, isLegacyLoading, navigate]);

  // If Firebase user is authenticated but has no organisation assigned yet, default to org_setup
  const initialMode = user && (!authMe || !authMe.organisation_id) ? 'org_setup' : 'select';

  // Format initial user identity for ZolexoraAuthCard workspace onboarding
  const initialUser = user
    ? {
        uid: user.uid,
        zolexora_id: user.uid,
        email: user.email || '',
        phone: user.phoneNumber || null,
        display_name: user.displayName || user.email?.split('@')[0] || 'User',
        photo_url: user.photoURL || null,
        email_verified: user.emailVerified,
        auth_provider: user.providerData?.[0]?.providerId || 'password',
        created_at: user.metadata.creationTime || new Date().toISOString(),
        last_sign_in_at: user.metadata.lastSignInTime || new Date().toISOString(),
      }
    : null;

  const handleSuccess = (session: any) => {
    if (session?.org || session?.token) {
      window.location.href = '/dashboard';
    }
  };

  // Real-time check on staff email to block personal webmail domains
  const handleEmailChange = (val: string) => {
    setUsernameOrEmail(val);
    if (val.includes('@') && isPublicWebmailDomain(val)) {
      setWebmailWarning('Company staff accounts require corporate email or employee ID. Public webmail (@gmail.com, etc.) is blocked.');
    } else {
      setWebmailWarning(null);
    }
  };

  // Staff login submission
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);

    const cleanOrgId = orgId.trim().toUpperCase();
    if (!isValidZolexoraOrgId(cleanOrgId)) {
      setStaffError('Invalid Organisation ID format. Must be ZX-ORG-XXXX-XXXX-XXXX');
      return;
    }

    if (usernameOrEmail.includes('@') && isPublicWebmailDomain(usernameOrEmail)) {
      setStaffError('Personal webmail domains (@gmail.com, @yahoo.com) are prohibited for organization staff accounts.');
      return;
    }

    try {
      const result = await orgSignIn({
        product: 'zolexora-tms',
        org_id: cleanOrgId,
        user_id_or_email: usernameOrEmail.trim(),
        password,
        turnstileToken: turnstileToken || undefined,
      });

      if (result.org?.org_id) {
        localStorage.setItem('zolexora_active_org_id', result.org.org_id);
      }

      window.location.href = '/dashboard';
    } catch (err: any) {
      setStaffError(err.message || 'Staff login failed. Please check your credentials.');
    }
  };

  const turnstileSiteKey =
    // @ts-ignore
    (typeof window !== 'undefined' && window.__ENV__?.VITE_TURNSTILE_SITE_KEY) ||
    import.meta.env.VITE_TURNSTILE_SITE_KEY ||
    '0x4AAAAAAAx_MockDevSiteKey';

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Track Selector Tabs */}
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-sm shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setActiveTab('owner')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium transition-all ${
            activeTab === 'owner'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span>Owner / Commander</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium transition-all ${
            activeTab === 'staff'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-cyan-400" />
          <span>Staff & Drivers</span>
        </button>
      </div>

      {/* Tab 1: Global Account & Workspace Onboarding */}
      {activeTab === 'owner' ? (
        <ZolexoraAuthCard
          key={user?.uid ? `user-${user.uid}-${initialMode}` : 'anonymous'}
          brandName="Zolexora TMS"
          brandTagline="Transport Management System & Logistics OS"
          theme="dark"
          initialMode={initialMode}
          initialUser={initialUser}
          initialToken={token}
          requiresOrg={true}
          onboardingEndpoint="/api/v1/onboarding"
          redirectUrl="/dashboard"
          onSuccess={handleSuccess}
        />
      ) : (
        /* Tab 2: Dedicated Organization Employee Login */
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-7 shadow-2xl backdrop-blur">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Staff & Driver Login</h2>
            <p className="text-xs text-slate-400 mt-1">
              Direct access to your assigned organization workspace
            </p>
          </div>

          <form onSubmit={handleStaffSubmit} className="space-y-4">
            {/* Org ID */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Organisation ID <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="ZX-ORG-XXXX-XXXX-XXXX"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono tracking-wider"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Format: Canonical Crockford Base32 ID</p>
            </div>

            {/* Staff Email or User ID */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Corporate Email or User ID <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="staff@company.com or EMP-104"
                  value={usernameOrEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              {webmailWarning && (
                <div className="flex items-start gap-1.5 mt-1.5 text-[11px] text-amber-400">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{webmailWarning}</span>
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Turnstile Bot Defense */}
            <div className="pt-1 flex justify-center">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                action="track2-employee-login"
                onVerify={(tok) => setTurnstileToken(tok)}
              />
            </div>

            {/* Error Message */}
            {staffError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                <span>{staffError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isOrgLoading || !!webmailWarning}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-2.5 px-4 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isOrgLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Staff</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-500 mt-5">
            Zolexora Platform · Argon2id Enterprise Security
          </p>
        </div>
      )}
    </div>
  );
}
