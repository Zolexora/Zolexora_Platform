import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";
import { pdfDataUrl, webpDataUrl } from "../helpers/files";
import {
  validatePassword,
  isValidZolexoraOrgId,
  normalizeZolexoraOrgId,
} from "../helpers/crypto";

describe("Tier 2: Boundary Value Analysis (BVA) & Corner Cases (25 Tests)", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => harness.resetState());

  // ==========================================
  // Domain 1: Password Boundary Testing
  // ==========================================
  describe("Domain 1: Password Length Boundaries (12 to 1024 bytes)", () => {
    it("T2.1.01: Password of length 0 (empty string) is rejected", () => {
      expect(() => validatePassword("")).toThrow(/AUTH_PASSWORD_POLICY_VIOLATION/);
    });

    it("T2.1.02: Password of length 11 characters (1 below min) is rejected", () => {
      expect(() => validatePassword("A".repeat(11))).toThrow(/AUTH_PASSWORD_POLICY_VIOLATION.*at least 12/);
    });

    it("T2.1.03: Password of length 12 characters (exact min boundary) is accepted", () => {
      expect(() => validatePassword("A".repeat(12))).not.toThrow();
    });

    it("T2.1.04: Password of length 1024 bytes (exact max boundary) is accepted", () => {
      expect(() => validatePassword("A".repeat(1024))).not.toThrow();
    });

    it("T2.1.05: Password of length 1025 bytes (1 above max boundary) is rejected", () => {
      expect(() => validatePassword("A".repeat(1025))).toThrow(/AUTH_PASSWORD_POLICY_VIOLATION.*not exceed 1024/);
    });
  });

  // ==========================================
  // Domain 2: Crockford Base32 Character Boundaries
  // ==========================================
  describe("Domain 2: Crockford Base32 ID Character & Format Boundaries", () => {
    it("T2.2.01: Ambiguous Crockford character '0' in Org ID is strictly rejected", () => {
      expect(isValidZolexoraOrgId("ZX-ORG-0B8T-9M2K-7Y4X")).toBe(false);
    });

    it("T2.2.02: Ambiguous Crockford character '1' in Org ID is strictly rejected", () => {
      expect(isValidZolexoraOrgId("ZX-ORG-4B8T-9M2K-7Y1X")).toBe(false);
    });

    it("T2.2.03: Ambiguous Crockford character 'I' in Org ID is strictly rejected", () => {
      expect(isValidZolexoraOrgId("ZX-ORG-4BIT-9M2K-7Y4X")).toBe(false);
    });

    it("T2.2.04: Ambiguous Crockford character 'O' in Org ID is strictly rejected", () => {
      expect(isValidZolexoraOrgId("ZX-ORG-4BOT-9M2K-7Y4X")).toBe(false);
    });

    it("T2.2.05: Extreme valid Crockford alphabet boundaries ('2' lowest, 'Z' highest) are accepted", () => {
      const lowest = "ZX-ORG-2222-2222-2222";
      const highest = "ZX-ORG-ZZZZ-ZZZZ-ZZZZ";
      expect(isValidZolexoraOrgId(lowest)).toBe(true);
      expect(isValidZolexoraOrgId(highest)).toBe(true);
      expect(normalizeZolexoraOrgId(lowest)).toBe(lowest);
      expect(normalizeZolexoraOrgId(highest)).toBe(highest);
    });
  });

  // ==========================================
  // Domain 3: Rate Limiter Window & Attempt Boundaries
  // ==========================================
  describe("Domain 3: Rate Limiter Window & Attempt Count Boundaries", () => {
    it("T2.3.01: Exactly 4 failed attempts allow a 5th attempt without triggering 429", async () => {
      const ip = "192.0.2.1";
      for (let i = 1; i <= 4; i++) {
        const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
          body: JSON.stringify({
            email: "boundary_user@zolexora.com",
            password: "WrongPassword!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
        expect(res.status).toBe(401);
      }

      // 5th attempt: should still return 401, NOT 429
      const fifthAttempt = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({
          email: "boundary_user@zolexora.com",
          password: "WrongPassword!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(fifthAttempt.status).toBe(401);
    });

    it("T2.3.02: 6th attempt immediately triggers HTTP 429 lockout", async () => {
      const ip = "192.0.2.2";
      for (let i = 1; i <= 5; i++) {
        await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
          body: JSON.stringify({
            email: "boundary_user2@zolexora.com",
            password: "WrongPassword!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
      }

      const sixthAttempt = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({
          email: "boundary_user2@zolexora.com",
          password: "WrongPassword!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(sixthAttempt.status).toBe(429);
    });

    it("T2.3.03: Lockout duration in Retry-After header is a positive integer <= 900 seconds", async () => {
      const ip = "192.0.2.3";
      for (let i = 1; i <= 5; i++) {
        await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
          body: JSON.stringify({
            email: "boundary_user3@zolexora.com",
            password: "WrongPassword!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
      }

      const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({
          email: "boundary_user3@zolexora.com",
          password: "WrongPassword!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(res.status).toBe(429);
      const retrySec = Number(res.headers.get("Retry-After"));
      expect(Number.isInteger(retrySec)).toBe(true);
      expect(retrySec).toBeGreaterThan(0);
      expect(retrySec).toBeLessThanOrEqual(900);
    });

    it("T2.3.04: Sub-second burst of 5 failed attempts is tracked without race condition", async () => {
      const ip = "192.0.2.4";
      const requests = Array.from({ length: 5 }, () =>
        fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
          body: JSON.stringify({
            email: "burst_user@zolexora.com",
            password: "WrongPassword!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        })
      );

      const responses = await Promise.all(requests);
      responses.forEach((res) => expect(res.status).toBe(401));

      // 6th attempt after burst
      const next = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({
          email: "burst_user@zolexora.com",
          password: "WrongPassword!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(next.status).toBe(429);
    });

    it("T2.3.05: Rate limiter key isolates IPv6 remote addresses cleanly", async () => {
      const ipv6 = "2001:db8:85a3::8a2e:370:7334";
      for (let i = 1; i <= 5; i++) {
        await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": ipv6 },
          body: JSON.stringify({
            email: "ipv6_user@zolexora.com",
            password: "WrongPassword!",
            turnstile_token: FIXTURES.turnstile.valid,
          }),
        });
      }

      const lockedRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ipv6 },
        body: JSON.stringify({
          email: "ipv6_user@zolexora.com",
          password: "WrongPassword!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(lockedRes.status).toBe(429);
    });
  });

  // ==========================================
  // Domain 4: KYC File Size & MIME Boundaries
  // ==========================================
  describe("Domain 4: KYC File Size (10MB) & MIME Boundaries", () => {
    it("T2.4.01: Exactly 0-byte file upload is handled without server crash", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/pdf",
          "X-File-Size": "0",
        },
        body: JSON.stringify({
          document_type: "aadhaar",
          mime_type: "application/pdf",
          file_size: 0,
        }),
      });
      expect([201, 400]).toContain(res.status);
    });

    it("T2.4.02: Exactly 10,485,760 bytes (10MB exact limit) is accepted", async () => {
      const maxExact = 10 * 1024 * 1024; // 10MB
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth(), "X-Organisation-ID": FIXTURES.ids.validOrg },
        body: JSON.stringify({ document_type: "passport", file: pdfDataUrl(maxExact) }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.file_size).toBe(maxExact);
    });

    it("T2.4.03: Exactly 10,485,761 bytes (10MB + 1 byte) is rejected with HTTP 400", async () => {
      const overLimit = 10 * 1024 * 1024 + 1;
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

    it("T2.4.04: Permitted image/webp format is accepted as valid modern KYC MIME type", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth(), "X-Organisation-ID": FIXTURES.ids.validOrg },
        body: JSON.stringify({ document_type: "driving_license", file: webpDataUrl(51200) }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.mime_type).toBe("image/webp");
    });

    it("T2.4.05: Executable binary MIME application/x-msdownload is strictly rejected with HTTP 415", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": "application/x-msdownload",
          "X-File-Size": "2048",
        },
        body: JSON.stringify({
          document_type: "aadhaar",
          mime_type: "application/x-msdownload",
          file_size: 2048,
        }),
      });
      expect(res.status).toBe(415);
      const data = await res.json();
      expect(data.code).toBe("AUTH_INVALID_MIME_TYPE");
    });
  });

  // ==========================================
  // Domain 5: Signed URL Expiry Boundaries (10 to 15 min)
  // ==========================================
  describe("Domain 5: Signed URL Expiry Window (600s to 900s)", () => {
    let documentId: string;

    beforeEach(async () => {
      const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth(), "X-Organisation-ID": FIXTURES.ids.validOrg },
        body: JSON.stringify({ document_type: "gst", file: pdfDataUrl(1024) }),
      });
      const data = await uploadRes.json();
      documentId = data.document_id;
    });

    it("T2.5.01: Expiry request of 599s (below 10 min) is rejected with 400", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth() },
        body: JSON.stringify({ document_id: documentId, expiry_seconds: 599 }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("AUTH_INVALID_EXPIRY_WINDOW");
    });

    it("T2.5.02: Expiry request of 600s (exact 10 min boundary) is accepted as 600s", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth() },
        body: JSON.stringify({ document_id: documentId, expiry_seconds: 600 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.expires_in_seconds).toBe(600);
    });

    it("T2.5.03: Expiry request of 900s (exact 15 min boundary) is accepted as 900s", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth() },
        body: JSON.stringify({ document_id: documentId, expiry_seconds: 900 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.expires_in_seconds).toBe(900);
    });

    it("T2.5.04: Expiry request of 901s (above 15 min max) is rejected with 400", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth() },
        body: JSON.stringify({ document_id: documentId, expiry_seconds: 901 }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("AUTH_INVALID_EXPIRY_WINDOW");
    });

    it("T2.5.05: Negative expiry seconds is rejected with 400", async () => {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...harness.userAuth() },
        body: JSON.stringify({ document_id: documentId, expiry_seconds: -100 }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("AUTH_INVALID_EXPIRY_WINDOW");
    });
  });
});
