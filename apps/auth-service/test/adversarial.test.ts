import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository } from "../src/repositories/in-memory-auth.repository.js";
import { CONSTANTS } from "../src/config/constants.js";
import { TokenService } from "../src/services/token.service.js";
import { RateLimitService } from "../src/services/rate-limit.service.js";
import { validatePassword } from "@zolexora/utils";

describe("Adversarial Security & Stress Suite (Milestone 2 Challenge)", () => {
  let app: FastifyInstance;
  let repo: InMemoryAuthRepository;

  beforeEach(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildApp({ repo, logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. TURNSTILE BOT DEFENSE ADVERSARIAL STRESS
  // ===========================================================================
  describe("1. Cloudflare Turnstile Bot Defense", () => {
    it("1.1 Rejects missing tokens with HTTP 400 across all protected endpoints", async () => {
      // 1.1a Public Signup
      const resSignup = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "challenger_turnstile1@zolexora.com",
          phoneNumber: "+919876543210",
          password: "CorporateSecurePass123!",
        },
      });
      expect(resSignup.statusCode).toBe(400);
      expect(resSignup.json().code).toBe("AUTH_TURNSTILE_REQUIRED");

      // 1.1b Public Login
      const resLogin = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
        },
      });
      expect(resLogin.statusCode).toBe(400);
      expect(resLogin.json().code).toBe("AUTH_TURNSTILE_REQUIRED");

      // 1.1c Employee Login
      const resEmployee = await app.inject({
        method: "POST",
        url: "/api/v1/auth/employee/login",
        payload: {
          org_id: "ZX-ORG-4B8T-9M2K-7Y4X",
          user_id_or_email: "dispatcher@zolexora.com",
          password: "CorporateSecurePass123!",
        },
      });
      expect(resEmployee.statusCode).toBe(400);
      expect(resEmployee.json().code).toBe("AUTH_TURNSTILE_REQUIRED");

      // 1.1d Admin Login
      const resAdmin = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/login",
        payload: {
          username_or_email: "superadmin@zolexora.com",
          password: "MasterSuperadminSecret2026!",
        },
      });
      expect(resAdmin.statusCode).toBe(400);
      expect(resAdmin.json().code).toBe("AUTH_TURNSTILE_REQUIRED");

      // 1.1e Password Reset
      const resReset = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/reset-password",
        payload: {
          email: "consumer@clarityfi.app",
        },
      });
      expect(resReset.statusCode).toBe(400);
      expect(resReset.json().code).toBe("AUTH_TURNSTILE_REQUIRED");
    });

    it("1.2 Rejects whitespace-only tokens with HTTP 400 AUTH_TURNSTILE_REQUIRED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: "    ",
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("AUTH_TURNSTILE_REQUIRED");
    });

    it("1.3 Rejects invalid/forged tokens with HTTP 403 AUTH_TURNSTILE_FAILED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: "0.invalid-cf-turnstile-token",
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("AUTH_TURNSTILE_FAILED");
    });

    it("1.4 Rejects duplicate/replayed tokens with HTTP 403 AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: CONSTANTS.TURNSTILE.TIMEOUT_DUPLICATE_TOKEN,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE");
    });

    it("1.5 Header vs Body Precedence: Body token takes precedence over Header token", async () => {
      // 1.5a Body is INVALID, Header is VALID -> Body takes precedence -> Rejected with 403
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: {
          "cf-turnstile-token": CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: CONSTANTS.TURNSTILE.INVALID_TOKEN,
        },
      });
      expect(res1.statusCode).toBe(403);
      expect(res1.json().code).toBe("AUTH_TURNSTILE_FAILED");

      // 1.5b Body is VALID, Header is INVALID -> Body takes precedence -> Accepted with 200
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: {
          "cf-turnstile-token": CONSTANTS.TURNSTILE.INVALID_TOKEN,
        },
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().success).toBe(true);

      // 1.5c Body is OMITTED, Header is VALID -> Header used -> Accepted with 200
      const res3 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: {
          "cf-turnstile-token": CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
        },
      });
      expect(res3.statusCode).toBe(200);
      expect(res3.json().success).toBe(true);

      // 1.5d Mixed-case header CF-Turnstile-Token is accepted
      const res4 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: {
          "CF-Turnstile-Token": CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
        },
      });
      expect(res4.statusCode).toBe(200);
      expect(res4.json().success).toBe(true);
    });

    it("1.6 Official Cloudflare dummy tokens: 1x... passes, 2x... is rejected with 403", async () => {
      // 1x... always passes
      const resPass = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: "1x00000000000000000000AA",
        },
      });
      expect(resPass.statusCode).toBe(200);

      // 2x... always fails
      const resFail = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: "2x00000000000000000000AA",
        },
      });
      expect(resFail.statusCode).toBe(403);
      expect(resFail.json().code).toBe("AUTH_TURNSTILE_FAILED");
    });
  });

  // ===========================================================================
  // 2. SLIDING-WINDOW RATE LIMITER & ISOLATION STRESS
  // ===========================================================================
  describe("2. Sliding-Window Rate Limiting & Account/IP Isolation", () => {
    it("2.1 Exactly 5 failed attempts allowed (401); 6th triggers 429 with integer Retry-After", async () => {
      const ip = "198.51.100.111";

      for (let i = 1; i <= 5; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/login",
          headers: { "x-forwarded-for": ip },
          payload: {
            email: "victim_rate1@zolexora.com",
            password: "WrongPassword123!",
            turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
          },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().code).toBe("AUTH_INVALID_CREDENTIALS");
      }

      // 6th attempt: Lockout
      const lockedRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ip },
        payload: {
          email: "victim_rate1@zolexora.com",
          password: "WrongPassword123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });

      expect(lockedRes.statusCode).toBe(429);
      const data = lockedRes.json();
      expect(data.code).toBe("AUTH_RATE_LIMITED");
      expect(data.error.code).toBe("AUTH_RATE_LIMITED");

      // Verify Retry-After header
      const retryHeader = lockedRes.headers["retry-after"];
      expect(retryHeader).toBeDefined();
      const retrySec = Number(retryHeader);
      expect(Number.isInteger(retrySec)).toBe(true);
      expect(retrySec).toBeGreaterThan(0);
      expect(retrySec).toBeLessThanOrEqual(900);
    });

    it("2.2 Counter resets immediately upon successful authentication", async () => {
      const ip = "198.51.100.112";
      const email = "consumer@clarityfi.app";

      // 3 failed attempts
      for (let i = 1; i <= 3; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/login",
          headers: { "x-forwarded-for": ip },
          payload: {
            email,
            password: "WrongPassword123!",
            turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
          },
        });
        expect(res.statusCode).toBe(401);
      }

      // Successful login resets counter
      const successRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ip },
        payload: {
          email,
          password: "CorporateSecurePass123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(successRes.statusCode).toBe(200);

      // Now 5 more failed attempts must be allowed before 6th triggers lockout
      for (let i = 1; i <= 5; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/login",
          headers: { "x-forwarded-for": ip },
          payload: {
            email,
            password: "WrongPasswordAgain!",
            turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
          },
        });
        expect(res.statusCode).toBe(401); // Not 429!
      }

      // 6th attempt after reset triggers lockout
      const sixthAfterReset = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ip },
        payload: {
          email,
          password: "WrongPasswordAgain!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(sixthAfterReset.statusCode).toBe(429);
    });

    it("2.3 Distinct IP addresses are strictly isolated", async () => {
      const ipVictim = "198.51.100.113";
      const ipInnocent = "198.51.100.114";

      // Lock out ipVictim
      for (let i = 1; i <= 5; i++) {
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/login",
          headers: { "x-forwarded-for": ipVictim },
          payload: {
            email: "user_ip_iso1@zolexora.com",
            password: "WrongPassword123!",
            turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
          },
        });
      }

      const lockedRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ipVictim },
        payload: {
          email: "user_ip_iso1@zolexora.com",
          password: "WrongPassword123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(lockedRes.statusCode).toBe(429);

      // Innocent IP with valid credentials succeeds immediately
      const innocentRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ipInnocent },
        payload: {
          email: "consumer@clarityfi.app",
          password: "CorporateSecurePass123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(innocentRes.statusCode).toBe(200);
      expect(innocentRes.json().success).toBe(true);
    });

    it("2.4 Cross-IP rate limit isolation prevents account lockout DoS (locking IP A does not lock IP B for same account)", async () => {
      const targetEmail = "consumer@clarityfi.app";
      const ipA = "198.51.100.201";
      const ipB = "198.51.100.202";

      // 1. IP A sends 5 failed attempts targeting targetEmail
      for (let i = 1; i <= 5; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/login",
          headers: { "x-forwarded-for": ipA },
          payload: {
            email: targetEmail,
            password: "WrongPassword123!",
            turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
          },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().code).toBe("AUTH_INVALID_CREDENTIALS");
      }

      // 2. IP A 6th attempt triggers HTTP 429 lockout
      const lockedResA = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ipA },
        payload: {
          email: targetEmail,
          password: "WrongPassword123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(lockedResA.statusCode).toBe(429);
      expect(lockedResA.json().code).toBe("AUTH_RATE_LIMITED");

      // 3. IP B targeting the SAME account with incorrect password receives 401 (NOT 429)
      const resBWrong = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ipB },
        payload: {
          email: targetEmail,
          password: "DifferentWrongPassword!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(resBWrong.statusCode).toBe(401);
      expect(resBWrong.json().code).toBe("AUTH_INVALID_CREDENTIALS");

      // 4. IP B targeting the SAME account with valid password authenticates successfully (HTTP 200)
      const resBSuccess = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ipB },
        payload: {
          email: targetEmail,
          password: "CorporateSecurePass123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(resBSuccess.statusCode).toBe(200);
      expect(resBSuccess.json().success).toBe(true);
      expect(resBSuccess.json().customToken).toBeDefined();

      // 5. IP A remains locked out with HTTP 429 even after IP B authenticated successfully
      const lockedResAAfter = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/login",
        headers: { "x-forwarded-for": ipA },
        payload: {
          email: targetEmail,
          password: "CorporateSecurePass123!",
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(lockedResAAfter.statusCode).toBe(429);
    });

    it("2.5 Sliding-window eviction: failed attempts outside 15-minute window do not cause lockout", () => {
      const rateLimiter = new RateLimitService();
      const key = "ip:198.51.100.99";

      // Simulate 4 failures 16 minutes ago (now - 960_000ms)
      const now = Date.now();
      const pastTime = now - 960_000;

      // Access store internally to simulate past timestamps
      (rateLimiter as any).store.set(key, {
        failures: 4,
        lockedUntil: 0,
        timestamps: [pastTime, pastTime + 1000, pastTime + 2000, pastTime + 3000],
      });

      // 5th failure at current time (t = now)
      rateLimiter.recordFailure(key);

      // Stale timestamps should be pruned; current timestamps count = 1, NOT 5 -> No lockout
      expect(() => rateLimiter.checkAllowed(key)).not.toThrow();

      // Opportunistic pruning check
      rateLimiter.pruneExpired(now);
    });
  });

  // ===========================================================================
  // 3. PASSWORD BOUNDARY ENFORCEMENT STRESS
  // ===========================================================================
  describe("3. Password Boundary Enforcement (12 min to 1024 bytes max)", () => {
    it("3.1 Rejects length 11 with 400 AUTH_PASSWORD_POLICY_VIOLATION", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "pass_11@zolexora.com",
          phoneNumber: "+919876543210",
          password: "A".repeat(11),
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("AUTH_PASSWORD_POLICY_VIOLATION");
    });

    it("3.2 Accepts length 12 characters (exact min boundary)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "pass_12@zolexora.com",
          phoneNumber: "+919876543210",
          password: "A".repeat(12),
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it("3.3 Accepts length 1024 bytes (exact max boundary)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "pass_1024@zolexora.com",
          phoneNumber: "+919876543210",
          password: "A".repeat(1024),
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it("3.4 Rejects length 1025 bytes before executing hash computation", async () => {
      const start = performance.now();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "pass_1025@zolexora.com",
          phoneNumber: "+919876543210",
          password: "A".repeat(1025),
          turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
        },
      });
      const elapsed = performance.now() - start;

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("AUTH_PASSWORD_POLICY_VIOLATION");
      expect(elapsed).toBeLessThan(50); // Immediate rejection without expensive Argon2id
    });

    it("3.5 Multibyte UTF-8 password boundaries (byte count vs char count)", () => {
      // 'é' is 2 bytes in UTF-8
      const exact1024Bytes = "é".repeat(512);
      expect(Buffer.byteLength(exact1024Bytes, "utf8")).toBe(1024);
      expect(() => validatePassword(exact1024Bytes)).not.toThrow();

      const over1024Bytes = "é".repeat(513);
      expect(Buffer.byteLength(over1024Bytes, "utf8")).toBe(1026);
      expect(() => validatePassword(over1024Bytes)).toThrow(/exceeds maximum allowed size of 1024 bytes/);
    });
  });

  // ===========================================================================
  // 4. STORAGE & KYC BOUNDARIES & SIGNED URL CLAMPING
  // ===========================================================================
  describe("4. Storage & KYC Security (MIME Check, 10MB Limit, Signed URL Clamping)", () => {
    it("4.1 Rejects unauthorized MIME types with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const forbidden = [
        "text/plain",
        "application/x-msdownload",
        "application/zip",
        "video/mp4",
        "image/gif",
        "application/octet-stream",
      ];

      for (const mime of forbidden) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/storage/kyc/upload",
          headers: {
            "x-file-mime": mime,
            "x-file-size": "2048",
          },
          payload: {
            document_type: "identity",
            mime_type: mime,
            file_size: 2048,
          },
        });
        expect(res.statusCode).toBe(415);
        expect(res.json().code).toBe("AUTH_INVALID_MIME_TYPE");
      }
    });

    it("4.2 Accepts all permitted MIME types (pdf, png, jpeg, webp)", async () => {
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

      for (const mime of allowed) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/storage/kyc/upload",
          headers: {
            "x-file-mime": mime,
            "x-file-size": "2048",
          },
          payload: {
            document_type: "kyc_doc",
            mime_type: mime,
            file_size: 2048,
          },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().mime_type).toBe(mime);
      }
    });

    it("4.3 Exactly 10MB is accepted; 10MB + 1 byte is rejected with HTTP 400", async () => {
      const max10MB = 10 * 1024 * 1024; // 10,485,760 bytes

      // Exact 10MB: Accepted
      const resValid = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          "x-file-mime": "application/pdf",
          "x-file-size": String(max10MB),
        },
        payload: {
          document_type: "passport",
          mime_type: "application/pdf",
          file_size: max10MB,
        },
      });
      expect(resValid.statusCode).toBe(201);
      expect(resValid.json().file_size).toBe(max10MB);

      // 10MB + 1 byte: Rejected
      const resOver = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          "x-file-mime": "application/pdf",
          "x-file-size": String(max10MB + 1),
        },
        payload: {
          document_type: "passport",
          mime_type: "application/pdf",
          file_size: max10MB + 1,
        },
      });
      expect(resOver.statusCode).toBe(400);
      expect(resOver.json().code).toBe("AUTH_FILE_TOO_LARGE");
    });

    it("4.4 Signed URL expiry is strictly clamped between 600s and 900s", async () => {
      // 1. Upload a document to sign
      const uploadRes = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: { "x-file-mime": "application/pdf" },
        payload: { document_type: "license", mime_type: "application/pdf", file_size: 1024 },
      });
      const docId = uploadRes.json().document_id;

      // 4.4a Below minimum: 300s -> clamped to 600s
      const sign300 = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        payload: { document_id: docId, expiry_seconds: 300 },
      });
      expect(sign300.statusCode).toBe(200);
      expect(sign300.json().expires_in_seconds).toBe(600);

      // 4.4b 599s -> clamped to 600s
      const sign599 = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        payload: { document_id: docId, expiry_seconds: 599 },
      });
      expect(sign599.statusCode).toBe(200);
      expect(sign599.json().expires_in_seconds).toBe(600);

      // 4.4c Exact lower boundary: 600s -> accepted as 600s
      const sign600 = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        payload: { document_id: docId, expiry_seconds: 600 },
      });
      expect(sign600.statusCode).toBe(200);
      expect(sign600.json().expires_in_seconds).toBe(600);

      // 4.4d Midpoint: 750s -> accepted as 750s
      const sign750 = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        payload: { document_id: docId, expiry_seconds: 750 },
      });
      expect(sign750.statusCode).toBe(200);
      expect(sign750.json().expires_in_seconds).toBe(750);

      // 4.4e Exact upper boundary: 900s -> accepted as 900s
      const sign900 = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        payload: { document_id: docId, expiry_seconds: 900 },
      });
      expect(sign900.statusCode).toBe(200);
      expect(sign900.json().expires_in_seconds).toBe(900);

      // 4.4f Above maximum: 901s -> clamped to 900s
      const sign901 = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        payload: { document_id: docId, expiry_seconds: 901 },
      });
      expect(sign901.statusCode).toBe(200);
      expect(sign901.json().expires_in_seconds).toBe(900);

      // 4.4g Negative / zero expiry clamped to 600s
      const signNeg = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        payload: { document_id: docId, expiry_seconds: -100 },
      });
      expect(signNeg.statusCode).toBe(200);
      expect(signNeg.json().expires_in_seconds).toBe(600);
    });
  });

  // ===========================================================================
  // 5. TOKEN REVOCATION & INTROSPECTION INVALIDATION
  // ===========================================================================
  describe("5. Token Revocation & Immediate Session Invalidation", () => {
    it("5.1 Subsequent /api/v1/auth/me calls are immediately rejected with HTTP 401 following revocation", async () => {
      const uid = "emp_adversarial_revocation_007";
      const token = `token_belonging_to_${uid}`;

      // 1. Token is authorized before revocation
      const beforeRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(beforeRes.statusCode).toBe(200);
      expect(beforeRes.json().authenticated).toBe(true);

      // 2. Revoke token
      const revokeRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/tokens/revoke",
        payload: { uid, reason: "Adversarial test invalidation" },
      });
      expect(revokeRes.statusCode).toBe(200);
      const revokeData = revokeRes.json();
      expect(revokeData.success).toBe(true);
      expect(revokeData.uid).toBe(uid);
      expect(revokeData.revoked_at).toBeDefined();

      // 3. Same token is immediately rejected
      const afterRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(afterRes.statusCode).toBe(401);
      const err = afterRes.json();
      expect(err.code).toBe("AUTH_TOKEN_REVOKED");
      expect(err.error.code).toBe("AUTH_TOKEN_REVOKED");

      // 4. Other unrevoked user's token is still valid
      const otherToken = "token_belonging_to_innocent_user_999";
      const otherRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(otherRes.statusCode).toBe(200);
      expect(otherRes.json().authenticated).toBe(true);
    });

    it("5.2 Rejects requests without Authorization header with HTTP 401 AUTH_UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("AUTH_UNAUTHORIZED");
    });

    it("5.3 Validates token issuance timestamp (iat <= T rejected, iat > T accepted)", async () => {
      const uid = "emp_timestamp_test_101";
      const tokenService = new TokenService();

      // Issue Token 1 before revocation (simulated older timestamp)
      const tokenBefore = tokenService.signJwt({
        uid,
        email: `${uid}@zolexora.com`,
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        iat: 1000,
        exp: 9999999999,
      });

      // Token 1 works before revocation
      const resBefore = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${tokenBefore}` },
      });
      expect(resBefore.statusCode).toBe(200);

      // Revoke user at current timestamp T
      await repo.revokeToken(uid, "Password reset");

      // Token 1 (iat = 1000 <= T) is immediately rejected
      const resAfterOld = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${tokenBefore}` },
      });
      expect(resAfterOld.statusCode).toBe(401);
      expect(resAfterOld.json().code).toBe("AUTH_TOKEN_REVOKED");

      // User re-authenticates and receives fresh token minted after revocation (iat > T)
      const tokenAfter = tokenService.signJwt({
        uid,
        email: `${uid}@zolexora.com`,
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        iat: Math.floor(Date.now() / 1000) + 10,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Fresh token (iat > T) is accepted
      const resAfterNew = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${tokenAfter}` },
      });
      expect(resAfterNew.statusCode).toBe(200);
      expect(resAfterNew.json().authenticated).toBe(true);
    });

    it("5.4 Rejects token with future iat exceeding clock skew tolerance (+600s) with HTTP 401", async () => {
      const uid = "usr_attacker_future_600";
      const tokenService = new TokenService();
      const now = Math.floor(Date.now() / 1000);

      const futureToken = tokenService.signJwt({
        uid,
        email: `${uid}@zolexora.com`,
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        iat: now + 600, // 10 minutes in the future (> 300s)
        exp: now + 3600,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${futureToken}` },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(["AUTH_TOKEN_FUTURE_IAT", "AUTH_UNAUTHORIZED"]).toContain(body.code);
    });

    it("5.5 Rejects token with iat strictly 1 second past clock skew tolerance (now + 301s) with HTTP 401", async () => {
      const uid = "usr_attacker_future_301";
      const tokenService = new TokenService();
      const now = Math.floor(Date.now() / 1000);

      const futureToken = tokenService.signJwt({
        uid,
        email: `${uid}@zolexora.com`,
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        iat: now + 301, // strictly > 300s
        exp: now + 3600,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${futureToken}` },
      });

      expect(res.statusCode).toBe(401);
    });

    it("5.6 Accepts token with iat within allowable clock skew tolerance (now + 10s and now + 300s)", async () => {
      const uid = "usr_legit_skewed";
      const tokenService = new TokenService();
      const now = Math.floor(Date.now() / 1000);

      // 1. Within 10s skew
      const token10 = tokenService.signJwt({
        uid,
        email: `${uid}@zolexora.com`,
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        iat: now + 10,
        exp: now + 3600,
      });

      const res10 = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token10}` },
      });
      expect(res10.statusCode).toBe(200);
      expect(res10.json().authenticated).toBe(true);

      // 2. Exactly at 300s boundary
      const token300 = tokenService.signJwt({
        uid,
        email: `${uid}@zolexora.com`,
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        iat: now + 300,
        exp: now + 3600,
      });

      const res300 = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token300}` },
      });
      expect(res300.statusCode).toBe(200);
      expect(res300.json().authenticated).toBe(true);
    });
  });
});
