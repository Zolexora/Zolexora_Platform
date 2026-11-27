import { config } from './config';
import { storage } from './storage';
import type { BusinessOption, BusinessSession } from '../types/tms';

export class AuthApiError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export type EmployeeLoginResult =
  | { status: 'signed_in'; session: BusinessSession }
  | { status: 'choose_business'; login_ticket: string; businesses: BusinessOption[] }
  | { status: 'mfa_required'; mfa_ticket: string };

interface SessionResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  session_id: string;
  org: { zolexora_org_id: string; name: string; role: string | null };
}

function toSession(res: SessionResponse): BusinessSession {
  return {
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    expires_at: Date.now() + res.expires_in * 1000,
    session_id: res.session_id,
    org: res.org,
  };
}

async function authFetch<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown; turnstile?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.turnstile) headers['CF-Turnstile-Token'] = init.turnstile;

  const res = await fetch(`${config.authServiceUrl()}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new AuthApiError(
      data.message || data.error?.message || `Auth request failed (${res.status})`,
      data.code || data.error?.code || 'UNKNOWN',
      res.status,
    );
  }
  return data as T;
}

const TMS_PRODUCT = 'tms';
let refreshPromise: Promise<BusinessSession | null> | null = null;

export const authApi = {
  /** Track 1 personal password login; returns personal Zolexora token for /me/organizations + /auth/org-session. */
  async track1Login(params: { identifier: string; password: string; turnstileToken: string }) {
    const trimmed = params.identifier.trim();
    const isPhone = /^\+?[\d\s\-()]{8,}$/.test(trimmed);
    const data = await authFetch<{
      customToken: string;
      user: { uid: string; zolexora_id: string; email: string | null; phone_number: string | null; display_name: string | null };
    }>('/api/v1/auth/public/login', {
      turnstile: params.turnstileToken,
      headers: { 'X-Target-Product': TMS_PRODUCT },
      body: {
        ...(isPhone ? { phone_number: trimmed } : { email: trimmed }),
        password: params.password,
        product: TMS_PRODUCT,
        turnstile_token: params.turnstileToken,
      },
    });
    await storage.setPersonalToken(data.customToken);
    return data;
  },

  async listBusinesses(personalToken: string): Promise<BusinessOption[]> {
    const res = await authFetch<{ organizations: BusinessOption[] }>('/api/v1/me/organizations', {
      token: personalToken,
    });
    return res.organizations;
  },

  async openBusinessSession(
    personalToken: string,
    params: { orgId: string; mfaCode?: string },
  ): Promise<BusinessSession> {
    const body: Record<string, string> = { org_id: params.orgId, product: TMS_PRODUCT };
    if (params.mfaCode) body.mfa_code = params.mfaCode;
    const raw = await authFetch<SessionResponse>('/api/v1/auth/org-session', {
      token: personalToken,
      body,
    });
    const session = toSession(raw);
    await storage.setBusinessSession(session);
    return session;
  },

  /** Track 2 staff/driver/vendor/supervisor login (org_id optional when email/phone resolves a single org). */
  async track2Login(params: {
    orgId?: string;
    identifier?: string;
    password?: string;
    loginTicket?: string;
    turnstileToken?: string;
  }): Promise<EmployeeLoginResult> {
    const res = await authFetch<any>('/api/v1/auth/employee/login', {
      turnstile: params.turnstileToken,
      body: {
        product: TMS_PRODUCT,
        org_id: params.orgId?.trim() ? params.orgId.trim().toUpperCase() : undefined,
        user_id_or_email: params.identifier?.trim(),
        password: params.password,
        login_ticket: params.loginTicket,
        turnstile_token: params.turnstileToken,
      },
    });
    if (res.choose_business) {
      return { status: 'choose_business', login_ticket: res.login_ticket, businesses: res.businesses };
    }
    if (res.mfa_required) {
      return { status: 'mfa_required', mfa_ticket: res.mfa_ticket };
    }
    if (!res.access_token || !res.refresh_token) {
      throw new AuthApiError('Auth service did not return a business session token.', 'NO_SESSION', 500);
    }
    const session = toSession(res as SessionResponse);
    await storage.setBusinessSession(session);
    return { status: 'signed_in', session };
  },

  async verifyTrack2Mfa(mfaTicket: string, code: string): Promise<BusinessSession> {
    const raw = await authFetch<SessionResponse>('/api/v1/auth/employee/mfa', {
      body: { mfa_ticket: mfaTicket, code: code.trim() },
    });
    const session = toSession(raw);
    await storage.setBusinessSession(session);
    return session;
  },

  /** Single-flight refresh token rotation. */
  async refreshSession(): Promise<BusinessSession | null> {
    const current = await storage.getBusinessSession();
    if (!current?.refresh_token) return null;
    if (!refreshPromise) {
      refreshPromise = authFetch<SessionResponse>('/api/v1/auth/token/refresh', {
        body: { refresh_token: current.refresh_token },
      })
        .then(async (r) => {
          const next = toSession({ ...r, org: r.org ?? current.org });
          await storage.setBusinessSession(next);
          return next;
        })
        .catch(async (err) => {
          if (err instanceof AuthApiError && err.status < 500) {
            await storage.clearSession();
            return null;
          }
          throw err;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  },

  async getValidAccessToken(): Promise<string | null> {
    const session = await storage.getBusinessSession();
    if (!session) return storage.getToken();
    if (session.expires_at - Date.now() > 60_000) return session.access_token;
    const refreshed = await this.refreshSession().catch(() => null);
    return refreshed?.access_token ?? session.access_token;
  },

  async logout(): Promise<void> {
    const session = await storage.getBusinessSession();
    await storage.clearSession();
    if (session?.access_token) {
      await authFetch('/api/v1/auth/session/logout', {
        token: session.access_token,
        body: {},
      }).catch(() => {});
    }
  },
};
