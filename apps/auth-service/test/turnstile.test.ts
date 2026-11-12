import { TURNSTILE } from "./helpers/fakes.js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TurnstileService } from "../src/services/turnstile.service.js";
import { AppError } from "../src/plugins/error-handler.js";

describe("TurnstileService Unit Test Suite", () => {
  const DEFAULT_SECRET = "test-secret-key-1234567890";
  const DEFAULT_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  let service: TurnstileService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new TurnstileService(DEFAULT_SECRET, DEFAULT_VERIFY_URL, {
      timeoutMs: 1000,
      expectedHostnames: ["auth.zolexora.com", "localhost"],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Token Pre-Validation & Boundary Checks
  // =========================================================================
  describe("1. Token Pre-Validation & Boundary Checks", () => {
    it("1.1 Rejects missing/undefined token with HTTP 400 AUTH_TURNSTILE_REQUIRED", async () => {
      await expect(service.verifyToken(undefined)).rejects.toMatchObject({
        statusCode: 400,
        code: "AUTH_TURNSTILE_REQUIRED",
      });
    });

    it("1.2 Rejects empty string token with HTTP 400 AUTH_TURNSTILE_REQUIRED", async () => {
      await expect(service.verifyToken("")).rejects.toMatchObject({
        statusCode: 400,
        code: "AUTH_TURNSTILE_REQUIRED",
      });
    });

    it("1.3 Rejects whitespace-only token with HTTP 400 AUTH_TURNSTILE_REQUIRED", async () => {
      await expect(service.verifyToken("    \t\n  ")).rejects.toMatchObject({
        statusCode: 400,
        code: "AUTH_TURNSTILE_REQUIRED",
      });
    });

    it("1.4 Rejects token exceeding 2048 characters with HTTP 403 AUTH_TURNSTILE_FAILED", async () => {
      const oversizedToken = "a".repeat(2049);
      await expect(service.verifyToken(oversizedToken)).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining("maximum permitted length"),
      });
    });

    it("1.5 Fixture-looking tokens get no local shortcut: every token goes to Cloudflare", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
      });
      vi.stubGlobal("fetch", fetchSpy);
      for (const token of [TURNSTILE.VALID_TOKEN, "1x00000000000000000000AA", "mock_valid_x", "test_valid_x", "0.valid-anything"]) {
        await expect(service.verifyToken(token)).rejects.toMatchObject({ statusCode: 403, code: "AUTH_TURNSTILE_FAILED" });
      }
      expect(fetchSpy).toHaveBeenCalledTimes(5);
    });
  });

  // =========================================================================
  // 3. Outbound HTTP Request Body & Parameter Serialization
  // =========================================================================
  describe("3. Outbound HTTP Request Body & Parameter Serialization", () => {
    it("3.1 Correctly formats and posts URLSearchParams with secret, response, remoteip, and idempotency_key", async () => {
      let capturedUrl = "";
      let capturedOptions: any = null;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url, opts) => {
          capturedUrl = url;
          capturedOptions = opts;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              action: "track1-public-login",
              hostname: "auth.zolexora.com",
            }),
          });
        })
      );

      const genuineToken = "live_cf_genuine_token_abcdef123456";
      await service.verifyToken(genuineToken, {
        remoteIp: "203.0.113.195",
        expectedAction: "track1-public-login",
        idempotencyKey: "idem-key-9999",
      });

      expect(capturedUrl).toBe(DEFAULT_VERIFY_URL);
      expect(capturedOptions.method).toBe("POST");
      expect(capturedOptions.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

      const bodyParams = capturedOptions.body as URLSearchParams;
      expect(bodyParams.get("secret")).toBe(DEFAULT_SECRET);
      expect(bodyParams.get("response")).toBe(genuineToken);
      expect(bodyParams.get("remoteip")).toBe("203.0.113.195");
      expect(bodyParams.get("idempotency_key")).toBe("idem-key-9999");
    });

    it("3.2 Supports string parameter shorthand for remoteIp", async () => {
      let capturedOptions: any = null;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url, opts) => {
          capturedOptions = opts;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              hostname: "auth.zolexora.com",
            }),
          });
        })
      );

      await service.verifyToken("live_token_string_ip_test", { remoteIp: "198.51.100.42" });
      const bodyParams = capturedOptions.body as URLSearchParams;
      expect(bodyParams.get("remoteip")).toBe("198.51.100.42");
      expect(bodyParams.get("idempotency_key")).toBeNull();
    });
  });

  // =========================================================================
  // 4. Response Handling & Gateway Error Classification
  // =========================================================================
  describe("4. Response Handling & Gateway Error Classification", () => {
    it("4.1 Rejects gateway non-2xx status code with HTTP 403 AUTH_TURNSTILE_FAILED", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
        })
      );

      await expect(
        service.verifyToken("live_token_gateway_502_error")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining("Gateway rejected token with status 502"),
      });
    });

    it("4.2 Maps timeout-or-duplicate error code to HTTP 403 AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: false,
            "error-codes": ["timeout-or-duplicate"],
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_timeout_duplicate_response")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE",
      });
    });

    it("4.3 Maps invalid-input-response error code to HTTP 403 AUTH_TURNSTILE_FAILED", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: false,
            "error-codes": ["invalid-input-response"],
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_invalid_response")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining("invalid-input-response"),
      });
    });

    it("4.4 Handles empty error-codes array on success: false", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: false,
            "error-codes": [],
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_empty_error_codes")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
      });
    });
  });

  // =========================================================================
  // 5. Action & Hostname Verification on Live Responses (Fix 2 & Fix 3)
  // =========================================================================
  describe("5. Action & Hostname Verification on Gateway Responses", () => {
    it("5.1 Rejects when data.action is mismatched", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: "newsletter-signup",
            hostname: "auth.zolexora.com",
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_mismatched_action", {
          expectedAction: "track1-public-login",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining(
          'Action mismatch (expected "track1-public-login", received "newsletter-signup")'
        ),
      });
    });

    it("5.2 CRITICAL FIX: Rejects when data.action is MISSING/UNDEFINED in siteverify response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            hostname: "auth.zolexora.com",
            // action is omitted!
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_missing_action", {
          expectedAction: "track1-public-login",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining(
          'Action mismatch (expected "track1-public-login", received "undefined")'
        ),
      });
    });

    it("5.3 Rejects when data.hostname is unauthorized", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            hostname: "attacker-domain.evil.com",
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_unauthorized_hostname")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining('Hostname "attacker-domain.evil.com" is not authorized'),
      });
    });

    it("5.4 CRITICAL FIX: Rejects when data.hostname is MISSING/UNDEFINED and hostnames are configured", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            // hostname is omitted!
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_missing_hostname")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining('Hostname "undefined" is not authorized'),
      });
    });

    it("5.5 Accepts when both action and hostname match", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: "track1-public-login",
            hostname: "auth.zolexora.com",
          }),
        })
      );

      await expect(
        service.verifyToken("live_token_valid_action_and_hostname", {
          expectedAction: "track1-public-login",
        })
      ).resolves.toBeUndefined();
    });

    it("5.6 Rejects every hostname when no expected hostnames are configured (fail closed)", async () => {
      const openService = new TurnstileService(DEFAULT_SECRET, DEFAULT_VERIFY_URL, { timeoutMs: 1000, expectedHostnames: [] });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            // no action, arbitrary hostname
            hostname: "arbitrary.domain.com",
          }),
        })
      );

      await expect(
        openService.verifyToken("live_token_open_service")
      ).rejects.toMatchObject({ statusCode: 403, code: "AUTH_TURNSTILE_FAILED" });
    });
  });

  // =========================================================================
  // 6. Timeout, AbortController & Network Failure Handling
  // =========================================================================
  describe("6. Timeout, AbortController & Network Failure Handling", () => {
    it("6.1 Maps AbortError to HTTP 403 AUTH_TURNSTILE_FAILED with timeout message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url, opts) => {
          return new Promise((_resolve, reject) => {
            const err = new Error("The operation was aborted.");
            err.name = "AbortError";
            reject(err);
          });
        })
      );

      await expect(
        service.verifyToken("live_token_aborted_network_call")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining("Network timeout contacting verification gateway"),
      });
    });

    it("6.2 Maps TimeoutError to HTTP 403 AUTH_TURNSTILE_FAILED with timeout message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url, opts) => {
          return new Promise((_resolve, reject) => {
            const err = new Error("Timeout occurred.");
            err.name = "TimeoutError";
            reject(err);
          });
        })
      );

      await expect(
        service.verifyToken("live_token_timeout_error")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining("Network timeout contacting verification gateway"),
      });
    });

    it("6.3 Maps generic network error (e.g. fetch failed) to HTTP 403 (never 500)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("Failed to fetch (DNS resolution failure)"))
      );

      await expect(
        service.verifyToken("live_token_dns_failure")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
        message: expect.stringContaining("remote error"),
      });
    });

    it("6.4 Maps gateway returning non-JSON response (SyntaxError) to HTTP 403 (never 500)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("Unexpected token < in JSON at position 0");
          },
        })
      );

      await expect(
        service.verifyToken("live_token_html_response")
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "AUTH_TURNSTILE_FAILED",
      });
    });
  });

  // =========================================================================
  // 7. Non-Production & Dummy Secret Key Execution
  // =========================================================================
  describe("7. Non-Production & Dummy Secret Key Execution", () => {
    it("7.1 Does NOT short-circuit when secretKey is Cloudflare dummy secret 1x000...00AA", async () => {
      const dummyService = new TurnstileService(
        "1x0000000000000000000000000000000AA",
        DEFAULT_VERIFY_URL,
        { timeoutMs: 1000, expectedHostnames: ["auth.zolexora.com"] }
      );

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          hostname: "auth.zolexora.com",
        }),
      });
      vi.stubGlobal("fetch", fetchSpy);

      await expect(
        dummyService.verifyToken("live_token_with_dummy_secret")
      ).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("7.2 Does NOT short-circuit when NODE_ENV is 'test' or 'development'", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      try {
        const fetchSpy = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            hostname: "auth.zolexora.com",
          }),
        });
        vi.stubGlobal("fetch", fetchSpy);

        await expect(
          service.verifyToken("live_token_non_prod_env")
        ).resolves.toBeUndefined();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});
