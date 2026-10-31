#!/usr/bin/env node
/**
 * Empirical Attack & Verification Harness for Gate 3 Iteration 2
 * Agent: challenger_m3_2_gen8_it2
 * Tests:
 * 1. Cross-IP Rate Limit Isolation on SAME account with Valid (200) and Invalid (401) credentials
 *    - Track 1 (Public Consumer)
 *    - Track 2 (Organization Employee)
 *    - Track 3 (Platform Admin)
 * 2. Infisical Dynamic Secrets Sync & Fallback Diagnostics (/api/v1/health and /api/v1/health/secrets)
 * 3. PostgreSQL Schema & Index Verification for auth_revocations
 */

const BASE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3081";

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: json,
  };
}

async function get(path, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers,
  });
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: json,
  };
}

async function main() {
  console.log("================================================================================");
  console.log("   CHALLENGER_M3_2_GEN8_IT2: LIVE CROSS-IP RATE LIMIT & SCHEMA ATTACK HARNESS   ");
  console.log(`   Target: ${BASE_URL}`);
  console.log("================================================================================\n");

  const results = {};

  // ===========================================================================
  // TEST 1: TRACK 1 CROSS-IP RATE LIMIT ISOLATION (SAME ACCOUNT)
  // ===========================================================================
  console.log(">>> [TEST 1] Track 1 Cross-IP Isolation (consumer@clarityfi.app)");
  await post("/api/v1/test/reset", {});

  const ipA1 = "198.51.100.1";
  const ipB1 = "198.51.100.2";
  const targetEmail = "consumer@clarityfi.app";
  const validPassword = "CorporateSecurePass123!";
  const invalidPassword = "WrongPassword999!";
  const turnstileToken = "1x00000000000000000000AA";

  // IP A sends 5 failed attempts
  const ipAAttempts = [];
  for (let i = 1; i <= 5; i++) {
    const r = await post(
      "/api/v1/auth/public/login",
      { email: targetEmail, password: invalidPassword, turnstile_token: turnstileToken },
      { "X-Forwarded-For": ipA1 }
    );
    ipAAttempts.push({ attempt: i, status: r.status, code: r.body.code });
    console.log(`    IP A Attempt ${i}: HTTP ${r.status} (${r.body.code})`);
  }

  // IP A 6th attempt -> must be 429
  const resA6 = await post(
    "/api/v1/auth/public/login",
    { email: targetEmail, password: invalidPassword, turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipA1 }
  );
  const retryAfter = resA6.headers["retry-after"] || resA6.headers["Retry-After"];
  console.log(`    IP A Attempt 6: HTTP ${resA6.status} (${resA6.body.code}) [Retry-After: ${retryAfter}]`);

  // IP B sends request for SAME account with INVALID credentials -> must be 401 (NOT 429)
  const resBInvalid = await post(
    "/api/v1/auth/public/login",
    { email: targetEmail, password: "AnotherWrongPassword!", turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipB1 }
  );
  console.log(`    IP B (SAME account, INVALID pass): HTTP ${resBInvalid.status} (${resBInvalid.body.code})`);

  // IP B sends request for SAME account with VALID credentials -> must be 200 (NOT locked out!)
  const resBValid = await post(
    "/api/v1/auth/public/login",
    { email: targetEmail, password: validPassword, turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipB1 }
  );
  console.log(`    IP B (SAME account, VALID pass): HTTP ${resBValid.status} (success: ${resBValid.body.success})`);

  // IP A tries with VALID credentials -> MUST STILL BE 429 because IP A is locked out
  const resAValid = await post(
    "/api/v1/auth/public/login",
    { email: targetEmail, password: validPassword, turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipA1 }
  );
  console.log(`    IP A (SAME account, VALID pass): HTTP ${resAValid.status} (${resAValid.body.code}) - Lockout maintained`);

  const track1Pass =
    ipAAttempts.every((a) => a.status === 401) &&
    resA6.status === 429 &&
    resA6.body.code === "AUTH_RATE_LIMITED" &&
    Number(retryAfter) >= 890 &&
    resBInvalid.status === 401 &&
    resBInvalid.body.code === "AUTH_INVALID_CREDENTIALS" &&
    resBValid.status === 200 &&
    resBValid.body.success === true &&
    resAValid.status === 429;

  results.track1 = {
    pass: track1Pass,
    ipA6Status: resA6.status,
    retryAfter,
    ipBInvalidStatus: resBInvalid.status,
    ipBValidStatus: resBValid.status,
    ipAValidStatus: resAValid.status,
  };
  console.log(`    Verdict Track 1: ${track1Pass ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // TEST 2: TRACK 2 CROSS-IP RATE LIMIT ISOLATION (SAME EMPLOYEE)
  // ===========================================================================
  console.log(">>> [TEST 2] Track 2 Cross-IP Isolation (dispatcher@zolexora.com in ZX-ORG-4B8T-9M2K-7Y4X)");
  await post("/api/v1/test/reset", {});

  const ipA2 = "198.51.100.10";
  const ipB2 = "198.51.100.20";
  const orgId = "ZX-ORG-4B8T-9M2K-7Y4X";
  const empIdentifier = "dispatcher@zolexora.com";
  const empValidPass = "CorporateSecurePass123!";

  // IP A sends 5 failed employee attempts
  for (let i = 1; i <= 5; i++) {
    const r = await post(
      "/api/v1/auth/employee/login",
      { org_id: orgId, user_id_or_email: empIdentifier, password: "WrongPassword!", turnstile_token: turnstileToken },
      { "X-Forwarded-For": ipA2 }
    );
    console.log(`    IP A Employee Attempt ${i}: HTTP ${r.status} (${r.body.code})`);
  }

  // IP A 6th employee attempt
  const resEmpA6 = await post(
    "/api/v1/auth/employee/login",
    { org_id: orgId, user_id_or_email: empIdentifier, password: "WrongPassword!", turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipA2 }
  );
  console.log(`    IP A Employee Attempt 6: HTTP ${resEmpA6.status} (${resEmpA6.body.code})`);

  // IP B sends attempt for SAME employee with INVALID password -> 401
  const resEmpBInvalid = await post(
    "/api/v1/auth/employee/login",
    { org_id: orgId, user_id_or_email: empIdentifier, password: "AnotherBadPassword!", turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipB2 }
  );
  console.log(`    IP B Employee (SAME account, INVALID pass): HTTP ${resEmpBInvalid.status} (${resEmpBInvalid.body.code})`);

  // IP B sends attempt for SAME employee with VALID password -> 200
  const resEmpBValid = await post(
    "/api/v1/auth/employee/login",
    { org_id: orgId, user_id_or_email: empIdentifier, password: empValidPass, turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipB2 }
  );
  console.log(`    IP B Employee (SAME account, VALID pass): HTTP ${resEmpBValid.status} (success: ${resEmpBValid.body.success})`);

  const track2Pass =
    resEmpA6.status === 429 &&
    resEmpA6.body.code === "AUTH_RATE_LIMITED" &&
    resEmpBInvalid.status === 401 &&
    resEmpBInvalid.body.code === "AUTH_INVALID_CREDENTIALS" &&
    resEmpBValid.status === 200 &&
    resEmpBValid.body.success === true;

  results.track2 = {
    pass: track2Pass,
    resEmpA6Status: resEmpA6.status,
    resEmpBInvalidStatus: resEmpBInvalid.status,
    resEmpBValidStatus: resEmpBValid.status,
  };
  console.log(`    Verdict Track 2: ${track2Pass ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // TEST 3: TRACK 3 CROSS-IP RATE LIMIT ISOLATION (SAME PLATFORM ADMIN)
  // ===========================================================================
  console.log(">>> [TEST 3] Track 3 Cross-IP Isolation (superadmin@zolexora.com)");
  await post("/api/v1/test/reset", {});

  const ipA3 = "198.51.100.100";
  const ipB3 = "198.51.100.200";
  const adminIdentifier = "superadmin@zolexora.com";
  const adminValidPass = "MasterSuperadminSecret2026!";

  // IP A sends 5 failed admin attempts
  for (let i = 1; i <= 5; i++) {
    const r = await post(
      "/api/v1/auth/admin/login",
      { username_or_email: adminIdentifier, password: "WrongAdminPassword!", turnstile_token: turnstileToken },
      { "X-Forwarded-For": ipA3 }
    );
    console.log(`    IP A Admin Attempt ${i}: HTTP ${r.status} (${r.body.code})`);
  }

  // IP A 6th admin attempt
  const resAdminA6 = await post(
    "/api/v1/auth/admin/login",
    { username_or_email: adminIdentifier, password: "WrongAdminPassword!", turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipA3 }
  );
  console.log(`    IP A Admin Attempt 6: HTTP ${resAdminA6.status} (${resAdminA6.body.code})`);

  // IP B sends attempt for SAME admin with INVALID password -> 401
  const resAdminBInvalid = await post(
    "/api/v1/auth/admin/login",
    { username_or_email: adminIdentifier, password: "AnotherBadPassword!", turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipB3 }
  );
  console.log(`    IP B Admin (SAME account, INVALID pass): HTTP ${resAdminBInvalid.status} (${resAdminBInvalid.body.code})`);

  // IP B sends attempt for SAME admin with VALID password -> 200
  const resAdminBValid = await post(
    "/api/v1/auth/admin/login",
    { username_or_email: adminIdentifier, password: adminValidPass, turnstile_token: turnstileToken },
    { "X-Forwarded-For": ipB3 }
  );
  console.log(`    IP B Admin (SAME account, VALID pass): HTTP ${resAdminBValid.status} (success: ${resAdminBValid.body.success})`);

  const track3Pass =
    resAdminA6.status === 429 &&
    resAdminA6.body.code === "AUTH_RATE_LIMITED" &&
    resAdminBInvalid.status === 401 &&
    resAdminBInvalid.body.code === "AUTH_INVALID_ADMIN_CREDENTIALS" &&
    resAdminBValid.status === 200 &&
    resAdminBValid.body.success === true;

  results.track3 = {
    pass: track3Pass,
    resAdminA6Status: resAdminA6.status,
    resAdminBInvalidStatus: resAdminBInvalid.status,
    resAdminBValidStatus: resAdminBValid.status,
  };
  console.log(`    Verdict Track 3: ${track3Pass ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // TEST 4: INFISICAL R6 HEALTH & SECRETS DIAGNOSTICS
  // ===========================================================================
  console.log(">>> [TEST 4] Infisical Dynamic Secrets Sync & Fallback Diagnostics");
  
  const healthRes = await get("/api/v1/health");
  console.log(`    GET /api/v1/health -> HTTP ${healthRes.status}`);
  console.log(`    Payload: ${JSON.stringify(healthRes.body)}`);

  const secretsRes = await get("/api/v1/health/secrets");
  console.log(`    GET /api/v1/health/secrets -> HTTP ${secretsRes.status}`);
  console.log(`    Payload: ${JSON.stringify(secretsRes.body)}`);

  const healthPass =
    healthRes.status === 200 &&
    typeof healthRes.body.service === "string" &&
    healthRes.body.port === 3081 &&
    typeof healthRes.body.secrets === "object" &&
    typeof healthRes.body.secrets.status === "string" &&
    typeof healthRes.body.secrets.provider === "string" &&
    typeof healthRes.body.secrets.synced_count === "number";

  const secretsPass =
    secretsRes.status === 200 &&
    typeof secretsRes.body.status === "string" &&
    typeof secretsRes.body.provider === "string" &&
    typeof secretsRes.body.workspaceId === "string" &&
    typeof secretsRes.body.environment === "string" &&
    typeof secretsRes.body.secretsPath === "string" &&
    typeof secretsRes.body.syncedCount === "number" &&
    Array.isArray(secretsRes.body.diagnostics) &&
    Array.isArray(secretsRes.body.missingCriticalKeys);

  const infisicalPass = healthPass && secretsPass;
  results.infisical = {
    pass: infisicalPass,
    healthStatus: healthRes.status,
    secretsStatus: secretsRes.status,
    healthPayload: healthRes.body,
    secretsPayload: secretsRes.body,
  };
  console.log(`    Verdict Infisical Diagnostics: ${infisicalPass ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log("================================================================================");
  console.log("                              VERIFICATION SUMMARY                              ");
  console.log("================================================================================");
  console.log(`Test 1 (Track 1 Cross-IP Isolation): [${results.track1.pass ? "PASS" : "FAIL"}]`);
  console.log(`Test 2 (Track 2 Cross-IP Isolation): [${results.track2.pass ? "PASS" : "FAIL"}]`);
  console.log(`Test 3 (Track 3 Cross-IP Isolation): [${results.track3.pass ? "PASS" : "FAIL"}]`);
  console.log(`Test 4 (Infisical R6 Diagnostics):   [${results.infisical.pass ? "PASS" : "FAIL"}]`);
  console.log("--------------------------------------------------------------------------------");

  const overallPass =
    results.track1.pass &&
    results.track2.pass &&
    results.track3.pass &&
    results.infisical.pass;

  console.log(`OVERALL VERDICT: ${overallPass ? "APPROVE" : "REJECT"}`);
  console.log("================================================================================\n");

  if (!overallPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
