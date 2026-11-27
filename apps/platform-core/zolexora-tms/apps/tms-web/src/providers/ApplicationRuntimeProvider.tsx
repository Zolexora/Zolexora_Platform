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
    operations: {
      name: 'Operations',
      enabled: true,
      pages: {
        bookings: { name: 'Bookings', enabled: true, actions: {} },
        duties: { name: 'Duties', enabled: true, actions: {} },
        dispatch: { name: 'Dispatch', enabled: true, actions: {} },
      },
    },
    finance: {
      name: 'Finance',
      enabled: true,
      pages: {
        billing: { name: 'Billing', enabled: true, actions: {} },
      },
    },
    fleet: { name: 'Fleet', enabled: true, pages: {} },
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
  const { user, authMe, runtime: bootstrapRuntime } = useAuth();
  
  const { data: runtimeConfig, isLoading, error } = useQuery<RuntimeConfiguration>({
    queryKey: ['application-runtime', user?.uid, authMe?.organisation_id],
    queryFn: () => apiClient<RuntimeConfiguration>('/api/v1/application/runtime'),
    enabled: !!user && !!authMe?.organisation_id && !bootstrapRuntime,
    staleTime: 1000 * 60 * 5, // Cache for 5 mins
  });

  if (!user) {
    return (
      <ApplicationRuntimeContext.Provider value={defaultRuntimeConfig}>
        {children}
      </ApplicationRuntimeContext.Provider>
    );
  }

  if (!bootstrapRuntime && isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-navy-300 mb-4" />
        <p className="text-sm font-medium">Loading Application Configuration...</p>
      </div>
    );
  }

  const activeConfig = bootstrapRuntime ?? ((!error && runtimeConfig) ? runtimeConfig : defaultRuntimeConfig);

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
