import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 1: Feature 5 — Brute-Force Rate Limiting (5 Attempts in 15 Minutes)", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => harness.resetState());

  it("T1.5.01: First 5 failed login attempts return HTTP 401 and increment failure count", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.10",
        },
        body: JSON.stringify({
          email: "victim@target.com",
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("AUTH_INVALID_CREDENTIALS");
    }
  });

  it("T1.5.02: 6th failed login attempt triggers HTTP 429 Too Many Requests lockout", async () => {
    // 5 failures
    for (let i = 1; i <= 5; i++) {
      await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.20",
        },
        body: JSON.stringify({
          email: "victim2@target.com",
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
    }

    // 6th attempt
    const lockedRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.20",
      },
      body: JSON.stringify({
        email: "victim2@target.com",
        password: "WrongPassword123!",
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(lockedRes.status).toBe(429);
    const data = await lockedRes.json();
    expect(data.code).toBe("AUTH_RATE_LIMITED");
  });

  it("T1.5.03: HTTP 429 response includes Retry-After header with seconds remaining", async () => {
    for (let i = 1; i <= 5; i++) {
      await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.30",
        },
        body: JSON.stringify({
          email: "victim3@target.com",
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
    }

    const lockedRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.30",
      },
      body: JSON.stringify({
        email: "victim3@target.com",
        password: "WrongPassword123!",
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(lockedRes.status).toBe(429);
    const retryHeader = lockedRes.headers.get("Retry-After");
    expect(retryHeader).toBeDefined();
    expect(Number(retryHeader)).toBeGreaterThan(0);
    expect(Number(retryHeader)).toBeLessThanOrEqual(900);
  });

  it("T1.5.04: Rate limiting key isolates distinct IP addresses on the same account", async () => {
    const targetEmail = FIXTURES.emails.publicUser;
    const ipA = "198.51.100.41";
    const ipB = "198.51.100.42";

    // 5 failures from IP A
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ipA,
        },
        body: JSON.stringify({
          email: targetEmail,
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(res.status).toBe(401);
    }

    // IP A 6th attempt is locked
    const lockedA = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ipA,
      },
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
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ipB,
      },
      body: JSON.stringify({
        email: targetEmail,
        password: "DifferentWrongPassword!",
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(wrongB.status).toBe(401);

    // IP B targeting SAME account with valid credentials succeeds immediately
    const validB = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ipB,
      },
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

  it("T1.5.05: Successful login resets failed attempt counter for the account", async () => {
    const ip = "198.51.100.50";

    // 2 failed attempts
    for (let i = 1; i <= 2; i++) {
      await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
    }

    // Successful attempt
    const successRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(successRes.status).toBe(200);

    // Next 4 failed attempts still do not lock (counter was reset)
    for (let i = 1; i <= 4; i++) {
      const nextFail = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({
          email: FIXTURES.emails.publicUser,
          password: "WrongPassword123!",
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(nextFail.status).toBe(401);
    }
  });
});
