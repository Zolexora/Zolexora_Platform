import { config } from './config';
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

/** Calls the TMS backend with the Zolexora session token. */
export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${config.apiBaseUrl()}${path}`, { ...options, headers });

  if (response.status === 401) onUnauthorized?.();
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
