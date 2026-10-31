import {
  HEADER_AUTHORIZATION,
  HEADER_ORGANISATION_ID,
  HEADER_ZOLEXORA_ID,
} from "../constants.js";
import { SingleFlightRefreshMutex } from "./mutex.js";
import type {
  ZolexoraFetchConfig,
  ZolexoraFetchInstance,
  ZolexoraFetchOptions,
} from "./types.js";

/**
 * Creates an instance of zolexoraFetch configured with custom token retrieval and mutex.
 */
export function createZolexoraFetch(
  config: ZolexoraFetchConfig
): ZolexoraFetchInstance {
  const fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
  const mutex = new SingleFlightRefreshMutex(
    config.getToken,
    config.onSessionExpired
  );

  return async function zolexoraFetch(
    input: string | URL | Request,
    init?: ZolexoraFetchOptions
  ): Promise<Response> {
    // 1. Resolve target URL
    let url: string | URL | Request = input;
    if (typeof input === "string") {
      if (
        config.baseUrl &&
        !input.startsWith("http://") &&
        !input.startsWith("https://")
      ) {
        const base = config.baseUrl.replace(/\/$/, "");
        const path = input.replace(/^\//, "");
        url = `${base}/${path}`;
      }
    }

    // 2. Clone headers
    const headers = new Headers(init?.headers || {});

    // If input is a Request instance, merge its existing headers
    if (typeof Request !== "undefined" && input instanceof Request) {
      input.headers.forEach((value, key) => {
        if (!headers.has(key)) {
          headers.set(key, value);
        }
      });
    }

    // 3. Inject standard headers
    let activeToken: string | null = null;
    if (!init?.skipAuth) {
      if (init?.token) {
        activeToken = init.token;
      } else if (!headers.has(HEADER_AUTHORIZATION)) {
        activeToken = await config.getToken(false);
      } else {
        activeToken =
          headers.get(HEADER_AUTHORIZATION)?.replace(/^Bearer\s+/, "") || null;
      }

      if (activeToken && !headers.has(HEADER_AUTHORIZATION)) {
        headers.set(HEADER_AUTHORIZATION, `Bearer ${activeToken}`);
      }

      const orgId =
        init?.organisationId ||
        init?.orgId ||
        (config.getOrgId ? config.getOrgId() : null);
      if (orgId && !headers.has(HEADER_ORGANISATION_ID)) {
        headers.set(HEADER_ORGANISATION_ID, orgId);
      }

      const zxId =
        init?.zolexoraId ||
        (config.getZolexoraId ? config.getZolexoraId() : null);
      if (zxId && !headers.has(HEADER_ZOLEXORA_ID)) {
        headers.set(HEADER_ZOLEXORA_ID, zxId);
      }
    }

    // 4. Initial fetch call
    const {
      organisationId: _orgId,
      orgId: _oId,
      zolexoraId: _zxId,
      skipAuth: _skip,
      token: _tok,
      _retried: _ret,
      ...standardInit
    } = init || {};

    let response = await fetchFn(url, {
      ...standardInit,
      headers,
    });

    // 5. Intercept HTTP 401 with Single-Flight Mutex
    if (response.status === 401 && !init?.skipAuth && !init?._retried) {
      const usedToken =
        headers.get(HEADER_AUTHORIZATION)?.replace(/^Bearer\s+/, "") ||
        activeToken;
      const freshToken = await mutex.refreshToken(usedToken);

      if (freshToken) {
        headers.set(HEADER_AUTHORIZATION, `Bearer ${freshToken}`);

        // Retry request once with fresh token
        response = await fetchFn(url, {
          ...standardInit,
          headers,
        });

        // If response is STILL 401, persistent failure
        if (response.status === 401) {
          mutex.triggerSessionExpired("PERSISTENT_401_AFTER_REFRESH");
        }
      }
    }

    return response;
  };
}

/**
 * Singleton registry for default zolexoraFetch instance.
 */
let defaultInstance: ZolexoraFetchInstance | null = null;

export function setDefaultZolexoraFetch(instance: ZolexoraFetchInstance): void {
  defaultInstance = instance;
}

export function getDefaultZolexoraFetch(): ZolexoraFetchInstance {
  if (!defaultInstance) {
    defaultInstance = createZolexoraFetch({
      getToken: async () => {
        if (typeof window !== "undefined") {
          return (window as any).__ZOLEXORA_TOKEN__ || null;
        }
        return null;
      },
    });
  }
  return defaultInstance;
}

/**
 * Default pre-configured zolexoraFetch instance.
 */
export const zolexoraFetch: ZolexoraFetchInstance = async (input, init) => {
  return getDefaultZolexoraFetch()(input, init);
};
