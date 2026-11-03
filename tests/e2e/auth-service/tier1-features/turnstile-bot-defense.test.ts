import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 1: Feature 4 — Cloudflare Turnstile Bot Defense", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => harness.resetState());

  it("T1.4.01: Request with valid Turnstile token is accepted", async () => {
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
    expect(data.success).toBe(true);
  });

  it("T1.4.02: Request with missing Turnstile token returns HTTP 400 AUTH_TURNSTILE_REQUIRED", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard,
        // turnstile_token omitted
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("AUTH_TURNSTILE_REQUIRED");
  });

  it("T1.4.03: Request with invalid Turnstile token returns HTTP 403 AUTH_TURNSTILE_FAILED", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.invalid,
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("AUTH_TURNSTILE_FAILED");
  });

  it("T1.4.04: Replayed or expired Turnstile token returns timeout-or-duplicate rejection", async () => {
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

  it("T1.4.05: Turnstile token provided via CF-Turnstile-Token header is accepted", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
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

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
