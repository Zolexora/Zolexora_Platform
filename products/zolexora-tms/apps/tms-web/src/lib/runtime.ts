/**
 * Runtime config. In Docker, docker-entrypoint-env.sh writes window.__ENV__ from the container
 * environment (Infisical); in `vite dev` the same keys come from the Infisical-injected env.
 * There are no fallbacks: a missing key is a configuration error.
 */
declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

export function runtimeEnv(key: string): string {
  const fromWindow = typeof window !== 'undefined' ? window.__ENV__?.[key] : undefined;
  return (fromWindow ?? (import.meta.env as Record<string, string | undefined>)[key] ?? '').trim();
}

export const AUTH_SERVICE_PUBLIC_URL = () => runtimeEnv('AUTH_SERVICE_PUBLIC_URL').replace(/\/$/, '');
export const TURNSTILE_SITE_KEY = () => runtimeEnv('TURNSTILE_SITE_KEY');

/** Firebase web app config (Track 1 Google / phone sign-in). Public, browser-safe values. */
export const FIREBASE_WEB_CONFIG = () => ({
  apiKey: runtimeEnv('NEXT_PUBLIC_TMS_CLIENT_FIREBASE_API_KEY'),
  authDomain: runtimeEnv('NEXT_PUBLIC_TMS_CLIENT_FIREBASE_AUTH_DOMAIN'),
  projectId: runtimeEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  appId: runtimeEnv('NEXT_PUBLIC_TMS_CLIENT_FIREBASE_APP_ID'),
});
