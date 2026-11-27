import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth as useZolexoraAuth } from '@zolexora/auth-client/react';
import { apiClient } from '../../lib/api';
import {
  clearBootstrapCache,
  getSessionToken,
  loadBootstrapCache,
  saveBootstrapCache,
} from '../../lib/session';
import type { AuthBootstrapResponse } from '../../types';

/** Zolexora auth-service session + the caller's TMS workspace context (single-round-trip bootstrap). */
export function useAuth() {
  const queryClient = useQueryClient();
  const { user, loading: isSessionLoading, signOut: zolexoraSignOut } = useZolexoraAuth();
  const token = user ? user.uid : null;
  const sessionToken = token ? getSessionToken() : null;
  const activeOrgStorage = typeof window !== 'undefined' ? localStorage.getItem('zolexora_active_org_id') : null;
  const cachedBootstrap = useMemo(
    () => (sessionToken ? loadBootstrapCache<AuthBootstrapResponse>(sessionToken, activeOrgStorage) : undefined),
    [sessionToken, activeOrgStorage]
  );

  const {
    data: bootstrap,
    isLoading: isBootstrapLoading,
    error: bootstrapError,
  } = useQuery({
    queryKey: ['auth-bootstrap', token, activeOrgStorage],
    queryFn: () => apiClient<AuthBootstrapResponse>('/api/v1/auth/bootstrap'),
    enabled: !!token,
    initialData: cachedBootstrap,
    // Revalidate on mount/hard refresh even when seeded from sessionStorage so revoked sessions are caught immediately.
    initialDataUpdatedAt: cachedBootstrap ? 0 : undefined,
  });

  const authMe = bootstrap?.me;
  const organisation = bootstrap?.organisation ?? undefined;
  const permissions = bootstrap?.effective_permissions ?? undefined;
  const runtime = bootstrap?.runtime ?? undefined;

  // Keep localStorage + sessionStorage bootstrap cache in sync with the active org from backend bootstrap
  useEffect(() => {
    if (authMe?.organisation_id) {
      if (sessionToken && bootstrap) {
        saveBootstrapCache(sessionToken, authMe.organisation_id, bootstrap);
      }
      if (activeOrgStorage !== authMe.organisation_id) {
        // Seed the target org's query cache before updating localStorage so changing queryKey does not trigger a duplicate fetch.
        queryClient.setQueryData(['auth-bootstrap', token, authMe.organisation_id], bootstrap);
        localStorage.setItem('zolexora_active_org_id', authMe.organisation_id);
      }
    } else if (!isBootstrapLoading && !authMe) {
      clearBootstrapCache();
      localStorage.removeItem('zolexora_active_org_id');
    }
  }, [authMe?.organisation_id, isBootstrapLoading, authMe, bootstrap, sessionToken, activeOrgStorage, queryClient, token]);

  const signOut = async () => {
    clearBootstrapCache();
    localStorage.removeItem('zolexora_active_org_id');
    await zolexoraSignOut();
    queryClient.clear();
  };

  const isCommander = authMe?.is_commander === true || permissions?.is_commander === true;

  const permissionSet = useMemo(
    () => new Set(permissions?.permissions ?? []),
    [permissions?.permissions]
  );

  const hasPermission = (module: string, page: string, action: string) => {
    if (isCommander) return true;
    if (!permissions) return false;
    return permissionSet.has(`${module}.${page}.${action}`);
  };

  return {
    user,
    authMe,
    organisation,
    permissions,
    runtime,
    isLoading: isSessionLoading || (!!user && isBootstrapLoading),
    error: bootstrapError,
    isCommander,
    hasPermission,
    signOut,
  };
}
