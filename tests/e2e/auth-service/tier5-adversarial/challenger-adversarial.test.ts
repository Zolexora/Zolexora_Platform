import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";
import { validatePassword } from "../helpers/crypto";
import { StorageService } from "../../../../apps/auth-service/src/services/storage.service.js";
import { TokenService } from "../../../../apps/auth-service/src/services/token.service.js";

describe("Tier 5: Empirical Adversarial Security & Stress Suite (Challenger Probe)", () => {
  let harness: TestHarness;
  const storageService = new StorageService("zolexora", "https://storage.zolexora.com");
  const tokenService = new TokenService();

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => {
    harness.resetState();
  });

  // ===========================================================================
  // 1. CLOUDFLARE TURNSTILE BOT DEFENSE
  // ===========================================================================
  describe("1. Cloudflare Turnstile Bot Defense Adversarial Tests", () => {
    it("T5.1.01: Missing Turnstile token returns HTTP 400 AUTH_TURNSTILE_REQUIRED across routes", async () => {
      // 1. Public Signup
      const signupRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "challenger_probe1@zolexora.com",
          phoneNumber: "+919876543210",
          password: FIXTURES.passwords.standard,
        }),
      });
      expect(signupRes.status).toBe(400);
      const signupData = await signupRes.json();
      expect(signupData.code).toBe("AUTH_TURNSTILE_REQUIRED");

      // 2. Public Login
      const loginRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
        }),
      });
      expect(loginRes.status).toBe(400);
      const loginData = await loginRes.json();
      expect(loginData.code).toBe("AUTH_TURNSTILE_REQUIRED");

      // 3. Employee Login
      const empRes = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: FIXTURES.ids.validOrg,
          user_id_or_email: "dispatcher@zolexora.com",
          password: FIXTURES.passwords.standard,
        }),
      });
      expect(empRes.status).toBe(400);
      const empData = await empRes.json();
      expect(empData.code).toBe("AUTH_TURNSTILE_REQUIRED");

      // 4. Admin Login
      const adminRes = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_email: FIXTURES.emails.adminUser,
          password: FIXTURES.passwords.admin,
        }),
      });
      expect(adminRes.status).toBe(400);
      const adminData = await adminRes.json();
      expect(adminData.code).toBe("AUTH_TURNSTILE_REQUIRED");
    });

    it("T5.1.02: Whitespace-only Turnstile token is rejected (400 or 403)", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
          turnstile_token: "    ",
        }),
      });
      expect([400, 403]).toContain(res.status);
      const data = await res.json();
      expect(["AUTH_TURNSTILE_REQUIRED", "AUTH_TURNSTILE_FAILED"]).toContain(data.code);
    });

    it("T5.1.03: Invalid/forged Turnstile token returns HTTP 403 AUTH_TURNSTILE_FAILED", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
          turnstile_token: "malicious_bot_token_9999",
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("AUTH_TURNSTILE_FAILED");
    });

    it("T5.1.04: Duplicate/replayed token returns HTTP 403 AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
          turnstile_token: FIXTURES.turnstile.timeoutDuplicate,
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE");
    });

    it("T5.1.05: Header vs Body Precedence: Body takes precedence over Header", async () => {
      // 1. Body INVALID, Header VALID -> Body takes precedence -> 403 Rejected
      const res1 = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Turnstile-Token": FIXTURES.turnstile.valid,
        },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
          turnstile_token: FIXTURES.turnstile.invalid,
        }),
      });
      expect(res1.status).toBe(403);
      const data1 = await res1.json();
      expect(data1.code).toBe("AUTH_TURNSTILE_FAILED");

      // 2. Body VALID, Header INVALID -> Body takes precedence -> 200 Accepted
      const res2 = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Turnstile-Token": FIXTURES.turnstile.invalid,
        },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);

      // 3. Body omitted, Header VALID -> Header accepted -> 200 Accepted
      const res3 = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Turnstile-Token": FIXTURES.turnstile.valid,
        },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
        }),
      });
      expect(res3.status).toBe(200);
      const data3 = await res3.json();
      expect(data3.success).toBe(true);
    });
  });

  // ===========================================================================
  // 2. SLIDING-WINDOW RATE LIMITER & ISOLATION
  // ===========================================================================
  describe("2. Sliding-Window Rate Limiter & IP/Account Isolation", () => {
    it("T5.2.01: 5 failed attempts allowed (401); 6th triggers 429 with integer Retry-After", async () => {
      const ip = "198.51.100.151";

      for (let i = 1; i <= 5; i++) {
        const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": ip,
          },
          body: JSON.stringify({
            email: "rate_stress_victim@zolexora.com",
            password: "WrongPassword123!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.code).toBe("AUTH_INVALID_CREDENTIALS");
      }

      // 6th attempt: lockout
      const lockedRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({
          email: "rate_stress_victim@zolexora.com",
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });

      expect(lockedRes.status).toBe(429);
      const data = await lockedRes.json();
      expect(data.code).toBe("AUTH_RATE_LIMITED");

      const retryAfter = lockedRes.headers.get("Retry-After");
      expect(retryAfter).toBeDefined();
      const retryNum = Number(retryAfter);
      expect(Number.isInteger(retryNum)).toBe(true);
      expect(retryNum).toBeGreaterThan(0);
      expect(retryNum).toBeLessThanOrEqual(900);
    });

    it("T5.2.02: Counter resets on successful authentication", async () => {
      const ip = "198.51.100.152";

      // 3 failed attempts
      for (let i = 1; i <= 3; i++) {
        const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
          body: JSON.stringify({
            email: FIXTURES.emails.publicUser,
            password: "WrongPassword123!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
        expect(res.status).toBe(401);
      }

      // Successful login
      const successRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: FIXTURES.passwords.standard,
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(successRes.status).toBe(200);

      // 5 subsequent failures are allowed before lockout
      for (let i = 1; i <= 5; i++) {
        const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
          body: JSON.stringify({
            email: FIXTURES.emails.publicUser,
            password: "WrongPasswordAgain!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
        expect(res.status).toBe(401); // NOT 429
      }

      // 6th attempt after reset triggers 429
      const sixth = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: "WrongPasswordAgain!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(sixth.status).toBe(429);
    });

    it("T5.2.03: Distinct IP addresses are isolated on the same account", async () => {
      const targetEmail = FIXTURES.emails.publicUser;
      const ipA = "198.51.100.161";
      const ipB = "198.51.100.162";

      // Lock out IP A on targetEmail
      for (let i = 1; i <= 5; i++) {
        await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
          body: JSON.stringify({
            email: targetEmail,
            password: "WrongPassword123!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
      }

      const lockedA = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
        body: JSON.stringify({
          email: targetEmail,
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(lockedA.status).toBe(429);

      // IP B targeting SAME account with wrong credentials receives 401 (not 429)
      const wrongB = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ipB },
        body: JSON.stringify({
          email: targetEmail,
          password: "DifferentWrongPassword!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(wrongB.status).toBe(401);

      // IP B can successfully log in with valid credentials to the SAME account
      const validB = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ipB },
        body: JSON.stringify({
          email: targetEmail,
          password: FIXTURES.passwords.standard,
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(validB.status).toBe(200);
      const dataB = await validB.json();
      expect(dataB.success).toBe(true);
    });
  });

  // ===========================================================================
  // 3. PASSWORD BOUNDARY ENFORCEMENT
  // ===========================================================================
  describe("3. Password Boundary Enforcement", () => {
    it("T5.3.01: Password length 11 is rejected", () => {
      expect(() => validatePassword("A".repeat(11))).toThrow(/AUTH_PASSWORD_POLICY_VIOLATION.*at least 12/);
    });

    it("T5.3.02: Password length 12 is accepted", () => {
      expect(() => validatePassword("A".repeat(12))).not.toThrow();
    });

    it("T5.3.03: Password length 1024 bytes is accepted", () => {
      expect(() => validatePassword("A".repeat(1024))).not.toThrow();
    });

    it("T5.3.04: Password length 1025 bytes is rejected before hashing computation", () => {
      expect(() => validatePassword("A".repeat(1025))).toThrow(/AUTH_PASSWORD_POLICY_VIOLATION.*not exceed 1024/);
    });
  });

  // ===========================================================================
  // 4. STORAGE & KYC (MIME CHECK, 10MB LIMIT, SIGNED URL CLAMPING)
  // ===========================================================================
  describe("4. Storage & KYC Security", () => {
    it("T5.4.01: Unauthorized MIME types return HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const forbidden = ["text/plain", "application/x-msdownload", "application/zip", "video/mp4"];

      for (const mime of forbidden) {
        const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-File-Mime": mime,
            "X-File-Size": "2048",
          },
          body: JSON.stringify({
            document_type: "id_proof",
            mime_type: mime,
            file_size: 2048,
          }),
        });
        expect(res.status).toBe(415);
        const data = await res.json();
        expect(data.code).toBe("AUTH_INVALID_MIME_TYPE");
      }
    });

    it("T5.4.02: Upload exceeding 10MB limit returns HTTP 400 AUTH_FILE_TOO_LARGE", async () => {
      const overLimit = 10 * 1024 * 1024 + 1; // 10,485,761 bytes
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/pdf",
          "X-File-Size": String(overLimit),
        },
        body: JSON.stringify({
          document_type: "passport",
          mime_type: "application/pdf",
          file_size: overLimit,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("AUTH_FILE_TOO_LARGE");
    });

    it("T5.4.03: Signed URL expiry is strictly clamped between 600s and 900s", async () => {
      // 1. Upload valid document
      const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/pdf",
          "X-File-Size": "1024",
        },
        body: JSON.stringify({
          document_type: "incorporation",
          mime_type: "application/pdf",
          file_size: 1024,
        }),
      });
      expect(uploadRes.status).toBe(201);
      const uploadData = await uploadRes.json();
      const docId = uploadData.document_id;

      // Below min: 300s -> clamped to 600s
      const signLow = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expiry_seconds: 300 }),
      });
      expect(signLow.status).toBe(200);
      const lowData = await signLow.json();
      expect(lowData.expires_in_seconds).toBe(600);

      // Exact boundaries: 600s and 900s accepted
      const sign600 = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expiry_seconds: 600 }),
      });
      expect(sign600.status).toBe(200);
      expect((await sign600.json()).expires_in_seconds).toBe(600);

      const sign900 = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expiry_seconds: 900 }),
      });
      expect(sign900.status).toBe(200);
      expect((await sign900.json()).expires_in_seconds).toBe(900);

      // Above max: 1200s -> clamped to 900s
      const signHigh = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expiry_seconds: 1200 }),
      });
      expect(signHigh.status).toBe(200);
      const highData = await signHigh.json();
      expect(highData.expires_in_seconds).toBe(900);
    });
  });

  // ===========================================================================
  // 5. TOKEN REVOCATION & IMMEDIATE INVALIDATION
  // ===========================================================================
  describe("5. Token Revocation & Immediate Invalidation", () => {
    it("T5.5.01: Revocation immediately invalidates subsequent /api/v1/auth/me calls", async () => {
      const targetUid = "emp_target_revocation_e2e";
      const token = `token_belonging_to_${targetUid}`;

      // 1. Token works before revocation
      const beforeRes = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(beforeRes.status).toBe(200);
      const beforeData = await beforeRes.json();
      expect(beforeData.authenticated).toBe(true);

      // 2. Revoke the token
      const revokeRes = await fetch(`${harness.baseUrl}/api/v1/auth/tokens/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: targetUid, reason: "Security violation" }),
      });
      expect(revokeRes.status).toBe(200);
      const revokeData = await revokeRes.json();
      expect(revokeData.success).toBe(true);
      expect(revokeData.uid).toBe(targetUid);
      expect(revokeData.revoked_at).toBeDefined();

      // 3. Subsequent /api/v1/auth/me immediately returns 401 AUTH_TOKEN_REVOKED
      const afterRes = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(afterRes.status).toBe(401);
      const afterData = await afterRes.json();
      expect(afterData.code).toBe("AUTH_TOKEN_REVOKED");

      // 4. Token for another, unrevoked user remains valid
      const otherToken = "token_belonging_to_innocent_user_102";
      const otherRes = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      expect(otherRes.status).toBe(200);
    });
  });

  // ===========================================================================
  // 6. SIGNED URL TAMPERING ADVERSARIAL SUITE
  // ===========================================================================
  describe("6. Signed URL Tampering Adversarial Suite", () => {
    it("T5.6.01: Genuine signed URL generated via /api/v1/storage/kyc/signed-url cryptographically verifies", async () => {
      // 1. Upload valid KYC doc
      const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/pdf",
          "X-File-Size": "2048",
        },
        body: JSON.stringify({
          document_type: "id_proof",
          mime_type: "application/pdf",
          file_size: 2048,
        }),
      });
      expect(uploadRes.status).toBe(201);
      const uploadData = await uploadRes.json();
      const docId = uploadData.document_id;

      // 2. Request signed URL
      const signRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expiry_seconds: 600 }),
      });
      expect(signRes.status).toBe(200);
      const signData = await signRes.json();
      const signedUrl = signData.signed_url;

      // 3. Cryptographic verification
      const verify = storageService.verifySignedUrl(signedUrl);
      expect(verify.valid).toBe(true);
      expect(verify.reason).toBeUndefined();
    });

    it("T5.6.02: Modified HMAC signature in signed URL is rejected with reason INVALID_SIGNATURE", async () => {
      const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/pdf",
          "X-File-Size": "2048",
        },
        body: JSON.stringify({ document_type: "passport", mime_type: "application/pdf", file_size: 2048 }),
      });
      const uploadData = await uploadRes.json();

      const signRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: uploadData.document_id, expiry_seconds: 900 }),
      });
      const signData = await signRes.json();
      const genuineUrl = signData.signed_url;

      const parsedUrl = new URL(genuineUrl);
      const currentSig = parsedUrl.searchParams.get("sig")!;
      const tamperedSig = (currentSig[0] === "a" ? "b" : "a") + currentSig.slice(1);
      const tamperedUrl = genuineUrl.replace(`sig=${currentSig}`, `sig=${tamperedSig}`);

      const verify = storageService.verifySignedUrl(tamperedUrl);
      expect(verify.valid).toBe(false);
      expect(verify.reason).toBe("INVALID_SIGNATURE");
    });

    it("T5.6.03: Tampered expiry timestamp (extended TTL) is rejected with reason INVALID_SIGNATURE", async () => {
      const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/pdf",
          "X-File-Size": "2048",
        },
        body: JSON.stringify({ document_type: "passport", mime_type: "application/pdf", file_size: 2048 }),
      });
      const uploadData = await uploadRes.json();

      const signRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: uploadData.document_id, expiry_seconds: 600 }),
      });
      const signData = await signRes.json();
      const genuineUrl = signData.signed_url;

      const parsedUrl = new URL(genuineUrl);
      const currentExpires = parsedUrl.searchParams.get("expires")!;
      const tamperedExpires = String(Number(currentExpires) + 86400);
      const tamperedUrl = genuineUrl.replace(`expires=${currentExpires}`, `expires=${tamperedExpires}`);

      const verify = storageService.verifySignedUrl(tamperedUrl);
      expect(verify.valid).toBe(false);
      expect(verify.reason).toBe("INVALID_SIGNATURE");
    });

    it("T5.6.04: Tampered document ID / resource path in URL is rejected with reason INVALID_SIGNATURE", async () => {
      const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/pdf",
          "X-File-Size": "2048",
        },
        body: JSON.stringify({ document_type: "passport", mime_type: "application/pdf", file_size: 2048 }),
      });
      const uploadData = await uploadRes.json();
      const docId = uploadData.document_id;

      const signRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expiry_seconds: 600 }),
      });
      const signData = await signRes.json();
      const genuineUrl = signData.signed_url;

      const tamperedDocUrl = genuineUrl.replace(docId, "kyc_impostor_victim_doc_99999");

      const verify = storageService.verifySignedUrl(tamperedDocUrl);
      expect(verify.valid).toBe(false);
      expect(verify.reason).toBe("INVALID_SIGNATURE");
    });

    it("T5.6.05: Expired signed URL is rejected with reason URL_EXPIRED", () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 300;
      const testDocId = "kyc_expired_test_doc_123";
      const expiredCanonical = `${testDocId}:${pastExpiry}`;
      const expiredSig = createHmac("sha256", "zolexora-platform-auth-secret-key-32bytes-min")
        .update(expiredCanonical)
        .digest("hex");
      const expiredUrl = `https://storage.zolexora.com/private/kyc/${testDocId}?expires=${pastExpiry}&sig=${expiredSig}`;

      const verify = storageService.verifySignedUrl(expiredUrl);
      expect(verify.valid).toBe(false);
      expect(verify.reason).toBe("URL_EXPIRED");
    });

    it("T5.6.06: Malformed or missing signed URL parameters are rejected", () => {
      expect(storageService.verifySignedUrl("https://storage.zolexora.com/private/kyc/doc123?expires=123456").valid).toBe(false);
      expect(storageService.verifySignedUrl("https://storage.zolexora.com/private/kyc/doc123?sig=abcd1234").valid).toBe(false);
      expect(storageService.verifySignedUrl("not a valid url").valid).toBe(false);
    });
  });

  // ===========================================================================
  // 7. RBAC BYPASS & TENANT BOUNDARY ISOLATION SUITE
  // ===========================================================================
  describe("7. RBAC Bypass & Tenant Boundary Isolation Suite", () => {
    it("T5.7.01: Cross-tenant KYC signed URL generation is strictly blocked with HTTP 403 AUTH_FORBIDDEN", async () => {
      const orgA = "ZX-ORG-4B8T-9M2K-7Y4X";
      const orgB = "ZX-ORG-9Z8Y-7X6W-5V4U";

      // 1. Upload KYC doc for Org A
      const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organisation-ID": orgA,
          "X-Zolexora-ID": "ZX-8K9M-4P2W-7Y3X",
        },
        body: JSON.stringify({
          document_type: "tax_return",
          mime_type: "application/pdf",
          file_size: 2048,
          org_id: orgA,
        }),
      });
      expect(uploadRes.status).toBe(201);
      const uploadData = await uploadRes.json();
      const docId = uploadData.document_id;

      // 2. Mint employee token for Org B (cross-tenant intruder)
      const intruderToken = tokenService.mintEmployeeCustomToken(
        "emp_intruder_99",
        {
          zolexora_id: "ZX-2B3C-4D5F-6G7H",
          org_id: orgB,
          role: "admin",
          product: "zolexora-tms",
          permissions: ["trips:read", "kyc:read"],
        }
      );

      // 3. Intruder attempts to generate signed URL for Org A's document
      const signRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${intruderToken}`,
        },
        body: JSON.stringify({ document_id: docId, expiry_seconds: 600 }),
      });

      expect(signRes.status).toBe(403);
      const signData = await signRes.json();
      expect(signData.code).toBe("AUTH_FORBIDDEN");
    });

    it("T5.7.02: Employee with viewer role attempting to upload organization logo is rejected with HTTP 403 AUTH_FORBIDDEN", async () => {
      const orgId = FIXTURES.ids.validOrg;
      const viewerToken = tokenService.mintEmployeeCustomToken(
        "emp_viewer_10",
        {
          zolexora_id: "ZX-2B3C-4D5F-6G7H",
          org_id: orgId,
          role: "viewer",
          product: "zolexora-tms",
          permissions: ["trips:read"],
        }
      );

      const res = await fetch(`${harness.baseUrl}/api/v1/storage/logos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organisation-ID": orgId,
          Authorization: `Bearer ${viewerToken}`,
        },
        body: JSON.stringify({
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("AUTH_FORBIDDEN");
    });

    it("T5.7.03: Cross-tenant organization logo upload is strictly blocked with HTTP 403 AUTH_FORBIDDEN", async () => {
      const orgA = FIXTURES.ids.validOrg;
      const orgB = "ZX-ORG-9Z8Y-7X6W-5V4U";

      const tokenOrgA = tokenService.mintEmployeeCustomToken(
        "emp_admin_org_a",
        {
          zolexora_id: "ZX-8K9M-4P2W-7Y3X",
          org_id: orgA,
          role: "admin",
          product: "zolexora-tms",
          permissions: ["org:admin", "logos:write"],
        }
      );

      // Admin from Org A tries to upload logo for Org B
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/logos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organisation-ID": orgB,
          Authorization: `Bearer ${tokenOrgA}`,
        },
        body: JSON.stringify({
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("AUTH_FORBIDDEN");
    });

    it("T5.7.04: Non-owner user attempting to upload avatar for another user ID is rejected with HTTP 403 AUTH_FORBIDDEN", async () => {
      const userAId = "ZX-8K9M-4P2W-7Y3X";
      const userBId = "ZX-2B3C-4D5F-6G7H";

      const tokenUserA = tokenService.mintUserCustomToken("usr_alice", userAId);

      // Alice tries to upload avatar for Bob
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/avatars/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Zolexora-ID": userBId,
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          file: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("AUTH_FORBIDDEN");
    });
  });

  // ===========================================================================
  // 8. CROSS-TENANT CREDENTIAL INJECTION SUITE
  // ===========================================================================
  describe("8. Cross-Tenant Credential Injection Suite", () => {
    it("T5.8.01: Valid employee credentials belonging to Org A injected into Org B login payload returns HTTP 401 AUTH_INVALID_CREDENTIALS", async () => {
      const otherOrg = "ZX-ORG-9Z8Y-7X6W-5V4U";

      const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: "zolexora-tms",
          org_id: otherOrg, // Wrong Org!
          user_id_or_email: "dispatcher@zolexora.com", // Belongs to validOrg
          password: FIXTURES.passwords.standard,
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_INVALID_CREDENTIALS");
    });

    it("T5.8.02: Org employee credentials injected into Platform Admin login endpoint returns HTTP 401 AUTH_INVALID_ADMIN_CREDENTIALS", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_email: "dispatcher@zolexora.com",
          password: FIXTURES.passwords.standard,
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_INVALID_ADMIN_CREDENTIALS");
    });

    it("T5.8.03: Platform Admin credentials injected into Org Employee Track 2 endpoint returns HTTP 401 AUTH_INVALID_CREDENTIALS", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: "zolexora-tms",
          org_id: FIXTURES.ids.validOrg,
          user_id_or_email: FIXTURES.emails.adminUser,
          password: FIXTURES.passwords.admin,
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_INVALID_CREDENTIALS");
    });
  });

  // ===========================================================================
  // 9. ADMIN PRIVILEGE ESCALATION VIA MANIPULATED CUSTOM CLAIMS
  // ===========================================================================
  describe("9. Admin Privilege Escalation via Manipulated Custom Claims", () => {
    it("T5.9.01: Forged JWT with escalated claim role='superadmin' and mismatched signature returns HTTP 401 AUTH_UNAUTHORIZED", async () => {
      const validToken = tokenService.mintUserCustomToken("usr_victim", "ZX-8K9M-4P2W-7Y3X");
      const [header, payload, sig] = validToken.split(".");

      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      decoded.role = "superadmin";
      decoded.is_platform_admin = true;
      decoded.permissions = ["*"];
      const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
      const tamperedToken = `${header}.${forgedPayload}.${sig}`;

      const res = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_UNAUTHORIZED");
      expect(data.message).toContain("Invalid or forged token signature");
    });

    it("T5.9.02: Forged JWT signed with unauthorized secret claiming superadmin rights returns HTTP 401 AUTH_UNAUTHORIZED", async () => {
      const rogueTokenService = new TokenService("rogue-attacker-signing-secret-key-1234");
      const rogueToken = rogueTokenService.mintAdminCustomToken("adm_fake", {
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        role: "superadmin",
        permissions: ["*"],
        is_platform_admin: true,
      });

      const res = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${rogueToken}` },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_UNAUTHORIZED");
      expect(data.message).toContain("Invalid or forged token signature");
    });

    it("T5.9.03: Token with future iat timestamp (+600s clock skew attack) returns HTTP 401 AUTH_TOKEN_FUTURE_IAT", async () => {
      const futureToken = "token_with_future_iat_attack_600s";

      const res = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${futureToken}` },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_TOKEN_FUTURE_IAT");
    });

    it("T5.9.04: Expired token with legitimate signature returns HTTP 401 AUTH_TOKEN_EXPIRED", async () => {
      const expiredToken = "expired_token";

      const res = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_TOKEN_EXPIRED");
    });

    it("T5.9.05: Self-registration targeting platform admin tier is permanently blocked with HTTP 403 AUTH_ADMIN_SIGNUP_FORBIDDEN", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/admin/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "superadmin_backdoor@zolexora.com",
          password: FIXTURES.passwords.admin,
          role: "superadmin",
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("AUTH_ADMIN_SIGNUP_FORBIDDEN");
    });
  });
});
