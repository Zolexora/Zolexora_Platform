import { getSessionToken, expireSession } from './session';
import { runtimeEnv } from './runtime';

export function getApiBaseUrl(): string {
  return runtimeEnv('VITE_API_BASE_URL');
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const baseUrl = getApiBaseUrl();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });

  if (response.status === 401) expireSession();
  if (!response.ok) {
    let detail = 'API request failed';
    try { detail = (await response.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T;
  return response.json();
}
