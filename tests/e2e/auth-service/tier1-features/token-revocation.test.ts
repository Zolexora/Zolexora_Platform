import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";

describe("Tier 1: Feature 7 — Immediate Token Revocation & Timestamp Validation", () => {
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

  it("T1.7.01: Revocation endpoint POST /api/v1/auth/tokens/revoke returns HTTP 200 with revoked_at", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: "emp_compromised_01",
        reason: "Employee termination",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.uid).toBe("emp_compromised_01");
    expect(data.revoked_at).toBeDefined();
  });

  it("T1.7.02: Active token issued to unrevoked user is accepted by /api/v1/auth/me", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: "Bearer active_valid_token_uid_101",
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
  });

  it("T1.7.03: Token for revoked user is immediately rejected with HTTP 401 AUTH_TOKEN_REVOKED", async () => {
    const targetUid = "emp_suspended_99";

    // 1. Revoke the user's tokens
    await fetch(`${harness.baseUrl}/api/v1/auth/tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: targetUid }),
    });

    // 2. Immediate request with token from revoked user
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer token_belonging_to_${targetUid}`,
      },
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("AUTH_TOKEN_REVOKED");
  });

  it("T1.7.04: Revocation takes effect in seconds without waiting for JWT TTL expiration", async () => {
    const targetUid = "emp_rapid_revoke_55";
    const token = `bearer_token_${targetUid}`;

    // Token works before revocation
    const beforeRes = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(beforeRes.status).toBe(200);

    // Call revoke
    await fetch(`${harness.baseUrl}/api/v1/auth/tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: targetUid }),
    });

    // Next request rejected immediately
    const afterRes = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterRes.status).toBe(401);
  });

  it("T1.7.05: Request without Authorization header returns HTTP 401 AUTH_UNAUTHORIZED", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/me`, {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("AUTH_UNAUTHORIZED");
  });
});
