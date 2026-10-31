import { execSync } from "node:child_process";
import { isLiveServiceAvailable, DEFAULT_AUTH_URL } from "./env";
import { AuthContractServer } from "./contract-server";

export interface ZolexoraFetchOptions extends RequestInit {
  organisationId?: string | null;
  zolexoraId?: string | null;
  skipAuth?: boolean;
}

export class TestHarness {
  private static instance: TestHarness | null = null;
  public server: AuthContractServer | null = null;
  public baseUrl: string = DEFAULT_AUTH_URL;
  public isLive = false;

  private constructor() {}

  public static async getInstance(): Promise<TestHarness> {
    if (!TestHarness.instance) {
      TestHarness.instance = new TestHarness();
      await TestHarness.instance.init();
    }
    return TestHarness.instance;
  }

  private async init() {
    const liveAvailable = await isLiveServiceAvailable();
    if (liveAvailable) {
      this.isLive = true;
      this.baseUrl = DEFAULT_AUTH_URL;
    } else {
      this.isLive = false;
      this.server = new AuthContractServer();
      await this.server.start();
      this.baseUrl = this.server.getUrl();
    }
  }

  public resetState() {
    if (this.server) {
      this.server.resetState();
    } else {
      try {
        execSync(`curl -s -X POST ${this.baseUrl}/api/v1/test/reset`, { timeout: 1000 });
      } catch {}
    }
  }

  public async teardown() {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
    TestHarness.instance = null;
  }
}

/**
 * Creates an instance of zolexoraFetch conforming to @zolexora/auth-client specification
 */
export function createTestZolexoraFetch(config: {
  baseUrl: string;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  getOrgId?: () => string | null;
  getZolexoraId?: () => string | null;
  onSessionExpired?: () => void;
}) {
  let isRefreshing = false;
  let refreshPromise: Promise<string | null> | null = null;
  let lastRefreshedToken: string | null = null;

  const refreshMutex = async (usedToken?: string | null): Promise<string | null> => {
    if (usedToken && lastRefreshedToken && lastRefreshedToken !== usedToken) {
      return lastRefreshedToken;
    }
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }
    isRefreshing = true;
    refreshPromise = config.getToken(true).then((token) => {
      lastRefreshedToken = token;
      return token;
    }).finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
    return refreshPromise;
  };

  return async function zolexoraFetch(
    input: string | URL | Request,
    init?: ZolexoraFetchOptions
  ): Promise<Response> {
    const url =
      typeof input === "string" && !input.startsWith("http")
        ? `${config.baseUrl.replace(/\/$/, "")}/${input.replace(/^\//, "")}`
        : input;

    const headers = new Headers(init?.headers || {});

    if (!init?.skipAuth) {
      const token = await config.getToken(false);
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const orgId = init?.organisationId || (config.getOrgId ? config.getOrgId() : null);
      if (orgId && !headers.has("X-Organisation-ID")) {
        headers.set("X-Organisation-ID", orgId);
      }

      const zxId = init?.zolexoraId || (config.getZolexoraId ? config.getZolexoraId() : null);
      if (zxId && !headers.has("X-Zolexora-ID")) {
        headers.set("X-Zolexora-ID", zxId);
      }
    }

    let response = await fetch(url, {
      ...init,
      headers,
    });

    // Auto-refresh on 401 with single-flight mutex
    if (response.status === 401 && !init?.skipAuth) {
      const usedToken = headers.get("Authorization")?.replace(/^Bearer\s+/, "");
      const freshToken = await refreshMutex(usedToken);
      if (freshToken) {
        headers.set("Authorization", `Bearer ${freshToken}`);
        response = await fetch(url, {
          ...init,
          headers,
        });
      }
      if (response.status === 401) {
        config.onSessionExpired?.();
      }
    }

    return response;
  };
}
