import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness, createTestZolexoraFetch } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 3: Cross-Feature Pairwise Security Combinations (8 Tests)", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => {
    harness.resetState();
  });

  it("T3.01: Turnstile failure preempts rate limiter tracking on the targeted account", async () => {
    const ip = "198.51.100.91";
    const targetEmail = "unaffected_target@zolexora.com";

    // 5 attempts failing Turnstile (missing turnstile token)
    for (let i = 1; i <= 5; i++) {
      const turnstileFail = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({ email: targetEmail, password: "AnyPassword123!" }),
      });
      expect(turnstileFail.status).toBe(400); // AUTH_TURNSTILE_REQUIRED
    }

    // Now send a valid request with valid Turnstile token: should NOT be blocked by 429
    const validTurnstile = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(validTurnstile.status).toBe(200);
  });

  it("T3.02: Active Rate Limiter lockout preempts credential lookup and crypto computation", async () => {
    const ip = "198.51.100.92";

    // Trigger 5 consecutive credential failures to lock
    for (let i = 1; i <= 5; i++) {
      await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({
          email: "rate_locked@zolexora.com",
          password: "WrongPassword!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
    }

    // 6th attempt: even with valid credentials, server immediately returns 429
    const start = performance.now();
    const lockedRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard, // Correct password
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    const elapsed = performance.now() - start;

    expect(lockedRes.status).toBe(429);
    expect(elapsed).toBeLessThan(100); // Fast rejection without running Scrypt/Argon2id
  });

  it("T3.03: Custom Token issued with RBAC claims is instantly invalidated by token revocation", async () => {
    // 1. Employee signs in and receives custom token
    const loginRes = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "zolexora-tms",
        org_id: FIXTURES.ids.validOrg,
        user_id_or_email: "dispatcher@zolexora.com",
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    const employeeUid = loginData.user.uid;
    const token = loginData.customToken;

    // 2. Token is authorized on /api/v1/auth/me
    const verifyBefore = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(verifyBefore.status).toBe(200);

    // 3. Organization admin revokes employee session
    const revokeRes = await fetch(`${harness.baseUrl}/api/v1/auth/tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: employeeUid, reason: "Security incident" }),
    });
    expect(revokeRes.status).toBe(200);

    // 4. Same token is rejected immediately on subsequent API calls
    const verifyAfter = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(verifyAfter.status).toBe(401);
  });

  it("T3.04: Valid Turnstile token does not bypass Webmail Domain Blocking", async () => {
    // Attempting to provision employee with @gmail.com but providing a valid Turnstile token
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: FIXTURES.ids.validOrg,
        email: "sneaky.employee@gmail.com",
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid, // Valid Turnstile
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
  });

  it("T3.05: Lowercase Org ID input normalizes and propagates through Custom Token claims", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "zolexora-tms",
        org_id: FIXTURES.ids.validOrgLowercase, // lowercase
        user_id_or_email: "dispatcher@zolexora.com",
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    // Uppercase normalization in claims
    expect(data.claims.org_id).toBe(FIXTURES.ids.validOrg);
    expect(data.org.zolexora_org_id).toBe(FIXTURES.ids.validOrg);
  });

  it("T3.06: zolexoraFetch 401 refresh fails cleanly when session is globally revoked", async () => {
    const revokedUid = "user_revoked_999";
    const revokedToken = `token_belonging_to_${revokedUid}`;

    // 1. Mark uid as revoked in the service
    const revokeRes = await fetch(`${harness.baseUrl}/api/v1/auth/tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: revokedUid, reason: "Account terminated" }),
    });
    expect(revokeRes.status).toBe(200);

    let sessionExpiredHandled = false;

    const customFetch = createTestZolexoraFetch({
      baseUrl: harness.baseUrl,
      getToken: async (forceRefresh) => {
        // Even after force-refresh attempt, user is revoked
        return revokedToken;
      },
      onSessionExpired: () => {
        sessionExpiredHandled = true;
      },
    });

    // Make request: backend returns 401, SDK attempts refresh, receives 401 again, triggers sessionExpired
    const res = await customFetch("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(sessionExpiredHandled).toBe(true);
  });

  it("T3.07: Platform Admin and Employee credentials cannot cross-authenticate across tracks", async () => {
    // 1. Attempting to use Platform Admin credentials on Org Employee endpoint
    const cross1 = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
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
    expect(cross1.status).toBe(401);

    // 2. Attempting to use Employee credentials on Platform Admin endpoint
    const cross2 = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: "dispatcher@zolexora.com",
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(cross2.status).toBe(401);
  });

  it("T3.08: Private KYC signed URL access is denied for unknown or tampered document IDs", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: "kyc_non_existent_fake_id",
        expiry_seconds: 600,
      }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("AUTH_DOCUMENT_NOT_FOUND");
  });
});
