import { DEFAULT_AUTH_SERVICE_URL } from "./constants.js";

/**
 * Isomorphic Runtime Environment Resolver.
 * Next.js SSR & Vite safe: zero window crashes at import or server render time.
 */
export function getRuntimeEnv(key: string): string | undefined {
  // 1. Priority 1: window.__ENV__ (Docker container runtime injection in browser)
  try {
    if (typeof window !== "undefined") {
      const winEnv = (window as any).__ENV__;
      if (winEnv && winEnv[key] !== undefined && winEnv[key] !== "") {
        return String(winEnv[key]);
      }
    }
  } catch {}

  // 2. Priority 2: process.env (Node.js, Next.js SSR, Webpack/Turbopack inlining)
  try {
    if (typeof process !== "undefined" && process?.env) {
      if (process.env[key] !== undefined && process.env[key] !== "") {
        return String(process.env[key]);
      }
    }
  } catch {}

  // 3. Priority 3: import.meta.env (Vite client bundler)
  try {
    const meta = typeof import.meta !== "undefined" ? (import.meta as any) : undefined;
    if (meta?.env && meta.env[key] !== undefined && meta.env[key] !== "") {
      return String(meta.env[key]);
    }
  } catch {}

  return undefined;
}

/**
 * Resolves the Auth Service Base URL using multi-tier environment precedence.
 */
export function resolveAuthUrl(customUrl?: string): string {
  if (customUrl && typeof customUrl === "string" && customUrl.trim() !== "") {
    return customUrl.trim().replace(/\/+$/, "");
  }

  const candidateKeys = [
    "AUTH_SERVICE_URL",
    "NEXT_PUBLIC_AUTH_SERVICE_URL",
    "VITE_AUTH_SERVICE_URL",
    "NEXT_PUBLIC_AUTH_URL",
    "VITE_AUTH_URL",
    "ZOLEXORA_AUTH_URL",
  ];

  for (const key of candidateKeys) {
    const val = getRuntimeEnv(key);
    if (val && typeof val === "string" && val.trim() !== "") {
      return val.trim().replace(/\/+$/, "");
    }
  }

  return DEFAULT_AUTH_SERVICE_URL;
}
