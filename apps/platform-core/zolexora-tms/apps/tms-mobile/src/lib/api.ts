import { config } from './config';
import { authApi } from './authApi';
import { storage } from './storage';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
/** AuthProvider registers this so an expired/revoked session signs the user out. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function send(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const session = await storage.getBusinessSession();
  if (session?.org?.zolexora_org_id && !headers['X-Organization-Id']) {
    headers['X-Organization-Id'] = session.org.zolexora_org_id;
  }
  return fetch(`${config.apiBaseUrl()}${path}`, { ...options, headers });
}

/** Calls the TMS backend with a fresh ES256 business session token (retrying once on 401 via refresh). */
export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let token = await authApi.getValidAccessToken();
  let response = await send(path, options, token);

  if (response.status === 401) {
    const refreshed = await authApi.refreshSession().catch(() => null);
    if (refreshed?.access_token) {
      response = await send(path, options, refreshed.access_token);
    }
  }

  if (response.status === 401) {
    onUnauthorized?.();
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      detail = body.error?.message || body.detail || detail;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(detail, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
