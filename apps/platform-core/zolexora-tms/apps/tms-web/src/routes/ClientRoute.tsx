import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { Loader2 } from 'lucide-react';

export function ClientRoute() {
  const { user, businessSession, isLoading, authMe, error } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <span className="text-sm font-medium">Loading Client Portal...</span>
        </div>
      </div>
    );
  }

  if (!user || !businessSession || error) return <Navigate to="/authentication" replace />;
  if (!authMe || !authMe.organisation_id) return <Navigate to="/authentication" replace />;
  // Service providers who land on /client/* get redirected to their dashboard
  if (authMe?.workspace_type && authMe.workspace_type === 'SERVICE_PROVIDER') {
    return <Navigate to="/sp/dashboard" replace />;
  }

  return <Outlet />;
}
