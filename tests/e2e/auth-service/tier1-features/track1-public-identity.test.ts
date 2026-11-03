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

  beforeEach(() => harness.resetState());

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  };

  it("T1.1.01: Continue with Email (new) → emailed code → Firebase SMS phone → name + password → session", async () => {
    const email = "new.consumer@example.com";
    const start = await post("/identify", { email, turnstile_token: FIXTURES.turnstile.valid });
    expect(start).toMatchObject({ status: 200, data: { exists: false, next: "verify_email" } });

    const code = harness.service.lastCode(email);
    expect(code).toMatch(/^\d{6}$/);
    const afterEmail = await post("/signup/email/verify", { email, otp: code });
    expect(afterEmail.data.next).toBe("verify_phone");

    const firebase_id_token = await harness.service.firebaseIdToken({ provider: "phone", phoneNumber: "+919811112222" });
    const afterPhone = await post("/signup/phone", { firebase_id_token, signup_token: afterEmail.data.signup_token });
    expect(afterPhone.data).toMatchObject({ next: "profile", phone_number: "+919811112222" });

    const done = await post("/signup/complete", {
      signup_token: afterPhone.data.signup_token,
      display_name: "Public Consumer",
      password: FIXTURES.passwords.standard,
    });
    expect(done.status).toBe(201);
    expect(isValidZolexoraId(done.data.user.zolexora_id)).toBe(true);

    const me = await fetch(`${harness.baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${done.data.customToken}` } });
    expect(me.status).toBe(200);
  });

  it("T1.1.02: Continue with Google signs an existing account in without a password; Phone (existing) asks for it", async () => {
    const id_token = await harness.service.firebaseIdToken({ provider: "google.com", email: FIXTURES.emails.publicUser });
    const google = await post("/google", { id_token, turnstile_token: FIXTURES.turnstile.valid });
    expect(google.status).toBe(200);
    expect(google.data).toMatchObject({ next: "done", user: { email: FIXTURES.emails.publicUser } });
    expect(google.data.customToken).toBeDefined();

    const phone = await post("/identify", { phone_number: "+919876543210", turnstile_token: FIXTURES.turnstile.valid });
    expect(phone.data).toMatchObject({ exists: true, next: "password" });
    const login = await post("/login", { phone_number: "+919876543210", password: FIXTURES.passwords.standard, turnstile_token: FIXTURES.turnstile.valid });
    expect(login.status).toBe(200);
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
