/**
 * Business sessions (ADR 0004 §3a, ADR 0005 §5/§6): acting for one business in one product.
 *
 * A person signs in (personal token), picks or creates a business, then opens a business session.
 * An employee signs in straight into a business session. The session is a 15-minute access token
 * carrying org_id, role and the product's permissions, plus a rotating refresh token.
 * Framework-free: works in any browser app.
 */

export const BUSINESS_SESSION_STORAGE_KEY = "zolexora_business_session";
export const BUSINESS_SESSION_EXPIRED_EVENT = "zolexora:business-session-expired";

export interface Business {
  zolexora_org_id: string;
  name: string;
  status?: string;
  legal_name?: string | null;
  trade_name?: string | null;
  business_kind?: string | null;
  pan_last4?: string | null;
  role?: string | null;
  role_name?: string | null;
  member_status?: string;
}

export interface CreateBusinessInput {
  pan: string;
  legal_name: string;
  trade_name?: string | null;
  /** Required for a personal PAN (4th letter P). */
  has_business_registration?: boolean;
  /** Required for a firm PAN (4th letter F). */
  has_llpin?: boolean;
  email?: string | null;
  phone?: string | null;
  activity_primary?: string | null;
}

export interface BusinessSession {
  access_token: string;
  refresh_token: string;
  /** Epoch milliseconds. */
  expires_at: number;
  session_id: string;
  org: { zolexora_org_id: string; name: string; role: string | null };
}

/** Employee login asked the person to pick a business, or for an authenticator code. */
export type EmployeeSignInResult =
  | { status: "signed_in"; session: BusinessSession }
  | { status: "choose_business"; login_ticket: string; businesses: { zolexora_org_id: string; name: string }[] }
  | { status: "mfa_required"; mfa_ticket: string };

export class AuthServiceError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
    this.name = "AuthServiceError";
  }
}

const trim = (url: string) => url.replace(/\/+$/, "");

async function call<T>(authUrl: string, path: string, init: { method?: string; token?: string; body?: unknown; turnstile?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.turnstile) headers["CF-Turnstile-Token"] = init.turnstile;
  const res = await fetch(`${trim(authUrl)}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new AuthServiceError(data.message || data.error?.message || "Request failed", data.code || data.error?.code || "UNKNOWN", res.status);
  }
  return data as T;
}

const storage = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function loadBusinessSession(): BusinessSession | null {
  try {
    return JSON.parse(storage()?.getItem(BUSINESS_SESSION_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function save(session: BusinessSession | null): BusinessSession | null {
  const s = storage();
  if (session) s?.setItem(BUSINESS_SESSION_STORAGE_KEY, JSON.stringify(session));
  else s?.removeItem(BUSINESS_SESSION_STORAGE_KEY);
  return session;
}

interface SessionResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  session_id: string;
  org: { zolexora_org_id: string; name: string; role: string | null };
}

const toSession = (r: SessionResponse): BusinessSession => ({
  access_token: r.access_token,
  refresh_token: r.refresh_token,
  expires_at: Date.now() + r.expires_in * 1000,
  session_id: r.session_id,
  org: r.org,
});

/** Businesses the signed-in person belongs to (personal token). */
export async function listBusinesses(authUrl: string, personalToken: string): Promise<Business[]> {
  return (await call<{ organizations: Business[] }>(authUrl, "/api/v1/me/organizations", { token: personalToken })).organizations;
}

/** Creates a business owned by the signed-in person (personal token). */
export async function createBusiness(authUrl: string, personalToken: string, input: CreateBusinessInput): Promise<Business> {
  return (await call<{ organization: Business }>(authUrl, "/api/v1/organizations", { token: personalToken, body: input })).organization;
}

/** "Continue as <business>" in a product. Throws AuthServiceError AUTH_MFA_REQUIRED when a code is needed. */
export async function openBusinessSession(
  authUrl: string,
  personalToken: string,
  params: { orgId: string; product: string; mfaCode?: string },
): Promise<BusinessSession> {
  const body: Record<string, string> = { org_id: params.orgId, product: params.product };
  if (params.mfaCode) body.mfa_code = params.mfaCode;
  return save(toSession(await call<SessionResponse>(authUrl, "/api/v1/auth/org-session", { token: personalToken, body })))!;
}

/** Employee (Track 2) login. Pass loginTicket + orgId to finish a "choose business" step. */
export async function employeeSignIn(
  authUrl: string,
  params: { product: string; identifier?: string; password?: string; orgId?: string; loginTicket?: string; turnstileToken?: string },
): Promise<EmployeeSignInResult> {
  const r = await call<any>(authUrl, "/api/v1/auth/employee/login", {
    turnstile: params.turnstileToken,
    body: {
      product: params.product,
      org_id: params.orgId || undefined,
      user_id_or_email: params.identifier,
      password: params.password,
      login_ticket: params.loginTicket,
      turnstile_token: params.turnstileToken,
    },
  });
  if (r.choose_business) return { status: "choose_business", login_ticket: r.login_ticket, businesses: r.businesses };
  if (r.mfa_required) return { status: "mfa_required", mfa_ticket: r.mfa_ticket };
  return { status: "signed_in", session: save(toSession(r))! };
}

/** Employee authenticator-app step. */
export async function employeeVerifyMfa(authUrl: string, mfaTicket: string, code: string): Promise<BusinessSession> {
  return save(toSession(await call<SessionResponse>(authUrl, "/api/v1/auth/employee/mfa", { body: { mfa_ticket: mfaTicket, code } })))!;
}

let refreshing: Promise<BusinessSession | null> | null = null;

function expire(): null {
  save(null);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BUSINESS_SESSION_EXPIRED_EVENT));
  return null;
}

/** Rotates the refresh token. Concurrent callers share one request (a reused refresh token ends the session). */
export function refreshBusinessSession(authUrl: string): Promise<BusinessSession | null> {
  const current = loadBusinessSession();
  if (!current) return Promise.resolve(null);
  refreshing ??= call<SessionResponse>(authUrl, "/api/v1/auth/token/refresh", { body: { refresh_token: current.refresh_token } })
    .then((r) => save(toSession({ ...r, org: r.org ?? current.org })))
    .catch((err) => (err instanceof AuthServiceError && err.status < 500 ? expire() : Promise.reject(err)))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** A valid access token, refreshed when it expires within a minute; null when signed out. */
export async function getBusinessAccessToken(authUrl: string): Promise<string | null> {
  const s = loadBusinessSession();
  if (!s) return null;
  if (s.expires_at - Date.now() > 60_000) return s.access_token;
  return (await refreshBusinessSession(authUrl))?.access_token ?? null;
}

/** Ends the business session on the server and locally. */
export async function signOutBusiness(authUrl: string): Promise<void> {
  const s = loadBusinessSession();
  save(null);
  if (s) await call(authUrl, "/api/v1/auth/session/logout", { token: s.access_token, body: {} }).catch(() => {});
}
