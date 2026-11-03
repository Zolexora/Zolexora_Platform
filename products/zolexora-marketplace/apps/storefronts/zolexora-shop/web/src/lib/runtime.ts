/**
 * Runtime configuration, read by the server from its environment (Infisical) on every request and
 * handed to the browser by the root layout. Nothing is baked in at build time; there are no fallbacks.
 */
export interface RuntimeConfig {
  apiUrl: string;
  authServiceUrl: string;
  turnstileSiteKey: string;
  firebase: { apiKey: string; authDomain: string; projectId: string; appId: string };
}

/** Server only: the public, browser-safe values from the environment. */
export function readRuntimeConfig(): RuntimeConfig {
  const env = (key: string) => (process.env[key] || "").trim();
  return {
    apiUrl: env("MARKETPLACE_API_URL").replace(/\/+$/, ""),
    authServiceUrl: env("AUTH_SERVICE_PUBLIC_URL").replace(/\/+$/, ""),
    turnstileSiteKey: env("TURNSTILE_SITE_KEY"),
    firebase: {
      apiKey: env("FIREBASE_WEB_API_KEY"),
      authDomain: env("FIREBASE_WEB_AUTH_DOMAIN"),
      projectId: env("FIREBASE_WEB_PROJECT_ID"),
      appId: env("FIREBASE_WEB_APP_ID"),
    },
  };
}

let current: RuntimeConfig | null = null;

export function setRuntimeConfig(config: RuntimeConfig): void {
  current = config;
}

export function runtimeConfig(): RuntimeConfig {
  if (!current) throw new Error("Runtime configuration is not loaded.");
  return current;
}
