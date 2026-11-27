import { SESSION_EXPIRED_EVENT, SESSION_STORAGE_KEY } from '@zolexora/auth-client';
import {
  BUSINESS_SESSION_EXPIRED_EVENT,
  loadBusinessSession,
} from '@zolexora/auth-client/business-session';

const BOOTSTRAP_CACHE_KEY = 'zolexora_tms_bootstrap_cache';

/** The active bearer token for TMS API calls (business session preferred, personal Track 1 fallback). */
export function getSessionToken(): string | null {
  const biz = loadBusinessSession();
  if (biz?.access_token) return biz.access_token;
  return getPersonalToken();
}

/** The Track 1 personal Zolexora account token saved by ZolexoraAuthProvider. */
export function getPersonalToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null')?.token ?? null;
  } catch {
    return null;
  }
}

export function loadBootstrapCache<T>(token: string | null, orgId: string | null): T | undefined {
  if (!token || typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { token?: string; orgId?: string | null; data?: T };
    if (parsed.token !== token) return undefined;
    if (orgId && parsed.orgId && parsed.orgId !== orgId) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

export function saveBootstrapCache(token: string | null, orgId: string | null, data: unknown): void {
  if (!token || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({ token, orgId, data }));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function clearBootstrapCache(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Notifies auth providers that the active business/personal session is no longer valid. */
export function expireSession(mode: 'business' | 'all' = 'all'): void {
  clearBootstrapCache();
  if (loadBusinessSession()) {
    window.dispatchEvent(new CustomEvent(BUSINESS_SESSION_EXPIRED_EVENT));
  }
  if (mode === 'all') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}
