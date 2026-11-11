import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth as useZolexoraAuth } from '@zolexora/auth-client/react';
import {
  BUSINESS_SESSION_EXPIRED_EVENT,
  getBusinessAccessToken,
  loadBusinessSession,
  openBusinessSession,
  refreshBusinessSession,
  signOutBusiness,
} from '@zolexora/auth-client/business-session';
import { AUTH_SERVICE_PUBLIC_URL, IMS_PRODUCT } from './runtime';

/**
 * IMS session = a Zolexora business session for product "zolexora-ims" (ADR 0004/0005).
 * Owners sign in with their Zolexora account and pick a business; employees sign in straight into one.
 * Who they are, the business, the role and the ims:* permissions come from the auth service.
 */
export interface ImsUser {
  member_id: string;
  kind: 'person' | 'employee';
  zolexora_id: string | null;
  email: string | null;
  phone_number: string | null;
  name: string;
}

interface Me {
  user: ImsUser;
  org: { zolexora_org_id: string; name: string; status: string; business_kind: string | null };
  role: string | null;
  permissions: string[];
  mfa_setup_required: boolean;
}

interface AuthContextType {
  /** Signed into a business (null while choosing one). */
  user: ImsUser | null;
  org: Me['org'] | null;
  role: string | null;
  permissions: string[];
  can: (permission: string) => boolean;
  loading: boolean;
  /** Personal Zolexora account signed in (owners), even before a business is chosen. */
  personalSignedIn: boolean;
  enterBusiness: (orgId: string, mfaCode?: string) => Promise<void>;
  /** Loads the session just stored by employee sign-in. */
  adoptSession: () => Promise<void>;
  /** Leaves the business but stays signed into the Zolexora account. */
  switchBusiness: () => Promise<void>;
  signOut: () => Promise<void>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchMe(token: string): Promise<Me | null> {
  const res = await fetch(`${AUTH_SERVICE_PUBLIC_URL()}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error('Zolexora auth service is unavailable.');
  const data = await res.json();
  const u = data.user;
  return {
    ...data,
    user: { ...u, name: u.display_name || u.email?.split('@')[0] || u.phone_number || 'Staff' },
    permissions: data.permissions ?? [],
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const zx = useZolexoraAuth();
  const authUrl = AUTH_SERVICE_PUBLIC_URL();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getBusinessAccessToken(authUrl);
      const next = token ? await fetchMe(token) : null;
      if (token && !next) await signOutBusiness(authUrl);
      setMe(next);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [authUrl]);

  useEffect(() => {
    void load();
    const onExpired = () => setMe(null);
    window.addEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
  }, [load]);

  const enterBusiness = useCallback(
    async (orgId: string, mfaCode?: string) => {
      const personal = await zx.getToken();
      if (!personal) throw new Error('Sign in again.');
      await openBusinessSession(authUrl, personal, { orgId, product: IMS_PRODUCT, mfaCode });
      setLoading(true);
      await load();
    },
    [authUrl, zx, load],
  );

  const adoptSession = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const switchBusiness = useCallback(async () => {
    await signOutBusiness(authUrl);
    setMe(null);
  }, [authUrl]);

  const signOut = useCallback(async () => {
    await signOutBusiness(authUrl);
    setMe(null);
    if (zx.isAuthenticated) await zx.signOut();
  }, [authUrl, zx]);

  /** Same-origin IMS API call with the business token; refreshes once on 401. */
  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const send = (token: string | null) => {
        const headers = new Headers(init?.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(url, { ...init, headers });
      };
      let res = await send(await getBusinessAccessToken(authUrl));
      if (res.status === 401 && loadBusinessSession()) {
        const s = await refreshBusinessSession(authUrl).catch(() => null);
        if (s) res = await send(s.access_token);
      }
      return res;
    },
    [authUrl],
  );

  const permissions = me?.permissions ?? [];
  const can = useCallback((p: string) => permissions.includes(p), [permissions]);

  return (
    <AuthContext.Provider
      value={{
        user: me?.user ?? null,
        org: me?.org ?? null,
        role: me?.role ?? null,
        permissions,
        can,
        loading: loading || zx.loading,
        personalSignedIn: zx.isAuthenticated,
        enterBusiness,
        adoptSession,
        switchBusiness,
        signOut,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
