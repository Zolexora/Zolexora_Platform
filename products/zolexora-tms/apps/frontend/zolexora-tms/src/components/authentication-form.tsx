import { useEffect } from 'react';
import { ZolexoraAuthCard } from '@zolexora/user-auth-firebase';
import { useAuth } from '../features/auth/useAuth';
import { useNavigate } from 'react-router-dom';

/**
 * Unified Zolexora TMS Authentication Form.
 * Integrates Sign-In, Sign-Up, and Workspace Onboarding into a single continuous flow.
 * Directly consumes the centralized @zolexora/user-auth-firebase package.
 */
export function AuthenticationForm() {
  const { user, authMe, isLoading, token } = useAuth();
  const navigate = useNavigate();

  // If user is already authenticated and has an active organisation assigned, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user && authMe?.organisation_id) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authMe, isLoading, navigate]);

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

  return (
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
  );
}
