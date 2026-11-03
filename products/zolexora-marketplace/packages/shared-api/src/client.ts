import axios, { type AxiosInstance } from "axios";

/**
 * Marketplace API client. Sign-in belongs to the Zolexora auth service: every request
 * carries its session token as a Bearer token. The app configures the API URL (from
 * Infisical, no fallback) and how to read the token before the first request.
 */
export interface ApiConfig {
  baseURL: string;
  /** The Zolexora auth-service session token, or null when signed out. */
  getToken: () => string | null | Promise<string | null>;
  /** Called on 401: the auth-service session is no longer valid. */
  onUnauthorized?: () => void;
}

let config: ApiConfig | null = null;
let client: AxiosInstance | null = null;

export function configureApi(next: ApiConfig): void {
  if (!next.baseURL) throw new Error("The marketplace API URL is not configured (Infisical).");
  config = next;
  client = null;
}

/** Returns the configured Axios instance (configureApi must run first). */
export function getApiClient(): AxiosInstance {
  if (client) return client;
  if (!config) throw new Error("configureApi() must be called before the first API request.");
  const { baseURL, getToken, onUnauthorized } = config;

  client = axios.create({ baseURL, timeout: 15_000, headers: { "Content-Type": "application/json" } });
  client.interceptors.request.use(async (req) => {
    const token = await getToken();
    if (token) req.headers.set("Authorization", `Bearer ${token}`);
    return req;
  });
  client.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error?.response?.status === 401) onUnauthorized?.();
      return Promise.reject(error);
    },
  );
  return client;
}
