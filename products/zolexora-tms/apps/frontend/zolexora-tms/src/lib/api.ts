import { getIdToken } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? '' : 'https://api.tms.zolexora.onrender.com');

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Inject explicit tenant context for the backend
  const activeOrgId = localStorage.getItem('zolexora_active_org_id');
  if (activeOrgId) {
    headers.set('X-Organization-Id', activeOrgId);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
