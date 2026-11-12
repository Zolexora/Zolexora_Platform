"use client";
import { useEffect } from "react";
import { ZolexoraAuthProvider, useAuth } from "@zolexora/auth-client/react";
import { setRuntimeConfig, type RuntimeConfig } from "@/lib/runtime";
import { useAuthStore } from "@/store";

/** Keeps the marketplace profile in step with the Zolexora auth-service session. */
function SessionSync() {
  const { user: session, loading, signOut } = useAuth();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const clear = useAuthStore((s) => s.clear);
  const setSignOut = useAuthStore((s) => s.setSignOut);

  useEffect(() => setSignOut(signOut), [signOut, setSignOut]);
  useEffect(() => {
    if (loading) return;
    if (session) void fetchMe();
    else clear();
  }, [session, loading, fetchMe, clear]);
  return null;
}

export default function Providers({ config, children }: { config: RuntimeConfig; children: React.ReactNode }) {
  setRuntimeConfig(config);
  return (
    <ZolexoraAuthProvider authUrl={config.authServiceUrl} product="marketplace">
      <SessionSync />
      {children}
    </ZolexoraAuthProvider>
  );
}
