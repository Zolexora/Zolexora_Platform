import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ZolexoraAuthProvider, useAuth as useAccount } from '@zolexora/auth-client/react';
import { getProfile } from '../utils/api';
import { config } from '../utils/runtime';

/**
 * Sign-in belongs to the Zolexora auth service (ZolexoraAuthProvider holds the session).
 * `user` is the marketplace profile of that account; platform admins have no profile.
 */
const AuthContext = createContext(null);

function ProfileProvider({ children }) {
  const { user: account, loading: sessionLoading, signOut } = useAccount();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!account) return setUser(null);
    if (account.is_platform_admin) {
      return setUser({ id: account.uid, name: account.email, email: account.email, isAdmin: true });
    }
    const { data } = await getProfile();
    setUser({ ...data, isAdmin: false });
  }, [account]);

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    refreshProfile().catch(() => setUser(null)).finally(() => setLoading(false));
  }, [sessionLoading, refreshProfile]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ user, loading: sessionLoading || loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const AuthProvider = ({ children }) => (
  <ZolexoraAuthProvider authUrl={config('AUTH_SERVICE_PUBLIC_URL')} product="marketplace">
    <ProfileProvider>{children}</ProfileProvider>
  </ZolexoraAuthProvider>
);

export const useAuth = () => useContext(AuthContext);
