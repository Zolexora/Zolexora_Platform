import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth as useZolexoraAuth } from '@zolexora/auth-client/react';
import { apiClient } from '../../lib/api';
import type { AuthBootstrapResponse } from '../../types';

/** Zolexora auth-service session + the caller's TMS workspace context (single-round-trip bootstrap). */
export function useAuth() {
  const queryClient = useQueryClient();
  const { user, loading: isSessionLoading, signOut: zolexoraSignOut } = useZolexoraAuth();
  const token = user ? user.uid : null;
  const activeOrgStorage = typeof window !== 'undefined' ? localStorage.getItem('zolexora_active_org_id') : null;

  const {
    data: bootstrap,
    isLoading: isBootstrapLoading,
    error: bootstrapError,
  } = useQuery({
    queryKey: ['auth-bootstrap', token, activeOrgStorage],
    queryFn: () => apiClient<AuthBootstrapResponse>('/api/v1/auth/bootstrap'),
    enabled: !!token,
  });

  const authMe = bootstrap?.me;
  const organisation = bootstrap?.organisation ?? undefined;
  const permissions = bootstrap?.effective_permissions ?? undefined;
  const runtime = bootstrap?.runtime ?? undefined;

  // Keep localStorage in sync with the active org from the backend bootstrap response
  useEffect(() => {
    if (authMe?.organisation_id) {
      localStorage.setItem('zolexora_active_org_id', authMe.organisation_id);
    } else if (!isBootstrapLoading && !authMe) {
      localStorage.removeItem('zolexora_active_org_id');
    }
  }, [authMe?.organisation_id, isBootstrapLoading, authMe]);

  const signOut = async () => {
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
