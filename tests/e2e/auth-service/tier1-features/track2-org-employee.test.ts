import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";
import { isValidZolexoraOrgId, normalizeZolexoraOrgId } from "../helpers/crypto";

describe("Tier 1: Feature 2 — Track 2 Org-Scoped Employee Login & Claims", () => {
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

  it("T1.2.01: Org employee login accepts canonical Org ID format ZX-ORG-XXXX-XXXX-XXXX", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
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

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.org.zolexora_org_id).toBe(FIXTURES.ids.validOrg);
    expect(isValidZolexoraOrgId(data.org.zolexora_org_id)).toBe(true);
  });

  it("T1.2.02: Lowercase valid org_id is automatically normalized to uppercase", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "zolexora-tms",
        org_id: FIXTURES.ids.validOrgLowercase,
        user_id_or_email: "dispatcher@zolexora.com",
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.org.zolexora_org_id).toBe(FIXTURES.ids.validOrg);
  });

  it("T1.2.03: Org employee provisioning strictly rejects public webmail domains", async () => {
    for (const webmail of FIXTURES.emails.webmailList) {
      const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: FIXTURES.ids.validOrg,
          email: webmail,
          password: FIXTURES.passwords.standard,
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
    }
  });

  it("T1.2.04: Provisioned corporate employee logs in immediately with zero verification friction", async () => {
    // 1. Admin creates employee with corporate domain
    const createRes = await fetch(`${harness.baseUrl}/api/v1/auth/employee/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: FIXTURES.ids.validOrg,
        email: "fleet.driver01@acme-transport.com",
        password: FIXTURES.passwords.standard,
        role: "member",
        permissions: ["trips:read", "trips:update"],
      }),
    });
    expect(createRes.status).toBe(201);

    // 2. Employee immediately logs in without mobile/email verification challenges
    const loginRes = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "zolexora-tms",
        org_id: FIXTURES.ids.validOrg,
        user_id_or_email: "fleet.driver01@acme-transport.com",
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.user.email).toBe("fleet.driver01@acme-transport.com");
    expect(loginData.user.status).toBe("active");
  });

  it("T1.2.05: Employee login mints Firebase Custom Token containing full RBAC claims", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
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

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customToken).toBeDefined();
    expect(data.claims).toBeDefined();
    expect(data.claims.zolexora_id).toBe("ZX-7K2M-9P4W-1Y8X");
    expect(data.claims.org_id).toBe(FIXTURES.ids.validOrg);
    expect(data.claims.role).toBe("manager");
    expect(data.claims.product).toBe("zolexora-tms");
    expect(Array.isArray(data.claims.permissions)).toBe(true);
  });
});
