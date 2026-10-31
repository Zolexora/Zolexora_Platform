import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";
import { isValidZolexoraId, normalizeZolexoraId } from "../helpers/crypto";

describe("Tier 1: Feature 1 — Track 1 Global Identity & Public Registration", () => {
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

  it("T1.1.01: Dual-verification public registration requires email and phone number", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        phoneNumber: "+919876543210",
        password: FIXTURES.passwords.standard,
        displayName: "Public Consumer",
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe("contact_verification");
    expect(data.attempt_id).toBeDefined();
  });

  it("T1.1.02: Email OTP verification successfully verifies registered user", async () => {
    // Initiate signup first
    await fetch(`${harness.baseUrl}/api/v1/auth/public/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        phoneNumber: "+919876543210",
        password: FIXTURES.passwords.standard,
        displayName: "Public Consumer",
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    const verifyRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/verify-email-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        otp: "123456",
      }),
    });

    expect(verifyRes.status).toBe(200);
    const data = await verifyRes.json();
    expect(data.success).toBe(true);
    expect(data.email_verified).toBe(true);
  });

  it("T1.1.03: Consumer product login routes directly to personal dashboard", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Target-Product": "clarityfi",
      },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.routing.user_type).toBe("consumer");
    expect(data.routing.redirect_route).toBe("/dashboard");
    expect(data.customToken).toBeDefined();
  });

  it("T1.1.04: Enterprise SaaS login routes to organization selection or onboarding", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Target-Product": "zolexora-tms",
      },
      body: JSON.stringify({
        email: FIXTURES.emails.enterpriseUser,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.routing.user_type).toBe("enterprise");
    expect(data.routing.redirect_route).toBe("/select-organization");
  });

  it("T1.1.05: User profile contains valid canonical Zolexora ID format ZX-XXXX-XXXX-XXXX", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.zolexora_id).toBeDefined();
    expect(isValidZolexoraId(data.user.zolexora_id)).toBe(true);
    expect(normalizeZolexoraId(data.user.zolexora_id)).toBe(data.user.zolexora_id);
  });
});
