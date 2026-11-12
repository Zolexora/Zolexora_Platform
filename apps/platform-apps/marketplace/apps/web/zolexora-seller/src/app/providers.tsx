"use client";
import { ZolexoraAuthProvider } from "@zolexora/auth-client/react";
import { configureApi } from "@zolexora/shop-shared-api";
import { activeOrganizationId, expireStoredSession, storedSessionToken } from "@zolexora/shop-sign-in";
import { setRuntimeConfig, type RuntimeConfig } from "@/lib/runtime";

export default function Providers({ config, children }: { config: RuntimeConfig; children: React.ReactNode }) {
  setRuntimeConfig(config);
  configureApi({ baseURL: config.apiUrl, getToken: storedSessionToken, onUnauthorized: expireStoredSession, getOrganizationId: activeOrganizationId });
  return (
    <ZolexoraAuthProvider authUrl={config.authServiceUrl} product="marketplace">
      {children}
    </ZolexoraAuthProvider>
  );
}
