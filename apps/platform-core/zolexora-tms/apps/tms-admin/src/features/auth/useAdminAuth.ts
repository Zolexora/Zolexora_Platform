import { useAuth } from '@zolexora/auth-client/react';

/** Platform admins sign in through the Zolexora auth service (Track 3). */
export function useAdminAuth() {
  const { user, loading, error, adminSignIn, signOut } = useAuth();
  const signIn = async (email: string, password: string, turnstileToken: string) => {
    await adminSignIn({ email, password, turnstileToken });
  };
  return {
    user: user?.is_platform_admin ? user : null,
    isLoading: loading,
    error: error?.message ?? null,
    signIn,
    signOut,
  };
}
