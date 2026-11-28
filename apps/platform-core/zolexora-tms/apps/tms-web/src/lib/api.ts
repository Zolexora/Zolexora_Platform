import {
  getBusinessAccessToken,
  loadBusinessSession,
  refreshBusinessSession,
} from '@zolexora/auth-client/business-session';
import { expireSession, getPersonalToken } from './session';
import { AUTH_SERVICE_PUBLIC_URL, runtimeEnv } from './runtime';

export function getApiBaseUrl(): string {
  return runtimeEnv('VITE_API_BASE_URL');
}

async function resolveBearerToken(): Promise<{ token: string | null; isBusiness: boolean }> {
  const authUrl = AUTH_SERVICE_PUBLIC_URL();
  if (authUrl && loadBusinessSession()) {
    const token = await getBusinessAccessToken(authUrl);
    if (token) return { token, isBusiness: true };
  }
  return { token: getPersonalToken(), isBusiness: false };
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const buildHeaders = (token: string | null) => {
    const headers = new Headers(options.headers || {});
    // Let the browser set the multipart boundary for uploads
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const activeOrgId = localStorage.getItem('zolexora_active_org_id');
    if (activeOrgId) {
      headers.set('X-Organization-Id', activeOrgId);
    }
    return headers;
  };

  const { token, isBusiness } = await resolveBearerToken();
  let response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: buildHeaders(token),
  });

  if (response.status === 401 && isBusiness && loadBusinessSession()) {
    const refreshed = await refreshBusinessSession(AUTH_SERVICE_PUBLIC_URL()).catch(() => null);
    if (refreshed?.access_token) {
      response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: buildHeaders(refreshed.access_token),
      });
    }
  }

  if (response.status === 401) {
    expireSession(isBusiness ? 'business' : 'all');
  }

  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error?.message || errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return response.json();
}

export async function downloadApiBlob(endpoint: string, fallbackFilename: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const buildHeaders = (token: string | null) => {
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const activeOrgId = localStorage.getItem('zolexora_active_org_id');
    if (activeOrgId) headers.set('X-Organization-Id', activeOrgId);
    return headers;
  };

  const { token, isBusiness } = await resolveBearerToken();
  let response = await fetch(`${baseUrl}${endpoint}`, { headers: buildHeaders(token) });

  if (response.status === 401 && isBusiness && loadBusinessSession()) {
    const refreshed = await refreshBusinessSession(AUTH_SERVICE_PUBLIC_URL()).catch(() => null);
    if (refreshed?.access_token) {
      response = await fetch(`${baseUrl}${endpoint}`, { headers: buildHeaders(refreshed.access_token) });
    }
  }

  if (!response.ok) {
    let errorDetail = 'Download failed';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error?.message || errorJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
