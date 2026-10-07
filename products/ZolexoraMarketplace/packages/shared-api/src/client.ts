import axios, { type AxiosInstance } from "axios";

function resolveDefaultApiUrl() {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    if (host.endsWith(".github.dev") || host.endsWith(".app.github.dev")) {
      const apiHost = host.replace(/-300[0-9]/, "-8000");
      return `https://${apiHost}/api`;
    }
    return `http://${host}:8000/api`;
  }
  throw new Error("NEXT_PUBLIC_API_URL or EXPO_PUBLIC_API_URL is required for production builds.");
}

const DEFAULT_API_URL = resolveDefaultApiUrl();

let _client: AxiosInstance | null = null;

/** Returns a singleton Axios instance, lazily created. */
export function getApiClient(baseURL?: string): AxiosInstance {
  if (_client) return _client;

  _client = axios.create({
    baseURL: baseURL ?? DEFAULT_API_URL,
    timeout: 15_000,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
  });

  _client.interceptors.request.use((config) => {
    const method = config.method?.toUpperCase();
    const csrf = typeof document === "undefined" ? undefined : document.cookie.match(/(?:^|; )z_csrf=([^;]*)/)?.[1];
    if (csrf && method && !["GET", "HEAD", "OPTIONS"].includes(method)) config.headers.set("X-CSRF-Token", decodeURIComponent(csrf));
    return config;
  });

  // Handle 401 globally
  _client.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error?.response?.status === 401) {
        // Emit a custom event so any listener (auth context) can react
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("zolexora:unauthorized"));
        }
      }
      return Promise.reject(error);
    }
  );

  return _client;
}
