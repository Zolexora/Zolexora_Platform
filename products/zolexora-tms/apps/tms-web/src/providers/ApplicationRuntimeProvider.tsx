import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { RuntimeConfiguration } from '../types/runtime';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';

const defaultRuntimeConfig: RuntimeConfiguration = {
  application: { id: 'zolexora-tms', name: 'Zolexora TMS', type: 'STANDARD', version: '1.0.0', status: 'ACTIVE' },
  branding: { application_name: 'Zolexora TMS', logo_url: null, theme: {} },
  modules: {
    bookings: { name: 'Bookings', enabled: true, pages: {} },
    duties: { name: 'Duties', enabled: true, pages: {} },
    billing: { name: 'Billing', enabled: true, pages: {} },
    fleet: { name: 'Fleet', enabled: true, pages: {} },
    dispatch: { name: 'Dispatch', enabled: true, pages: {} },
  },
  features: {},
  navigation: [],
  terminology: {},
  forms: {},
  workflows: {},
  rules: {},
  approvals: {},
  dashboard: {},
  reports: {},
  notifications: {},
  documents: {},
  numbering: {},
  extensions: {},
};

const ApplicationRuntimeContext = createContext<RuntimeConfiguration>(defaultRuntimeConfig);

export function ApplicationRuntimeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  
  const { data: runtimeConfig, isLoading, error } = useQuery<RuntimeConfiguration>({
    queryKey: ['application-runtime', session?.user?.uid],
    queryFn: () => apiClient<RuntimeConfiguration>('/api/v1/application/runtime'),
    enabled: !!session, // Only fetch when authenticated
    staleTime: 1000 * 60 * 5, // Cache for 5 mins
  });

  if (!session) {
    return (
      <ApplicationRuntimeContext.Provider value={defaultRuntimeConfig}>
        {children}
      </ApplicationRuntimeContext.Provider>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-navy-300 mb-4" />
        <p className="text-sm font-medium">Loading Application Configuration...</p>
      </div>
    );
  }

  const activeConfig = (!error && runtimeConfig) ? runtimeConfig : defaultRuntimeConfig;

  return (
    <ApplicationRuntimeContext.Provider value={activeConfig}>
      {children}
    </ApplicationRuntimeContext.Provider>
  );
}

export function useApplicationRuntime(): RuntimeConfiguration {
  const context = useContext(ApplicationRuntimeContext);
  return context || defaultRuntimeConfig;
}
