import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 1: Feature 3 — Track 3 Platform Admin Authentication", () => {
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

  it("T1.3.01: Platform admin authenticates without requiring an org_id", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: FIXTURES.emails.adminUser,
        password: FIXTURES.passwords.admin,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.admin.email).toBe(FIXTURES.emails.adminUser);
    expect(data.admin.is_platform_admin).toBe(true);
  });

  it("T1.3.02: Public self-registration is strictly forbidden for Platform Admin tier", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/admin/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "hacker@evil.com",
        password: "MasterSuperadminSecret2026!",
        role: "superadmin",
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("AUTH_ADMIN_SIGNUP_FORBIDDEN");
  });

  it("T1.3.03: Platform Admin session issues superadmin claims with universal permissions", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: FIXTURES.emails.adminUser,
        password: FIXTURES.passwords.admin,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.admin.role).toBe("superadmin");
    expect(data.admin.permissions).toEqual(["*"]);
    expect(data.customToken).toBeDefined();
  });

  it("T1.3.04: Admin login ignores or rejects extraneous org_id parameters", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: FIXTURES.emails.adminUser,
        password: FIXTURES.passwords.admin,
        org_id: FIXTURES.ids.validOrg, // Extraneous parameter
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.admin.is_platform_admin).toBe(true);
  });

  it("T1.3.05: Invalid admin credentials return HTTP 401 without revealing user existence", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: FIXTURES.emails.adminUser,
        password: "IncorrectAdminPassword123!",
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("AUTH_INVALID_ADMIN_CREDENTIALS");
  });
});
