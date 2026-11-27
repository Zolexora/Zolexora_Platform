import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth as useZolexoraAuth } from '@zolexora/auth-client/react';
import {
  BUSINESS_SESSION_EXPIRED_EVENT,
  loadBusinessSession,
  openBusinessSession,
  signOutBusiness,
  type BusinessSession,
} from '@zolexora/auth-client/business-session';
import { apiClient } from '../../lib/api';
import { AUTH_SERVICE_PUBLIC_URL } from '../../lib/runtime';
import {
  clearBootstrapCache,
  getSessionToken,
  loadBootstrapCache,
  saveBootstrapCache,
} from '../../lib/session';
import type { AuthBootstrapResponse } from '../../types';

const BUSINESS_SESSION_CHANGED_EVENT = 'zolexora:tms-business-session-changed';

function notifyBusinessSessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BUSINESS_SESSION_CHANGED_EVENT));
  }
}

/** Zolexora auth-service session (Track 1 personal + Track 2/business org-session) + TMS workspace context. */
export function useAuth() {
  const queryClient = useQueryClient();
  const {
    user: personalUser,
    loading: isPersonalLoading,
    getToken: getPersonalTokenFn,
    signOut: signOutPersonal,
  } = useZolexoraAuth();

  const [businessSession, setBusinessSession] = useState<BusinessSession | null>(() => loadBusinessSession());

  useEffect(() => {
    const sync = () => setBusinessSession(loadBusinessSession());
    const onExpired = () => {
      clearBootstrapCache();
      setBusinessSession(null);
    };
    window.addEventListener(BUSINESS_SESSION_CHANGED_EVENT, sync);
    window.addEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener(BUSINESS_SESSION_CHANGED_EVENT, sync);
      window.removeEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const hasBusinessSession = !!businessSession;
  const activeSubjectKey = businessSession
    ? `biz:${businessSession.session_id}:${businessSession.org.zolexora_org_id}`
    : null;
  const sessionToken = hasBusinessSession ? getSessionToken() : null;
  const activeOrgStorage = typeof window !== 'undefined' ? localStorage.getItem('zolexora_active_org_id') : null;

  const cachedBootstrap = useMemo(
    () => (sessionToken ? loadBootstrapCache<AuthBootstrapResponse>(sessionToken, activeOrgStorage) : undefined),
    [sessionToken, activeOrgStorage],
  );

  const {
    data: bootstrap,
    isLoading: isBootstrapLoading,
    error: bootstrapError,
  } = useQuery({
    queryKey: ['auth-bootstrap', activeSubjectKey, activeOrgStorage],
    queryFn: () => apiClient<AuthBootstrapResponse>('/api/v1/auth/bootstrap'),
    enabled: !!activeSubjectKey,
    initialData: cachedBootstrap,
    initialDataUpdatedAt: cachedBootstrap ? 0 : undefined,
  });

  const authMe = bootstrap?.me;
  const organisation = bootstrap?.organisation ?? undefined;
  const permissions = bootstrap?.effective_permissions ?? undefined;
  const runtime = bootstrap?.runtime ?? undefined;

  useEffect(() => {
    if (authMe?.organisation_id) {
      if (sessionToken && bootstrap) {
        saveBootstrapCache(sessionToken, authMe.organisation_id, bootstrap);
      }
      if (activeOrgStorage !== authMe.organisation_id) {
        queryClient.setQueryData(['auth-bootstrap', activeSubjectKey, authMe.organisation_id], bootstrap);
        localStorage.setItem('zolexora_active_org_id', authMe.organisation_id);
      }
    } else if (hasBusinessSession && !isBootstrapLoading && !authMe) {
      clearBootstrapCache();
      localStorage.removeItem('zolexora_active_org_id');
    }
  }, [
    authMe?.organisation_id,
    isBootstrapLoading,
    authMe,
    bootstrap,
    sessionToken,
    activeOrgStorage,
    queryClient,
    activeSubjectKey,
    hasBusinessSession,
  ]);

  const enterBusiness = useCallback(
    async (zxOrgId: string, mfaCode?: string) => {
      const personalToken = await getPersonalTokenFn();
      if (!personalToken) throw new Error('Your Zolexora sign-in expired. Please sign in again.');
      clearBootstrapCache();
      localStorage.removeItem('zolexora_active_org_id');
      await openBusinessSession(AUTH_SERVICE_PUBLIC_URL(), personalToken, {
        orgId: zxOrgId,
        product: 'zolexora-tms',
        mfaCode,
      });
      notifyBusinessSessionChanged();
      await queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
    },
    [getPersonalTokenFn, queryClient],
  );

  const adoptBusinessSession = useCallback(async () => {
    clearBootstrapCache();
    localStorage.removeItem('zolexora_active_org_id');
    notifyBusinessSessionChanged();
    await queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] });
  }, [queryClient]);

  const switchBusiness = useCallback(async () => {
    clearBootstrapCache();
    localStorage.removeItem('zolexora_active_org_id');
    await signOutBusiness(AUTH_SERVICE_PUBLIC_URL());
    notifyBusinessSessionChanged();
    queryClient.clear();
  }, [queryClient]);

  const signOut = useCallback(async () => {
    clearBootstrapCache();
    localStorage.removeItem('zolexora_active_org_id');
    await signOutBusiness(AUTH_SERVICE_PUBLIC_URL());
    notifyBusinessSessionChanged();
    await signOutPersonal();
    queryClient.clear();
  }, [signOutPersonal, queryClient]);

  const isCommander = authMe?.is_commander === true || permissions?.is_commander === true;

  const permissionSet = useMemo(
    () => new Set(permissions?.permissions ?? []),
    [permissions?.permissions],
  );

  const hasPermission = (module: string, page: string, action: string) => {
    if (isCommander) return true;
    if (!permissions) return false;
    return (
      permissionSet.has(`${module}.${page}.${action}`) ||
      permissionSet.has(`tms:${module}_${page}:${action}`)
    );
  };

  const hasAuthPermission = (perm: string) => {
    if (isCommander) return true;
    return permissionSet.has(perm);
  };

  const zolexoraOrgId =
    authMe?.zolexora_org_id ??
    organisation?.zolexora_org_id ??
    businessSession?.org.zolexora_org_id ??
    null;

  const activeUser = useMemo(() => {
    if (authMe) {
      return {
        uid: authMe.user_id,
        zolexora_id: authMe.zolexora_id ?? personalUser?.zolexora_id ?? '',
        email: authMe.email ?? personalUser?.email ?? undefined,
        full_name: authMe.full_name ?? undefined,
        phone_number: authMe.phone_number ?? undefined,
      };
    }
    if (businessSession) {
      return {
        uid: businessSession.session_id,
        zolexora_id: '',
        email: undefined,
      };
    }
    return null;
  }, [authMe, businessSession, personalUser]);

  return {
    user: activeUser,
    personalUser,
    personalSignedIn: !!personalUser,
    businessSession,
    zolexoraOrgId,
    authMe,
    organisation,
    permissions,
    runtime,
    isLoading:
      (!hasBusinessSession && isPersonalLoading) ||
      (hasBusinessSession && isBootstrapLoading),
    error: bootstrapError,
    isCommander,
    hasPermission,
    hasAuthPermission,
    enterBusiness,
    adoptBusinessSession,
    switchBusiness,
    signOut,
  };
}
