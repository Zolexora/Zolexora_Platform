import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DriverProfile, TenantContext } from '../types/tms';
import { storage } from '../lib/storage';
import { config } from '../lib/config';
import { apiClient, setUnauthorizedHandler } from '../lib/api';

interface EmployeeLogin {
  orgId: string; // ZX-ORG-XXXX-XXXX-XXXX
  userIdOrEmail: string;
  password: string;
  turnstileToken: string;
}

interface AuthContextType {
  user: DriverProfile | null;
  activeOrg: TenantContext | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (params: EmployeeLogin) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Drivers sign in with their organisation's Zolexora auth-service employee login (Track 2). */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DriverProfile | null>(null);
  const [activeOrg, setActiveOrg] = useState<TenantContext | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(async () => {
    await storage.clearSession();
    setUser(null);
    setActiveOrg(null);
    setUid(null);
  }, []);

  /** Loads the TMS workspace and the driver record for the stored session. */
  const loadContext = useCallback(async () => {
    const me = await apiClient<{ user_id: string; organisation_id: string | null }>('/api/v1/auth/me');
    if (!me.organisation_id) {
      throw new Error('Your organisation is not linked to a TMS workspace. Contact your fleet manager.');
    }
    const [org, driver] = await Promise.all([
      apiClient<{ id: string; name: string }>('/api/v1/organisations/me'),
      apiClient<{ id: string; full_name: string; phone: string; email: string | null; license_number: string; license_expiry: string | null }>(
        '/api/v1/drivers/me'
      ),
    ]);
    setUid(me.user_id);
    setActiveOrg({ organisation_id: org.id, organisation_name: org.name });
    setUser({
      id: driver.id,
      name: driver.full_name,
      phone: driver.phone,
      email: driver.email ?? '',
      license_number: driver.license_number,
      license_expiry: driver.license_expiry,
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
    });
    (async () => {
      try {
        if (await storage.getToken()) await loadContext();
      } catch (e: any) {
        setError(e?.message ?? null);
        await clear();
      } finally {
        setIsLoading(false);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear, loadContext]);

  const login = async ({ orgId, userIdOrEmail, password, turnstileToken }: EmployeeLogin) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${config.authServiceUrl()}/api/v1/auth/employee/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'zolexora-tms',
          org_id: orgId.trim().toUpperCase(),
          user_id_or_email: userIdOrEmail.trim(),
          password,
          turnstile_token: turnstileToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.customToken) {
        throw new Error(data.message || data.error?.message || 'Sign-in failed');
      }
      await storage.setToken(data.customToken);
      await loadContext();
    } catch (e: any) {
      await clear();
      setError(e?.message ?? 'Sign-in failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const token = await storage.getToken();
    if (token && uid) {
      // Revoke at the auth service; sign out locally even if it is unreachable
      await fetch(`${config.authServiceUrl()}/api/v1/auth/tokens/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, reason: 'user_logout', revocation_type: 'user_all_tokens' }),
      }).catch(() => {});
    }
    await clear();
  };

  return (
    <AuthContext.Provider
      value={{ user, activeOrg, isAuthenticated: !!user, isLoading, error, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
