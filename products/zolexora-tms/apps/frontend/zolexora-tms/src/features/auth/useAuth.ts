import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, webAuth } from '../../lib/firebase';
import { apiClient } from '../../lib/api';
import type { AuthMeResponse, Organisation, EffectivePermissionsResponse } from '../../types';

export function useAuth() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [token, setToken] = useState<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        setToken(idToken);
      } else {
        setToken(null);
      }
      setIsSessionLoading(false);
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      queryClient.invalidateQueries({ queryKey: ['organisation-me'] });
      queryClient.invalidateQueries({ queryKey: ['effective-permissions'] });
    });

    return () => unsubscribe();
  }, [queryClient]);

  const {
    data: authMe,
    isLoading: isAuthMeLoading,
    error: authMeError,
  } = useQuery({
    queryKey: ['auth-me', token],
    queryFn: () => apiClient<AuthMeResponse>('/api/v1/auth/me'),
    enabled: !!token,
  });

  // Keep localStorage in sync with the active org from the backend auth response
  useEffect(() => {
    if (authMe?.organisation_id) {
      localStorage.setItem('zolexora_active_org_id', authMe.organisation_id);
    } else if (!isAuthMeLoading && !authMe) {
      localStorage.removeItem('zolexora_active_org_id');
    }
  }, [authMe?.organisation_id, isAuthMeLoading, authMe]);

  const {
    data: organisation,
    isLoading: isOrgLoading,
    error: orgError,
  } = useQuery({
    queryKey: ['organisation-me', token],
    queryFn: () => apiClient<Organisation>('/api/v1/organisations/me'),
    enabled: !!token && !!authMe?.organisation_id,
  });

  const {
    data: permissions,
    isLoading: isPermissionsLoading,
  } = useQuery({
    queryKey: ['effective-permissions', token, authMe?.organisation_id],
    queryFn: () => apiClient<EffectivePermissionsResponse>('/api/v1/organisations/me/effective-permissions'),
    enabled: !!token && !!authMe?.organisation_id,
  });

  const signOut = async () => {
    localStorage.removeItem('zolexora_active_org_id');
    await webAuth.signOut(auth);
    queryClient.clear();
  };

  const isCommander = authMe?.is_commander === true || permissions?.is_commander === true;

  const hasPermission = (module: string, page: string, action: string) => {
    if (isCommander) return true;
    if (!permissions) return false;
    const requiredCap = `${module}.${page}.${action}`;
    return permissions.permissions.includes(requiredCap);
  };

  // Provide session compatibility object for legacy consumers
  const session = token ? { access_token: token, user } : null;

  return {
    session,
    user,
    token,
    authMe,
    organisation,
    permissions,
    isLoading: isSessionLoading || (!!user && (isAuthMeLoading || isOrgLoading || isPermissionsLoading)),
    error: authMeError || orgError,
    isCommander,
    hasPermission,
    signOut,
  };
}
