import { SESSION_EXPIRED_EVENT, SESSION_STORAGE_KEY } from '@zolexora/auth-client';

/** The Zolexora auth-service session token saved by ZolexoraAuthProvider. */
export function getSessionToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null')?.token ?? null;
  } catch {
    return null;
  }
}

/** Tells ZolexoraAuthProvider the session is no longer valid (it clears it and signs out). */
export function expireSession(): void {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}
