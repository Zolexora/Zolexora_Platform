"use client";
import { ZolexoraAuthProvider } from "@zolexora/auth-client/react";
import { setRuntimeConfig, type RuntimeConfig } from "@/lib/runtime";

export default function Providers({ config, children }: { config: RuntimeConfig; children: React.ReactNode }) {
  setRuntimeConfig(config);
  return (
    <ZolexoraAuthProvider authUrl={config.authServiceUrl} product="marketplace">
      {children}
    </ZolexoraAuthProvider>
  );
}
