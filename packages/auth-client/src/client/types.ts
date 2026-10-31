/**
 * Configuration for creating a zolexoraFetch client instance.
 */
export interface ZolexoraFetchConfig {
  /**
   * Base URL of the API (e.g. "http://localhost:3081" or "https://auth.zolexora.com").
   * Relative paths will be resolved against this baseUrl.
   */
  baseUrl?: string;

  /**
   * Async function to retrieve the active auth token.
   * @param forceRefresh When true, must bypass cache and fetch a fresh token (e.g. getIdToken(true)).
   */
  getToken: (forceRefresh?: boolean) => Promise<string | null>;

  /**
   * Optional function to retrieve current organisation ID (e.g. "ZX-ORG-ABCD-1234-EF56").
   */
  getOrgId?: () => string | null;

  /**
   * Optional function to retrieve current Zolexora ID (e.g. "ZX-8K9M-4P2W-7Y3X").
   */
  getZolexoraId?: () => string | null;

  /**
   * Callback invoked when a 401 response persists after refreshing,
   * or when token refresh fails/rejects.
   */
  onSessionExpired?: () => void;

  /**
   * Custom fetch function (defaults to globalThis.fetch).
   */
  fetch?: typeof fetch;
}

/**
 * Extended options for zolexoraFetch requests.
 */
export interface ZolexoraFetchOptions extends RequestInit {
  /**
   * Organisation ID override for this request.
   * Injects header `X-Organisation-ID`.
   */
  organisationId?: string | null;

  /**
   * Alias for organisationId.
   */
  orgId?: string | null;

  /**
   * Zolexora ID override for this request.
   * Injects header `X-Zolexora-ID`.
   */
  zolexoraId?: string | null;

  /**
   * If true, bypasses automatic token injection and 401 refresh handling.
   * Use for unauthenticated endpoints.
   */
  skipAuth?: boolean;

  /**
   * Custom token override for this specific request.
   */
  token?: string | null;

  /**
   * Internal retry guard to prevent infinite loops.
   */
  _retried?: boolean;
}

/**
 * Type signature of the zolexoraFetch function instance.
 */
export type ZolexoraFetchInstance = (
  input: string | URL | Request,
  init?: ZolexoraFetchOptions
) => Promise<Response>;
