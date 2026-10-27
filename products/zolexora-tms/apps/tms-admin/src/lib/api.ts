import { getIdToken } from './firebase';

export function getApiBaseUrl(): string {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.__ENV__?.VITE_API_BASE_URL) {
      // @ts-ignore
      return String(window.__ENV__.VITE_API_BASE_URL);
    }
  } catch {}
  try {
    if (import.meta.env.VITE_API_BASE_URL) return String(import.meta.env.VITE_API_BASE_URL);
  } catch {}
  return '';
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const baseUrl = getApiBaseUrl();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });

  if (!response.ok) {
    let detail = 'API request failed';
    try { detail = (await response.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return response.json();
}
