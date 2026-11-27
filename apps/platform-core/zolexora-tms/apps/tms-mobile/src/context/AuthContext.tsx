import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BusinessOption,
  BusinessSession,
  DriverProfile,
  MobileBootstrapResponse,
  MobilePersona,
  OrganisationSummary,
  TenantContext,
  UserMe,
  VendorProfile,
} from '../types/tms';
import { storage } from '../lib/storage';
import { authApi, EmployeeLoginResult } from '../lib/authApi';
import { apiClient, setUnauthorizedHandler } from '../lib/api';
import { resolvePersonas } from '../lib/personas';

interface Track2LoginParams {
  orgId?: string;
  identifier?: string;
  password?: string;
  loginTicket?: string;
  turnstileToken?: string;
}

interface AuthContextType {
  user: DriverProfile | null;
  driver: DriverProfile | null;
  vendor: VendorProfile | null;
  me: UserMe | null;
  organisation: OrganisationSummary | null;
  activeOrg: TenantContext | null;
  session: BusinessSession | null;
  bootstrap: MobileBootstrapResponse | null;
  permissions: string[];
  persona: MobilePersona;
  availableModes: MobilePersona[];
  activeMode: MobilePersona;
  setActiveMode: (mode: MobilePersona) => void;
  businesses: BusinessOption[];
  hasPersonalSession: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginTrack1: (params: { identifier: string; password: string; turnstileToken: string }) => Promise<BusinessOption[]>;
  selectTrack1Business: (orgId: string, mfaCode?: string) => Promise<void>;
  loginTrack2: (params: Track2LoginParams) => Promise<EmployeeLoginResult>;
  completeTrack2Mfa: (mfaTicket: string, code: string) => Promise<void>;
  switchBusiness: (orgId: string, mfaCode?: string) => Promise<void>;
  refreshContext: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toDriverProfile(raw: MobileBootstrapResponse['driver']): DriverProfile | null {
  if (!raw) return null;
  return {
    id: raw.id,
    full_name: raw.full_name,
    name: raw.full_name,
    phone: raw.phone,
    email: raw.email ?? '',
    vendor_id: raw.vendor_id,
    driver_type: raw.driver_type,
    status: raw.status,
    license_number: raw.license_number,
    license_type: raw.license_type,
    license_expiry: raw.license_expiry,
  };
}

/** Unified role-adaptive auth context for Track 1 (Owner/Client) & Track 2 (Driver/Vendor/Staff). */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bootstrap, setBootstrap] = useState<MobileBootstrapResponse | null>(null);
  const [session, setSession] = useState<BusinessSession | null>(null);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [hasPersonalSession, setHasPersonalSession] = useState(false);
  const [activeModeState, setActiveModeState] = useState<MobilePersona | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(async () => {
    await storage.clearSession();
    setBootstrap(null);
    setSession(null);
    setBusinesses([]);
    setHasPersonalSession(false);
    setActiveModeState(null);
  }, []);

  const loadContext = useCallback(async () => {
    const [boot, storedSession, personalToken, savedMode] = await Promise.all([
      apiClient<MobileBootstrapResponse>('/api/v1/auth/mobile-bootstrap'),
      storage.getBusinessSession(),
      storage.getPersonalToken(),
      storage.getActiveMode(),
    ]);

    if (!boot.me.organisation_id || !boot.organisation) {
      throw new Error('No active TMS workspace is linked to this account yet. Complete onboarding on web or contact your admin.');
    }

    setBootstrap(boot);
    setSession(storedSession);
    setHasPersonalSession(!!personalToken);

    const resolved = resolvePersonas(boot);
    if (savedMode && resolved.available.includes(savedMode)) {
      setActiveModeState(savedMode);
    } else {
      setActiveModeState(resolved.primary);
    }

    if (personalToken) {
      authApi.listBusinesses(personalToken).then(setBusinesses).catch(() => {});
    } else {
      setBusinesses([]);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
    });
    (async () => {
      try {
        const token = await storage.getToken();
        if (token) await loadContext();
      } catch (e: any) {
        setError(e?.message ?? null);
        await clear();
      } finally {
        setIsLoading(false);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear, loadContext]);

  const setActiveMode = useCallback((mode: MobilePersona) => {
    setActiveModeState(mode);
    storage.setActiveMode(mode).catch(() => {});
  }, []);

  const loginTrack1 = async ({ identifier, password, turnstileToken }: { identifier: string; password: string; turnstileToken: string }) => {
    setError(null);
    setIsLoading(true);
    try {
      const loginRes = await authApi.track1Login({ identifier, password, turnstileToken });
      const orgs = await authApi.listBusinesses(loginRes.customToken);
      setHasPersonalSession(true);
      setBusinesses(orgs);
      return orgs;
    } catch (e: any) {
      await clear();
      setError(e?.message ?? 'Sign-in failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const selectTrack1Business = async (orgId: string, mfaCode?: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const personalToken = await storage.getPersonalToken();
      if (!personalToken) throw new Error('Personal session expired. Please sign in again.');
      await authApi.openBusinessSession(personalToken, { orgId, mfaCode });
      await loadContext();
    } catch (e: any) {
      setError(e?.message ?? 'Unable to open workspace');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const loginTrack2 = async (params: Track2LoginParams): Promise<EmployeeLoginResult> => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await authApi.track2Login(params);
      if (res.status === 'signed_in') {
        await loadContext();
      }
      return res;
    } catch (e: any) {
      setError(e?.message ?? 'Sign-in failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const completeTrack2Mfa = async (mfaTicket: string, code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authApi.verifyTrack2Mfa(mfaTicket, code);
      await loadContext();
    } catch (e: any) {
      setError(e?.message ?? 'Verification failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const switchBusiness = async (orgId: string, mfaCode?: string) => {
    await selectTrack1Business(orgId, mfaCode);
  };

  const refreshContext = async () => {
    await loadContext();
  };

  const logout = async () => {
    await authApi.logout();
    setBootstrap(null);
    setSession(null);
    setBusinesses([]);
    setHasPersonalSession(false);
    setActiveModeState(null);
  };

  const driver = useMemo(() => toDriverProfile(bootstrap?.driver), [bootstrap]);
  const vendor = bootstrap?.vendor ?? null;
  const me = bootstrap?.me ?? null;
  const organisation = bootstrap?.organisation ?? null;
  const activeOrg = useMemo<TenantContext | null>(
    () => (organisation ? { organisation_id: organisation.id, organisation_name: organisation.name } : null),
    [organisation],
  );
  const permissions = bootstrap?.effective_permissions?.permissions ?? [];
  const { primary: persona, available: availableModes } = useMemo(() => resolvePersonas(bootstrap), [bootstrap]);
  const activeMode = activeModeState && availableModes.includes(activeModeState) ? activeModeState : persona;

  return (
    <AuthContext.Provider
      value={{
        user: driver,
        driver,
        vendor,
        me,
        organisation,
        activeOrg,
        session,
        bootstrap,
        permissions,
        persona,
        availableModes,
        activeMode,
        setActiveMode,
        businesses,
        hasPersonalSession,
        isAuthenticated: !!bootstrap?.me?.organisation_id,
        isLoading,
        error,
        loginTrack1,
        selectTrack1Business,
        loginTrack2,
        completeTrack2Mfa,
        switchBusiness,
        refreshContext,
        logout,
      }}
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
