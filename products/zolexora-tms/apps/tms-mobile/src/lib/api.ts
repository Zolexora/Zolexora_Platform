import Constants from 'expo-constants';
import { storage } from './storage';

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  const extraUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (extraUrl) {
    return String(extraUrl);
  }
  return 'http://localhost:4030';
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await storage.getToken();
  const org = await storage.getActiveOrg();
  const baseUrl = getApiBaseUrl();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (org?.id) {
    headers['X-Organization-Id'] = org.id;
  }

  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      errorDetail =
        errorJson.error?.message ||
        errorJson.detail ||
        (typeof errorJson === 'string' ? errorJson : errorDetail);
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}
