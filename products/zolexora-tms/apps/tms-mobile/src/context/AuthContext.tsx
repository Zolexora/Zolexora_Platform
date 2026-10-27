import React, { createContext, useContext, useEffect, useState } from 'react';
import { DriverProfile, TenantContext } from '../types/tms';
import { storage } from '../lib/storage';

interface AuthContextType {
  user: DriverProfile | null;
  activeOrg: TenantContext | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnDuty: boolean;
  login: (emailOrPhone: string, orgId?: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  toggleDutyStatus: () => Promise<void>;
  switchOrg: (orgId: string, orgName: string) => Promise<void>;
}

const DEFAULT_DEMO_DRIVER: DriverProfile = {
  id: 'drv-demo-01',
  name: 'Rajesh Kumar',
  phone: '+91 98200 12345',
  email: 'rajesh.kumar@zolexora-fleet.com',
  license_number: 'MH-14-20180092144',
  license_expiry: '2028-09-15',
  is_on_duty: true,
  active_duty_id: 'd-101',
  assigned_vehicle_reg: 'MH 12 QX 4521',
};

const DEFAULT_ORG: TenantContext = {
  organisation_id: 'org-demo-01',
  organisation_name: 'Zolexora Logistics India Pvt Ltd',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DriverProfile | null>(null);
  const [activeOrg, setActiveOrg] = useState<TenantContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnDuty, setIsOnDuty] = useState(true);

  useEffect(() => {
    async function initSession() {
      try {
        const token = await storage.getToken();
        const storedUser = await storage.getUserData<DriverProfile>();
        const storedOrg = await storage.getActiveOrg();

        if (token && storedUser) {
          setUser(storedUser);
          setIsOnDuty(storedUser.is_on_duty);
          if (storedOrg) {
            setActiveOrg({ organisation_id: storedOrg.id, organisation_name: storedOrg.name });
          }
        } else {
          // Pre-populate with default demo state for immediate testing
          setUser(DEFAULT_DEMO_DRIVER);
          setActiveOrg(DEFAULT_ORG);
          setIsOnDuty(DEFAULT_DEMO_DRIVER.is_on_duty);
          await storage.setToken('demo-jwt-token-zolexora-tms');
          await storage.setUserData(DEFAULT_DEMO_DRIVER);
          await storage.setActiveOrg(DEFAULT_ORG.organisation_id, DEFAULT_ORG.organisation_name);
        }
      } catch {
        // Fallback
        setUser(DEFAULT_DEMO_DRIVER);
        setActiveOrg(DEFAULT_ORG);
      } finally {
        setIsLoading(false);
      }
    }

    initSession();
  }, []);

  const login = async (emailOrPhone: string, orgId?: string) => {
    setIsLoading(true);
    try {
      const profile: DriverProfile = {
        ...DEFAULT_DEMO_DRIVER,
        email: emailOrPhone.includes('@') ? emailOrPhone : DEFAULT_DEMO_DRIVER.email,
        phone: !emailOrPhone.includes('@') ? emailOrPhone : DEFAULT_DEMO_DRIVER.phone,
      };
      const org: TenantContext = {
        organisation_id: orgId || DEFAULT_ORG.organisation_id,
        organisation_name: orgId ? `Org (${orgId})` : DEFAULT_ORG.organisation_name,
      };

      await storage.setToken('auth-token-' + Date.now());
      await storage.setUserData(profile);
      await storage.setActiveOrg(org.organisation_id, org.organisation_name);

      setUser(profile);
      setActiveOrg(org);
      setIsOnDuty(profile.is_on_duty);
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async () => {
    setIsLoading(true);
    try {
      await storage.setToken('demo-jwt-token-zolexora-tms');
      await storage.setUserData(DEFAULT_DEMO_DRIVER);
      await storage.setActiveOrg(DEFAULT_ORG.organisation_id, DEFAULT_ORG.organisation_name);

      setUser(DEFAULT_DEMO_DRIVER);
      setActiveOrg(DEFAULT_ORG);
      setIsOnDuty(DEFAULT_DEMO_DRIVER.is_on_duty);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await storage.clearSession();
      setUser(null);
      setActiveOrg(null);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDutyStatus = async () => {
    const nextState = !isOnDuty;
    setIsOnDuty(nextState);
    if (user) {
      const updated = { ...user, is_on_duty: nextState };
      setUser(updated);
      await storage.setUserData(updated);
    }
  };

  const switchOrg = async (orgId: string, orgName: string) => {
    const org = { organisation_id: orgId, organisation_name: orgName };
    setActiveOrg(org);
    await storage.setActiveOrg(orgId, orgName);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeOrg,
        isAuthenticated: !!user,
        isLoading,
        isOnDuty,
        login,
        loginDemo,
        logout,
        toggleDutyStatus,
        switchOrg,
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
