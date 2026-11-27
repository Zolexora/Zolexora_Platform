/**
 * BusinessSessionGate — protects all business manager routes.
 * Hydrates session from localStorage, redirects to /login if none.
 * Listens for business-session-expired events to redirect automatically.
 */
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store.js";
import { BUSINESS_SESSION_EXPIRED_EVENT } from "@zolexora/auth-client/business-session";

export function BusinessSessionGate() {
  const { session, isLoading, hydrate, clearSession } = useAuthStore();

  useEffect(() => {
    hydrate();
    const onExpired = () => clearSession();
    window.addEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
