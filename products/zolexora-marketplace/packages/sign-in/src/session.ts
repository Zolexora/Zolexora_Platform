import { SESSION_EXPIRED_EVENT, SESSION_STORAGE_KEY } from "@zolexora/auth-client";

/** The Zolexora auth-service session token saved by ZolexoraAuthProvider (browser). */
export function storedSessionToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null")?.token ?? null;
  } catch {
    return null;
  }
}

/** Tells ZolexoraAuthProvider the session is no longer valid (it clears it and signs out). */
export function expireStoredSession(): void {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

const ACTIVE_ORG_KEY = "zolexora_active_org_id";

/** Seller portal: the organisation the owner chose (same key as TMS). Staff don't need one. */
export function activeOrganizationId(): string | null {
  return localStorage.getItem(ACTIVE_ORG_KEY);
}

export function setActiveOrganizationId(orgId: string | null): void {
  if (orgId) localStorage.setItem(ACTIVE_ORG_KEY, orgId);
  else localStorage.removeItem(ACTIVE_ORG_KEY);
}
