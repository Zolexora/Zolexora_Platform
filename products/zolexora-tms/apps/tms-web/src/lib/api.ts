import { getIdToken } from './firebase';

export function getApiBaseUrl(): string {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.__ENV__?.VITE_API_BASE_URL !== undefined) {
      // @ts-ignore
      return String(window.__ENV__.VITE_API_BASE_URL);
    }
  } catch {}

  try {
    if (import.meta.env.VITE_API_BASE_URL !== undefined) {
      return String(import.meta.env.VITE_API_BASE_URL);
    }
  } catch {}

  return '';
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
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

  return response.json();
}
