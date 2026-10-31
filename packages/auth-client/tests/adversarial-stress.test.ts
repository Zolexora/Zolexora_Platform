import { describe, it, expect, vi, beforeEach } from "vitest";
import { createZolexoraFetch } from "../src/client/fetch.js";
import { SingleFlightRefreshMutex } from "../src/client/mutex.js";
import { TokenManager } from "../src/client/token-manager.js";
import { SESSION_EXPIRED_EVENT } from "../src/constants.js";

describe("Milestone 5 Adversarial Stress & Concurrency Challenge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ADVERSARIAL 1: Thundering herd (25 concurrent requests) deduplicated to strictly 1 refresh call", async () => {
    let refreshCount = 0;
    let initialCalls = 0;
    let retryCalls = 0;
    const initialToken = "stale_token_herd_25";
    const freshToken = "fresh_token_herd_25";

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === `Bearer ${initialToken}`) {
        initialCalls++;
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      if (auth === `Bearer ${freshToken}`) {
        retryCalls++;
        return new Response(JSON.stringify({ success: true, url: String(input) }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Unexpected token" }), { status: 400 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCount++;
          // Simulate realistic async network roundtrip for token refresh
          await new Promise((resolve) => setTimeout(resolve, 60));
          return freshToken;
        }
        return initialToken;
      },
      fetch: mockFetch,
    });

    // Fire 25 simultaneous concurrent requests
    const CONCURRENCY = 25;
    const promises = Array.from({ length: CONCURRENCY }, (_, i) =>
      client(`/resource/${i}`)
    );

    const responses = await Promise.all(promises);

    expect(responses.length).toBe(CONCURRENCY);
    for (const res of responses) {
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    }

    // Mutex invariant: exactly 1 refresh call across 25 concurrent requests
    expect(refreshCount).toBe(1);
    expect(initialCalls).toBe(25);
    expect(retryCalls).toBe(25);
    expect(mockFetch).toHaveBeenCalledTimes(50);
  });

  it("ADVERSARIAL 2: Extreme Thundering herd (50 concurrent requests) deduplicated to strictly 1 refresh call", async () => {
    let refreshCount = 0;
    let initialCalls = 0;
    let retryCalls = 0;
    const initialToken = "stale_token_herd_50";
    const freshToken = "fresh_token_herd_50";

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === `Bearer ${initialToken}`) {
        initialCalls++;
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      if (auth === `Bearer ${freshToken}`) {
        retryCalls++;
        return new Response(JSON.stringify({ ok: true, id: String(input) }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Bad Request" }), { status: 400 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCount++;
          await new Promise((resolve) => setTimeout(resolve, 75));
          return freshToken;
        }
        return initialToken;
      },
      fetch: mockFetch,
    });

    // Fire 50 simultaneous concurrent requests
    const CONCURRENCY = 50;
    const promises = Array.from({ length: CONCURRENCY }, (_, i) =>
      client(`/data/probe-${i}`)
    );

    const responses = await Promise.all(promises);

    expect(responses.length).toBe(CONCURRENCY);
    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    expect(refreshCount).toBe(1);
    expect(initialCalls).toBe(50);
    expect(retryCalls).toBe(50);
    expect(mockFetch).toHaveBeenCalledTimes(100);
  });

  it("ADVERSARIAL 3: Out-of-order race conditions across 3 staggered waves reuse cached token without 2nd refresh", async () => {
    let refreshCalls = 0;
    let currentToken = "token_generation_1";
    const nextToken = "token_generation_2";

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer token_generation_1") {
        return new Response(JSON.stringify({ error: "Token expired" }), { status: 401 });
      }
      if (auth === "Bearer token_generation_2") {
        return new Response(JSON.stringify({ success: true, item: String(input) }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 403 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCalls++;
          // Simulate refresh in-flight for 50ms
          await new Promise((resolve) => setTimeout(resolve, 50));
          currentToken = nextToken;
          return nextToken;
        }
        return currentToken;
      },
      fetch: mockFetch,
    });

    // Wave 1: 5 requests start at t=0ms
    const wave1 = Array.from({ length: 5 }, (_, i) => client(`/wave1/${i}`));

    // Wave 2: 10 requests start at t=20ms while refresh is in-flight
    await new Promise((resolve) => setTimeout(resolve, 20));
    const wave2 = Array.from({ length: 10 }, (_, i) => client(`/wave2/${i}`));

    // Wait for refresh to complete (at t=50-60ms)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Wave 3: 15 requests start at t=70ms simulating delayed packets sending explicit stale token
    const wave3 = Array.from({ length: 15 }, (_, i) =>
      client(`/wave3/${i}`, { token: "token_generation_1" })
    );

    const allResponses = await Promise.all([...wave1, ...wave2, ...wave3]);

    expect(allResponses.length).toBe(30);
    for (const res of allResponses) {
      expect(res.status).toBe(200);
    }

    // The single-flight mutex must have executed refresh exactly once for all 30 requests
    expect(refreshCalls).toBe(1);
  });

  it("ADVERSARIAL 4: Catastrophic refresh rejection under 25 concurrent requests dispatches session expiration", async () => {
    let refreshCalls = 0;
    let onSessionExpiredCalls = 0;
    const eventDispatched = vi.fn();

    const listener = (e: any) => eventDispatched(e.detail);
    if (typeof window !== "undefined") {
      window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    }

    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Session revoked" }), { status: 401 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCalls++;
          await new Promise((resolve) => setTimeout(resolve, 30));
          throw new Error("Firebase auth/id-token-revoked: user session was terminated");
        }
        return "stale_token_revoked";
      },
      onSessionExpired: () => {
        onSessionExpiredCalls++;
      },
      fetch: mockFetch,
    });

    const CONCURRENCY = 25;
    const promises = Array.from({ length: CONCURRENCY }, (_, i) => client(`/secure/${i}`));
    const responses = await Promise.all(promises);

    // All 25 return 401 cleanly without unhandled rejection crashing the runtime
    for (const res of responses) {
      expect(res.status).toBe(401);
    }

    expect(refreshCalls).toBe(1);
    expect(onSessionExpiredCalls).toBe(1);
    expect(eventDispatched).toHaveBeenCalledTimes(1);
    expect(eventDispatched).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "REFRESH_PROMISE_REJECTED",
      })
    );

    // Clean up event listener
    if (typeof window !== "undefined") {
      window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    }
  });

  it("ADVERSARIAL 5: Refresh returning null/empty string under 25 concurrent requests triggers EMPTY_REFRESHED_TOKEN", async () => {
    let refreshCalls = 0;
    let onSessionExpiredCalls = 0;
    const eventDispatched = vi.fn();

    const listener = (e: any) => eventDispatched(e.detail);
    if (typeof window !== "undefined") {
      window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    }

    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCalls++;
          return null; // Token refresh returned null (e.g. no active session)
        }
        return "stale_token_empty";
      },
      onSessionExpired: () => {
        onSessionExpiredCalls++;
      },
      fetch: mockFetch,
    });

    const CONCURRENCY = 25;
    const promises = Array.from({ length: CONCURRENCY }, (_, i) => client(`/data/${i}`));
    const responses = await Promise.all(promises);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }

    expect(refreshCalls).toBe(1);
    expect(onSessionExpiredCalls).toBe(1);
    expect(eventDispatched).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "EMPTY_REFRESHED_TOKEN",
      })
    );

    if (typeof window !== "undefined") {
      window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    }
  });

  it("ADVERSARIAL 6: Terminal persistent 401 after refresh triggers PERSISTENT_401_AFTER_REFRESH and retries exactly once", async () => {
    let fetchCalls = 0;
    let refreshCalls = 0;
    let onSessionExpiredCalls = 0;
    const eventDispatched = vi.fn();

    const listener = (e: any) => eventDispatched(e.detail);
    if (typeof window !== "undefined") {
      window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    }

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      fetchCalls++;
      // Server always returns 401 (e.g. user banned or IP blocked)
      return new Response(JSON.stringify({ error: "Account banned permanently" }), { status: 401 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCalls++;
          return "newly_minted_banned_token";
        }
        return "initial_banned_token";
      },
      onSessionExpired: () => {
        onSessionExpiredCalls++;
      },
      fetch: mockFetch,
    });

    const res = await client("/api/v1/user/profile");
    expect(res.status).toBe(401);

    // Exactly 1 initial fetch + 1 retry fetch = 2 fetch calls total (NO infinite loops)
    expect(fetchCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(onSessionExpiredCalls).toBe(1);
    expect(eventDispatched).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "PERSISTENT_401_AFTER_REFRESH",
      })
    );

    if (typeof window !== "undefined") {
      window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    }
  });

  it("ADVERSARIAL 7: Header injection and preservation across diverse RequestInit types under concurrency", async () => {
    const capturedHeaders: Array<Headers> = [];
    const initialToken = "stale_hdr_token";
    const freshToken = "fresh_hdr_token";

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      capturedHeaders.push(h);
      if (h.get("Authorization") === `Bearer ${initialToken}`) {
        return new Response(JSON.stringify({ error: "401" }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => (forceRefresh ? freshToken : initialToken),
      getOrgId: () => "ZX-ORG-ABCD-1234-EFGH",
      getZolexoraId: () => "ZX-8K9M-4P2W-7Y3X",
      fetch: mockFetch,
    });

    // Test three header input formats: plain object, Headers instance, and entries array
    const [res1, res2, res3] = await Promise.all([
      client("/test-obj", {
        headers: { "X-Trace-Id": "trace-101", "Content-Type": "application/json" },
      }),
      client("/test-inst", {
        headers: new Headers({ "X-Trace-Id": "trace-202", "Accept": "application/json" }),
      }),
      client("/test-arr", {
        headers: [["X-Trace-Id", "trace-303"], ["X-Device-Id", "device-99"]],
      }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);

    // Filter retried requests (which have freshToken)
    const retriedHeaders = capturedHeaders.filter(
      (h) => h.get("Authorization") === `Bearer ${freshToken}`
    );
    expect(retriedHeaders.length).toBe(3);

    for (const h of retriedHeaders) {
      expect(h.get("Authorization")).toBe(`Bearer ${freshToken}`);
      expect(h.get("X-Organisation-ID")).toBe("ZX-ORG-ABCD-1234-EFGH");
      expect(h.get("X-Zolexora-ID")).toBe("ZX-8K9M-4P2W-7Y3X");
      expect(h.has("X-Trace-Id")).toBe(true);
    }
  });

  it("ADVERSARIAL 8: Multi-epoch sequential refresh cycles reset mutex state correctly", async () => {
    let refreshCalls = 0;
    let tokenEpoch = 1;

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      const expectedToken = `token_epoch_${tokenEpoch}`;
      if (auth !== `Bearer ${expectedToken}`) {
        return new Response(JSON.stringify({ error: "Expired epoch" }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true, epoch: tokenEpoch }), { status: 200 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCalls++;
          tokenEpoch++;
          return `token_epoch_${tokenEpoch}`;
        }
        return `token_epoch_${tokenEpoch}`;
      },
      fetch: mockFetch,
    });

    // Epoch 1 -> 2: 10 concurrent requests
    tokenEpoch = 1;
    mockFetch.mockImplementation(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer token_epoch_1") {
        return new Response(JSON.stringify({ error: "Expired epoch 1" }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const cycle1 = await Promise.all(
      Array.from({ length: 10 }, (_, i) => client(`/cycle1/${i}`))
    );
    for (const res of cycle1) expect(res.status).toBe(200);
    expect(refreshCalls).toBe(1);

    // Epoch 2 -> 3: Next wave hits 401 after some time
    mockFetch.mockImplementation(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer token_epoch_2") {
        return new Response(JSON.stringify({ error: "Expired epoch 2" }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const cycle2 = await Promise.all(
      Array.from({ length: 10 }, (_, i) => client(`/cycle2/${i}`))
    );
    for (const res of cycle2) expect(res.status).toBe(200);
    expect(refreshCalls).toBe(2);
  });

  it("ADVERSARIAL 9: TokenManager handles clock skew, JWT expiration, and corrupted tokens", async () => {
    const createJwt = (expInSecondsFromNow: number) => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
      const exp = Math.floor(Date.now() / 1000) + expInSecondsFromNow;
      const payload = Buffer.from(JSON.stringify({ sub: "user_123", exp })).toString("base64");
      return `${header}.${payload}.signature`;
    };

    let fetchTokenCalls = 0;
    const tm = new TokenManager(async (force) => {
      fetchTokenCalls++;
      return createJwt(3600); // 1 hour validity
    });

    // 1. Initial empty token
    expect(tm.getToken()).toBeNull();
    expect(tm.isExpired()).toBe(false);

    // 2. Token expiring in 5 seconds (with 10s clock skew, should count as expired!)
    const nearExpiryToken = createJwt(5);
    tm.setToken(nearExpiryToken);
    expect(tm.isExpired(10)).toBe(true);
    expect(tm.getToken()).toBeNull(); // returns null because isExpired is true

    // 3. Token expiring in 60 seconds (with 10s clock skew, still valid)
    const validToken = createJwt(60);
    tm.setToken(validToken);
    expect(tm.isExpired(10)).toBe(false);
    expect(tm.getToken()).toBe(validToken);

    // 4. getOrRefreshToken when valid does not call fetchToken
    const cached = await tm.getOrRefreshToken(false);
    expect(cached).toBe(validToken);
    expect(fetchTokenCalls).toBe(0);

    // 5. getOrRefreshToken with forceRefresh=true calls fetchToken
    const forced = await tm.getOrRefreshToken(true);
    expect(forced).not.toBeNull();
    expect(fetchTokenCalls).toBe(1);

    // 6. Corrupted token strings (malformed base64, missing exp) do not throw
    tm.setToken("invalid.jwt.token");
    expect(tm.isExpired()).toBe(false);

    tm.setToken("not-even-three-parts");
    expect(tm.isExpired()).toBe(false);

    tm.clear();
    expect(tm.getToken()).toBeNull();
  });

  it("ADVERSARIAL 10: Direct SingleFlightRefreshMutex stress test with 100 simultaneous calls", async () => {
    let refreshCalls = 0;
    const mutex = new SingleFlightRefreshMutex(async (force) => {
      refreshCalls++;
      await new Promise((r) => setTimeout(r, 40));
      return "mutex_single_token";
    });

    // 100 concurrent callers directly requesting refreshToken
    const results = await Promise.all(
      Array.from({ length: 100 }, () => mutex.refreshToken("old_tok"))
    );

    expect(results.length).toBe(100);
    for (const tok of results) {
      expect(tok).toBe("mutex_single_token");
    }
    expect(refreshCalls).toBe(1);
  });

  it("ADVERSARIAL 11: Request instance with existing headers preserves them through retry", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      callCount++;
      const h = new Headers(init?.headers);
      if (h.get("Authorization") === "Bearer stale_req") {
        return new Response(JSON.stringify({ error: "401" }), { status: 401 });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      getToken: async (force) => (force ? "fresh_req" : "stale_req"),
      fetch: mockFetch,
    });

    const req = new Request("https://api.zolexora.com/users", {
      method: "POST",
      headers: {
        "X-Original-Header": "original_value",
      },
      body: JSON.stringify({ name: "Bob" }),
    });

    const res = await client(req);
    expect(res.status).toBe(200);
    expect(callCount).toBe(2);

    const retryCallHeaders = new Headers(mockFetch.mock.calls[1][1]?.headers);
    expect(retryCallHeaders.get("X-Original-Header")).toBe("original_value");
    expect(retryCallHeaders.get("Authorization")).toBe("Bearer fresh_req");
  });

  it("ADVERSARIAL 12: BaseUrl path resolution handles arbitrary trailing and leading slashes", async () => {
    const urlsCalled: string[] = [];
    const mockFetch = vi.fn(async (input: any) => {
      urlsCalled.push(String(input));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://auth.zolexora.com/api/",
      getToken: async () => "dummy",
      fetch: mockFetch,
    });

    // Test with leading slash
    await client("/v1/me");
    expect(urlsCalled[0]).toBe("https://auth.zolexora.com/api/v1/me");

    // Test without leading slash
    await client("v1/users");
    expect(urlsCalled[1]).toBe("https://auth.zolexora.com/api/v1/users");

    // Test absolute URL is not prepended
    await client("https://other.com/ext");
    expect(urlsCalled[2]).toBe("https://other.com/ext");
  });

  it("ADVERSARIAL 13: SSR safety when window and document are undefined", async () => {
    // In Node.js / happy-dom, test mutex when window is absent
    let sessionExpiredCalled = false;
    const mutex = new SingleFlightRefreshMutex(
      async () => null,
      () => {
        sessionExpiredCalled = true;
      }
    );

    // Temporarily stash window
    const originalWindow = globalThis.window;
    try {
      (globalThis as any).window = undefined;

      // Trigger session expired
      mutex.triggerSessionExpired("SSR_TEST");
      expect(sessionExpiredCalled).toBe(true);

      const res = await mutex.refreshToken("old_tok");
      expect(res).toBeNull();
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it("ADVERSARIAL 14: AbortSignal is respected and forwarded cleanly", async () => {
    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      getToken: async () => "token",
      fetch: mockFetch,
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      client("https://api.zolexora.com/aborted", { signal: controller.signal })
    ).rejects.toThrow();
  });
});
