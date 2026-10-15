import { supabase } from './supabase';

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
  const { data: { session } } = await supabase.auth.getSession();
  const baseUrl = getApiBaseUrl();
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
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
