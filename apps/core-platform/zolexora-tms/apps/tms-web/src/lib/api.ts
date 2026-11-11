import { getSessionToken, expireSession } from './session';
import { runtimeEnv } from './runtime';

export function getApiBaseUrl(): string {
  return runtimeEnv('VITE_API_BASE_URL');
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const baseUrl = getApiBaseUrl();
  
  const headers = new Headers(options.headers || {});
  // Let the browser set the multipart boundary for uploads
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Inject explicit tenant context for the backend
  const activeOrgId = localStorage.getItem('zolexora_active_org_id');
  if (activeOrgId) {
    headers.set('X-Organization-Id', activeOrgId);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    expireSession();
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
