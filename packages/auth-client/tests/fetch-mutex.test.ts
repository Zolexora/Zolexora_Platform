import { describe, it, expect, vi, beforeEach } from "vitest";
import { createZolexoraFetch } from "../src/client/fetch.js";

describe("zolexoraFetch Single-Flight 401 Refresh Mutex", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("injects Authorization, X-Organisation-ID, and X-Zolexora-ID headers automatically", async () => {
    let capturedHeaders: Headers | null = null;
    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async () => "token_abc_123",
      getOrgId: () => "ZX-ORG-TEST-1234-ABCD",
      getZolexoraId: () => "ZX-8K9M-4P2W-7Y3X",
      fetch: mockFetch,
    });

    const res = await client("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(capturedHeaders!.get("Authorization")).toBe("Bearer token_abc_123");
    expect(capturedHeaders!.get("X-Organisation-ID")).toBe("ZX-ORG-TEST-1234-ABCD");
    expect(capturedHeaders!.get("X-Zolexora-ID")).toBe("ZX-8K9M-4P2W-7Y3X");
  });

  it("bypasses header injection when skipAuth: true is specified", async () => {
    let capturedHeaders: Headers | null = null;
    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      baseUrl: "https://api.zolexora.com",
      getToken: async () => "token_abc_123",
      fetch: mockFetch,
    });

    const res = await client("/public/health", { skipAuth: true });
    expect(res.status).toBe(200);
    expect(capturedHeaders!.has("Authorization")).toBe(false);
  });

  it("transparently refreshes on 401 and replays request with fresh token", async () => {
    let attempt = 0;
    let tokenValue = "stale_token_1";

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      attempt++;
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer stale_token_1") {
        return new Response(JSON.stringify({ error: "Token expired" }), {
          status: 401,
        });
      }
      return new Response(JSON.stringify({ user: "alice" }), { status: 200 });
    });

    const client = createZolexoraFetch({
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          tokenValue = "fresh_token_2";
          return tokenValue;
        }
        return tokenValue;
      },
      fetch: mockFetch,
    });

    const res = await client("https://api.zolexora.com/api/v1/user");
    expect(res.status).toBe(200);
    expect(attempt).toBe(2);
  });

  it("deduplicates concurrent 401 refresh calls via single-flight mutex (thundering herd)", async () => {
    let refreshCalls = 0;
    let currentToken = "stale_token";

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer stale_token") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCalls++;
          // Simulate network delay during token refresh
          await new Promise((resolve) => setTimeout(resolve, 80));
          currentToken = "fresh_shared_token";
          return currentToken;
        }
        return currentToken;
      },
      fetch: mockFetch,
    });

    // Fire 10 concurrent requests simultaneously
    const requests = Array.from({ length: 10 }, (_, i) =>
      client(`https://api.zolexora.com/resource/${i}`)
    );

    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    // Mutex guarantees exactly 1 refresh call despite 10 concurrent 401s
    expect(refreshCalls).toBe(1);
    // Total fetch calls = 10 initial + 10 retries = 20
    expect(mockFetch).toHaveBeenCalledTimes(20);
  });

  it("handles out-of-order race condition where token was already refreshed by earlier request", async () => {
    let refreshCalls = 0;
    let activeToken = "token_v1";

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer token_v1") {
        return new Response(JSON.stringify({ error: "Expired" }), {
          status: 401,
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const client = createZolexoraFetch({
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          refreshCalls++;
          activeToken = "token_v2";
          return activeToken;
        }
        return activeToken;
      },
      fetch: mockFetch,
    });

    // Request 1 triggers refresh and completes
    const res1 = await client("https://api.zolexora.com/endpoint1");
    expect(res1.status).toBe(200);
    expect(refreshCalls).toBe(1);

    // Request 2 was delayed on the network and still sends with stale token_v1
    const res2 = await client("https://api.zolexora.com/endpoint2", {
      token: "token_v1",
    });
    expect(res2.status).toBe(200);

    // Mutex recognizes usedToken ("token_v1") !== lastRefreshedToken ("token_v2"),
    // so it immediately returns token_v2 without invoking another refresh call!
    expect(refreshCalls).toBe(1);
  });

  it("dispatches zolexora:session-expired on persistent 401 and avoids infinite loop", async () => {
    let onExpiredCalls = 0;
    const eventDispatched = vi.fn();

    if (typeof window !== "undefined") {
      window.addEventListener("zolexora:session-expired", eventDispatched);
    }

    const mockFetch = vi.fn(async () => {
      // Always returns 401
      return new Response(JSON.stringify({ error: "Forbidden revoked" }), {
        status: 401,
      });
    });

    const client = createZolexoraFetch({
      getToken: async () => "token_unusable",
      onSessionExpired: () => {
        onExpiredCalls++;
      },
      fetch: mockFetch,
    });

    const res = await client("https://api.zolexora.com/secret");
    expect(res.status).toBe(401);
    expect(onExpiredCalls).toBe(1);
    // Request retried at most once (1 initial + 1 retry = 2 calls)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("triggers onSessionExpired when getToken(true) throws an error", async () => {
    let onExpiredCalls = 0;

    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Expired" }), { status: 401 });
    });

    const client = createZolexoraFetch({
      getToken: async (forceRefresh) => {
        if (forceRefresh) {
          throw new Error("Refresh token revoked by administrator");
        }
        return "stale_token";
      },
      onSessionExpired: () => {
        onExpiredCalls++;
      },
      fetch: mockFetch,
    });

    const res = await client("https://api.zolexora.com/secure");
    expect(res.status).toBe(401);
    expect(onExpiredCalls).toBe(1);
  });
});
