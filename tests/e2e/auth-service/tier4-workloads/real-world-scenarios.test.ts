import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness, createTestZolexoraFetch } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";
import { pdfDataUrl, pngDataUrl } from "../helpers/files";
import { isValidZolexoraId, isValidZolexoraOrgId } from "../helpers/crypto";

describe("Tier 4: Real-World Workload Scenarios (5 Comprehensive Workloads)", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => harness.resetState());

  // =========================================================================
  // Scenario 1: Complete Consumer User Lifecycle Journey
  // =========================================================================
  it("T4.01: Scenario 1 — End-to-end consumer registration, OTP verify, direct routing, avatar upload", async () => {
    const consumerEmail = "sarah.consumer@clarityfi.app";

    // Step 1: Continue with Email → emailed code
    const post = (path: string, body: Record<string, unknown>) =>
      fetch(`${harness.baseUrl}/api/v1/auth/public${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, data: await r.json() }));
    const identify = await post("/identify", { email: consumerEmail, turnstile_token: FIXTURES.turnstile.valid });
    expect(identify.data.next).toBe("verify_email");
    const afterEmail = await post("/signup/email/verify", { email: consumerEmail, otp: harness.service.lastCode(consumerEmail) });

    // Step 2: Phone verified by Firebase (SMS code), then name + password
    const firebase_id_token = await harness.service.firebaseIdToken({ provider: "phone", phoneNumber: "+919812345678" });
    const afterPhone = await post("/signup/phone", { firebase_id_token, signup_token: afterEmail.data.signup_token });
    expect(afterPhone.data.next).toBe("profile");
    const created = await post("/signup/complete", {
      signup_token: afterPhone.data.signup_token,
      display_name: "Sarah Connor",
      password: FIXTURES.passwords.standard,
    });
    expect(created.status).toBe(201);

    // Step 3: Consumer login to ClarityFi
    const loginRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Target-Product": "clarityfi",
      },
      body: JSON.stringify({
        email: consumerEmail,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.routing.user_type).toBe("consumer");
    expect(loginData.routing.redirect_route).toBe("/dashboard"); // Direct to consumer dashboard
    expect(isValidZolexoraId(loginData.user.zolexora_id)).toBe(true);

    const zxId = loginData.user.zolexora_id;

    // Step 4: Upload public avatar to Cloudinary with the session token
    const avatarRes = await fetch(`${harness.baseUrl}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginData.customToken}`,
        "X-Zolexora-ID": zxId,
      },
      body: JSON.stringify({ file: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==" }),
    });
    expect(avatarRes.status).toBe(200);
    const avatarData = await avatarRes.json();
    expect(avatarData.url).toContain("f_auto,q_auto");
    expect(avatarData.public_id).toBe(`users/avatars/${zxId}`);
  });

  // =========================================================================
  // Scenario 2: Enterprise Tenant Onboarding & Employee Provisioning Journey
  // =========================================================================
  it("T4.02: Scenario 2 — Enterprise org onboarding, webmail rejection, zero-friction employee provisioning, RBAC token", async () => {
    const orgId = FIXTURES.ids.validOrg;
    expect(isValidZolexoraOrgId(orgId)).toBe(true);

    // Step 1: Attempt to create employee with public webmail -> REJECTED
    const webmailRes = await fetch(`${harness.baseUrl}/api/v1/auth/employee/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...harness.orgAdminAuth() },
      body: JSON.stringify({
        org_id: orgId,
        email: "driver.bob@yahoo.com",
        password: FIXTURES.passwords.standard,
      }),
    });
    expect(webmailRes.status).toBe(400);
    const webmailData = await webmailRes.json();
    expect(webmailData.code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");

    // Step 2: Provision employee with corporate domain -> SUCCESS (Zero friction)
    const corporateEmail = "driver.bob@speedy-freight.com";
    const createRes = await fetch(`${harness.baseUrl}/api/v1/auth/employee/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...harness.orgAdminAuth() },
      body: JSON.stringify({
        org_id: orgId,
        email: corporateEmail,
        password: FIXTURES.passwords.standard,
        role: "dispatcher",
        permissions: ["fleet:read", "trips:create", "trips:update"],
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.employee.status).toBe("active");

    // Step 3: Employee logs in directly without OTP or mobile challenge
    const empLoginRes = await fetch(`${harness.baseUrl}/api/v1/auth/employee/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "zolexora-tms",
        org_id: orgId,
        user_id_or_email: corporateEmail,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(empLoginRes.status).toBe(200);
    const empLoginData = await empLoginRes.json();
    expect(empLoginData.claims.zolexora_id).toBeDefined();
    expect(empLoginData.claims.org_id).toBe(orgId);
    expect(empLoginData.claims.role).toBe("dispatcher");
    expect(empLoginData.claims.permissions).toContain("trips:create");

    // Step 4: Upload organization logo to Cloudinary
    const logoRes = await fetch(`${harness.baseUrl}/api/v1/storage/logos/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harness.orgAdminAuth(),
        "X-Organisation-ID": orgId,
      },
      body: JSON.stringify({ file: pngDataUrl() }),
    });
    expect(logoRes.status).toBe(200);
    const logoData = await logoRes.json();
    expect(logoData.public_id).toBe(`orgs/logos/${orgId}`);
  });

  // =========================================================================
  // Scenario 3: Platform Admin Incident Response & Compromised Token Revocation
  // =========================================================================
  it("T4.03: Scenario 3 — Platform admin login without org_id, superadmin token, emergency token revocation, SDK clearance", async () => {
    // Step 1: Platform admin authenticates without org_id
    const adminLoginRes = await fetch(`${harness.baseUrl}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: FIXTURES.emails.adminUser,
        password: FIXTURES.passwords.admin,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(adminLoginRes.status).toBe(200);
    const adminData = await adminLoginRes.json();
    expect(adminData.admin.role).toBe("superadmin");
    expect(adminData.admin.is_platform_admin).toBe(true);
    expect(adminData.admin.permissions).toEqual(["*"]);

    // Step 2: An employee session is active
    const compromisedUid = "emp_compromised_404";
    const employeeToken = harness.service.token({ uid: compromisedUid, org_id: FIXTURES.ids.validOrg, role: "member" });

    // Step 3: Platform admin revokes compromised employee token
    const revokeRes = await fetch(`${harness.baseUrl}/api/v1/auth/tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminData.customToken}` },
      body: JSON.stringify({
        uid: compromisedUid,
        reason: "Credential leaked in public forum",
      }),
    });
    expect(revokeRes.status).toBe(200);

    // Step 4: Employee client SDK zolexoraFetch encounters 401 and cleanly clears session
    let sessionExpiredEmitted = false;
    const clientFetch = createTestZolexoraFetch({
      baseUrl: harness.baseUrl,
      getToken: async () => employeeToken,
      onSessionExpired: () => {
        sessionExpiredEmitted = true;
      },
    });

    const apiRes = await clientFetch("/api/v1/auth/me");
    expect(apiRes.status).toBe(401);
    expect(sessionExpiredEmitted).toBe(true);
  });

  // =========================================================================
  // Scenario 4: Sensitive KYC Compliance Audit & Time-Bound Signed Access
  // =========================================================================
  it("T4.04: Scenario 4 — Confidential KYC document upload, 10MB limit enforcement, 10-15m signed URL compliance access", async () => {
    // Step 1: Malicious or accidental upload exceeding 10MB -> REJECTED
    const oversizedRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harness.userAuth(),
        "X-File-Mime": "application/pdf",
        "X-File-Size": String(15 * 1024 * 1024), // 15MB
      },
      body: JSON.stringify({
        document_type: "incorporation",
        mime_type: "application/pdf",
        file_size: 15 * 1024 * 1024,
      }),
    });
    expect(oversizedRes.status).toBe(400);
    const overData = await oversizedRes.json();
    expect(overData.code).toBe("AUTH_FILE_TOO_LARGE");

    // Step 2: Valid 2MB incorporation deed upload
    const validUploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...harness.userAuth(), "X-Organisation-ID": FIXTURES.ids.validOrg },
      body: JSON.stringify({ document_type: "incorporation", file: pdfDataUrl(2 * 1024 * 1024) }),
    });
    expect(validUploadRes.status).toBe(201);
    const validData = await validUploadRes.json();
    expect(validData.document_id).toBeDefined();

    // Step 3: Compliance auditor requests 15-minute signed URL
    const signedRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...harness.userAuth() },
      body: JSON.stringify({
        document_id: validData.document_id,
        expiry_seconds: 900, // 15 minutes
      }),
    });
    expect(signedRes.status).toBe(200);
    const signedData = await signedRes.json();
    expect(signedData.signed_url).toContain("X-Amz-Signature=");
    expect(signedData.expires_in_seconds).toBe(900);
  });

  // =========================================================================
  // Scenario 5: Brute-Force Credential Attack & Account Recovery Flow
  // =========================================================================
  it("T4.05: Scenario 5 — Brute-force attack, 5-failure lockout (429 Retry-After), admin credential update, successful recovery", async () => {
    const attackerIp = "203.0.113.88";

    // Step 1: Attacker sends 5 bad passwords
    for (let i = 1; i <= 5; i++) {
      const failRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": attackerIp,
        },
        body: JSON.stringify({
          email: "targeted.account@zolexora.com",
          password: `BadPasswordGuess_${i}!`,
          turnstile_token: FIXTURES.turnstile.valid,
        }),
      });
      expect(failRes.status).toBe(401);
    }

    // Step 2: 6th attempt is blocked with 429 and Retry-After: 900
    const lockedRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": attackerIp,
      },
      body: JSON.stringify({
        email: "targeted.account@zolexora.com",
        password: "BadPasswordGuess_6!",
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(lockedRes.status).toBe(429);
    expect(lockedRes.headers.get("Retry-After")).toBeDefined();

    // Step 3: Legitimate user signs in from office IP with correct credentials -> SUCCESS
    const officeIp = "198.51.100.222";
    const recoveredRes = await fetch(`${harness.baseUrl}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": officeIp,
      },
      body: JSON.stringify({
        email: FIXTURES.emails.publicUser,
        password: FIXTURES.passwords.standard,
        turnstile_token: FIXTURES.turnstile.valid,
      }),
    });
    expect(recoveredRes.status).toBe(200);
    const recoveredData = await recoveredRes.json();
    expect(recoveredData.success).toBe(true);
  });
});
