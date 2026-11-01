import { getIdToken } from "./web";

export const HEADER_ZOLEXORA_ID = "X-Zolexora-ID";
export const HEADER_ORGANISATION_ID = "X-Organisation-ID";
export const HEADER_AUTHORIZATION = "Authorization";

export interface ZolexoraFetchOptions extends RequestInit {
  organisationId?: string | null;
  zolexoraId?: string | null;
  skipAuth?: boolean;
}

/**
 * Factory to create an authenticated fetch function preconfigured with base URL and header resolvers.
 */
export function createZolexoraFetch(baseConfig?: {
  baseUrl?: string;
  getOrgId?: () => string | null;
  getZolexoraId?: () => string | null;
}) {
  return async function zolexoraFetch(
    input: string | URL | Request,
    init?: ZolexoraFetchOptions
  ): Promise<Response> {
    const url =
      typeof input === "string" && baseConfig?.baseUrl && !input.startsWith("http")
        ? `${baseConfig.baseUrl.replace(/\/$/, "")}/${input.replace(/^\//, "")}`
        : input;

    const headers = new Headers(init?.headers || {});

    if (!init?.skipAuth) {
      const token = await getIdToken();
      if (token && !headers.has(HEADER_AUTHORIZATION)) {
        headers.set(HEADER_AUTHORIZATION, `Bearer ${token}`);
      }

      const orgId =
        init?.organisationId ||
        (baseConfig?.getOrgId ? baseConfig.getOrgId() : null) ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("zolexora_active_org_id")
          : null);

      if (orgId && !headers.has(HEADER_ORGANISATION_ID)) {
        headers.set(HEADER_ORGANISATION_ID, orgId);
      }

      const zxId =
        init?.zolexoraId || (baseConfig?.getZolexoraId ? baseConfig.getZolexoraId() : null);
      if (zxId && !headers.has(HEADER_ZOLEXORA_ID)) {
        headers.set(HEADER_ZOLEXORA_ID, zxId);
      }
    }

    let response = await fetch(url, {
      ...init,
      headers,
    });

    // Handle token expiry / 401: auto-refresh and retry once
    if (response.status === 401 && !init?.skipAuth) {
      const freshToken = await getIdToken(true);
      if (freshToken) {
        headers.set(HEADER_AUTHORIZATION, `Bearer ${freshToken}`);
        response = await fetch(url, {
          ...init,
          headers,
        });
      }
    }

    return response;
  };
}

/**
 * Universal pre-instantiated fetch client that automatically attaches
 * Authorization Bearer token and X-Organisation-ID headers.
 */
export const zolexoraFetch = createZolexoraFetch();
