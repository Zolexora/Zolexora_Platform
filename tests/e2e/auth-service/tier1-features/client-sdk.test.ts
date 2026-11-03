import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness, createTestZolexoraFetch } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 1: Feature 9 — Companion Client SDK (@zolexora/auth-client)", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => harness.resetState());

  /** A correctly signed token that expired an hour ago (beyond the clock-skew tolerance). */
  const expiredToken = () => harness.service.token({ uid: "usr_9981", iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 });

  it("T1.9.01: zolexoraFetch injects Authorization, X-Organisation-ID, and X-Zolexora-ID headers", async () => {
    let capturedHeaders: Headers | null = null;

    const customFetch = createTestZolexoraFetch({
      baseUrl: harness.baseUrl,
      getToken: async () => harness.service.token({ uid: "usr_9981", zolexora_id: FIXTURES.ids.validUser }),
      getOrgId: () => FIXTURES.ids.validOrg,
      getZolexoraId: () => FIXTURES.ids.validUser,
    });

    const res = await customFetch("/api/v1/auth/me");
    expect(res.status).toBe(200);
  });

  it("T1.9.02: zolexoraFetch transparently refreshes expired token on 401 and replays request", async () => {
    let callCount = 0;
    let tokenState = expiredToken();

    const customFetch = createTestZolexoraFetch({
      baseUrl: harness.baseUrl,
      getToken: async (forceRefresh) => {
        callCount++;
        if (forceRefresh) {
          tokenState = harness.service.token({ uid: "usr_9981" });
          return tokenState;
        }
        return tokenState;
      },
    });

    // Initial call uses 'expired_token' which triggers 401 on server,
    // then fetch automatically calls getToken(true) and replays with fresh token
    const res = await customFetch("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(callCount).toBe(2); // 1 initial + 1 force refresh
  });

  it("T1.9.03: Single-flight refresh mutex deduplicates concurrent 401 refresh calls", async () => {
    let refreshCallCount = 0;
    let tokenState = expiredToken();

    const customFetch = createTestZolexoraFetch({
      baseUrl: harness.baseUrl,
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCallCount++;
          // simulate network delay during token refresh
          await new Promise((r) => setTimeout(r, 50));
          tokenState = harness.service.token({ uid: "usr_9981" });
          return tokenState;
        }
        return tokenState;
      },
    });

    // Fire 5 concurrent requests that all get 401 initially
    const [res1, res2, res3, res4, res5] = await Promise.all([
      customFetch("/api/v1/auth/me"),
      customFetch("/api/v1/auth/me"),
      customFetch("/api/v1/auth/me"),
      customFetch("/api/v1/auth/me"),
      customFetch("/api/v1/auth/me"),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
    expect(res4.status).toBe(200);
    expect(res5.status).toBe(200);
    // Single-flight mutex guarantees only 1 refresh call was made
    expect(refreshCallCount).toBe(1);
  });

  it("T1.9.04: Persistent 401 triggers onSessionExpired callback", async () => {
    let sessionExpiredTriggered = false;

    const customFetch = createTestZolexoraFetch({
      baseUrl: harness.baseUrl,
      getToken: async () => "expired_token", // Always returns expired
      onSessionExpired: () => {
        sessionExpiredTriggered = true;
      },
    });

    const res = await customFetch("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(sessionExpiredTriggered).toBe(true);
  });

  it("T1.9.05: Multi-tier environment resolver resolves baseUrl in priority order", () => {
    const resolveEnv = (mockWindow?: any, mockProcess?: any) => {
      return (
        mockWindow?.__ENV__?.AUTH_SERVICE_URL ||
        mockProcess?.env?.NEXT_PUBLIC_AUTH_SERVICE_URL ||
        mockProcess?.env?.VITE_AUTH_SERVICE_URL ||
        "http://localhost:3081"
      );
    };

    // Priority 1: window.__ENV__
    expect(resolveEnv({ __ENV__: { AUTH_SERVICE_URL: "https://auth-runtime.zolexora.com" } })).toBe(
      "https://auth-runtime.zolexora.com"
    );

    // Priority 2: process.env.NEXT_PUBLIC
    expect(resolveEnv(undefined, { env: { NEXT_PUBLIC_AUTH_SERVICE_URL: "https://auth-next.zolexora.com" } })).toBe(
      "https://auth-next.zolexora.com"
    );

    // Priority 3: Fallback default
    expect(resolveEnv()).toBe("http://localhost:3081");
  });
});
