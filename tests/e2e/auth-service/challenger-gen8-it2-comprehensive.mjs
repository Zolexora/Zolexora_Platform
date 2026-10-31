import crypto from "node:crypto";

const BASE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3081";
const SECRET = process.env.SESSION_SECRET || "zolexora-platform-auth-secret-key-32bytes-min";

function signJwt(payload, secret = SECRET) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function runEmpiricalEvaluation() {
  console.log("================================================================================");
  console.log("    CHALLENGER_M3_1_GEN8_IT2: DEEP LIVE EMPIRICAL VERIFICATION HARNESS          ");
  console.log(`    Target: ${BASE_URL}`);
  console.log("================================================================================\n");

  const results = {};

  // ---------------------------------------------------------------------------
  // ATTACK 1: RATE LIMITING & CROSS-IP ISOLATION
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 1] Rate Limiting & Cross-IP Defense Verification");
  const ipA = `198.51.100.${Math.floor(Math.random() * 100) + 100}`;
  const ipB = `198.51.100.${Math.floor(Math.random() * 100) + 200}`;
  const victimEmail = `victim_${Date.now()}@zolexora.com`;

  const ipAStatuses = [];
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
      body: JSON.stringify({
        email: victimEmail,
        password: "BadPassword123!",
        turnstile_token: "1x00000000000000000000AA",
      }),
    });
    const body = await res.json();
    ipAStatuses.push({ attempt: i, status: res.status, code: body.code });
  }

  // 6th Attempt from IP A
  const res6A = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
    body: JSON.stringify({
      email: victimEmail,
      password: "BadPassword123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const body6A = await res6A.json();
  const retryAfterHeader = res6A.headers.get("retry-after") || res6A.headers.get("Retry-After");

  console.log(`    IP A (Attacker): 5 failures -> 6th attempt status: HTTP ${res6A.status}, Code: ${body6A.code}, Retry-After: ${retryAfterHeader}`);

  // Test IP B (Legitimate user or different IP targeting the same account with valid credentials)
  const resBValid = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ipB },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const bodyBValid = await resBValid.json();
  console.log(`    IP B (Valid user): Status: HTTP ${resBValid.status}, Success: ${bodyBValid.success}`);

  // Test IP B with invalid password for victimEmail (should return 401, NOT 429)
  const resBInvalid = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ipB },
    body: JSON.stringify({
      email: victimEmail,
      password: "WrongPassword!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const bodyBInvalid = await resBInvalid.json();
  console.log(`    IP B (Targeting locked account from IP A): Status: HTTP ${resBInvalid.status}, Code: ${bodyBInvalid.code} (Must be 401, not 429)`);

  const attack1Pass =
    res6A.status === 429 &&
    body6A.code === "AUTH_RATE_LIMITED" &&
    retryAfterHeader === "900" &&
    resBValid.status === 200 &&
    resBInvalid.status === 401;

  results.attack1 = {
    pass: attack1Pass,
    ipA6thStatus: res6A.status,
    ipA6thCode: body6A.code,
    retryAfter: retryAfterHeader,
    ipBValidStatus: resBValid.status,
    ipBInvalidStatus: resBInvalid.status,
    ipBInvalidCode: bodyBInvalid.code,
  };
  console.log(`    [ATTACK 1 VERDICT]: ${attack1Pass ? "PASS" : "FAIL"}\n`);

  // ---------------------------------------------------------------------------
  // ATTACK 2: TURNSTILE BOT DEFENSE
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 2] Turnstile Bot Defense Probing");

  // 2.1 Missing Token
  const rMissing = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
    }),
  });
  const bMissing = await rMissing.json();
  console.log(`    2.1 Missing Token: HTTP ${rMissing.status}, Code: ${bMissing.code}`);

  // 2.2 Empty Token
  const rEmpty = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "   ",
    }),
  });
  const bEmpty = await rEmpty.json();
  console.log(`    2.2 Empty Token: HTTP ${rEmpty.status}, Code: ${bEmpty.code}`);

  // 2.3 Cloudflare Failure Token (2x00000000000000000000AA)
  const rFail = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "2x00000000000000000000AA",
    }),
  });
  const bFail = await rFail.json();
  console.log(`    2.3 CF Failure Token: HTTP ${rFail.status}, Code: ${bFail.code}`);

  // 2.4 Arbitrary Forged Token
  const rForged = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "arbitrary_forged_bot_token_xxx",
    }),
  });
  const bForged = await rForged.json();
  console.log(`    2.4 Forged Token: HTTP ${rForged.status}, Code: ${bForged.code}`);

  // 2.5 Cloudflare Pass Token (1x00000000000000000000AA)
  const rPass = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const bPass = await rPass.json();
  console.log(`    2.5 CF Pass Token: HTTP ${rPass.status}, Success: ${bPass.success}`);

  const attack2Pass =
    (rMissing.status === 400 || rMissing.status === 403) &&
    (rEmpty.status === 400 || rEmpty.status === 403) &&
    rFail.status === 403 &&
    bFail.code === "AUTH_TURNSTILE_FAILED" &&
    rForged.status === 403 &&
    bForged.code === "AUTH_TURNSTILE_FAILED" &&
    rPass.status === 200 &&
    bPass.success === true;

  results.attack2 = {
    pass: attack2Pass,
    missing: { status: rMissing.status, code: bMissing.code },
    empty: { status: rEmpty.status, code: bEmpty.code },
    failToken: { status: rFail.status, code: bFail.code },
    forged: { status: rForged.status, code: bForged.code },
    passToken: { status: rPass.status, success: bPass.success },
  };
  console.log(`    [ATTACK 2 VERDICT]: ${attack2Pass ? "PASS" : "FAIL"}\n`);

  // ---------------------------------------------------------------------------
  // ATTACK 3: CLOCK SKEW & FUTURE IAT PROBING
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 3] Clock Skew & Future iat Boundary Probing");
  const now = Math.floor(Date.now() / 1000);

  // Subtest 3.1: iat = now + 600s (+10 minutes) -> MUST BE HTTP 401 AUTH_TOKEN_FUTURE_IAT
  const token600 = signJwt({
    uid: "usr_attacker_future_600",
    email: "future600@zolexora.com",
    zolexora_id: "ZX-8K9M-4P2W-7Y3X",
    type: "user",
    iat: now + 600,
    exp: now + 3600,
  });
  const res3_1 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token600}` },
  });
  const body3_1 = await res3_1.json();
  console.log(`    3.1 iat = now + 600s: HTTP ${res3_1.status}, Code: ${body3_1.code}, Message: "${body3_1.message}"`);

  // Subtest 3.2: iat = now + 301s (+5 min + 1 sec) -> MUST BE HTTP 401 AUTH_TOKEN_FUTURE_IAT
  const token301 = signJwt({
    uid: "usr_attacker_future_301",
    email: "future301@zolexora.com",
    zolexora_id: "ZX-8K9M-4P2W-7Y3X",
    type: "user",
    iat: now + 301,
    exp: now + 3600,
  });
  const res3_2 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token301}` },
  });
  const body3_2 = await res3_2.json();
  console.log(`    3.2 iat = now + 301s: HTTP ${res3_2.status}, Code: ${body3_2.code}, Message: "${body3_2.message}"`);

  // Subtest 3.3: iat = now + 10s (+10 seconds, within 300s skew) -> MUST BE HTTP 200
  const token10 = signJwt({
    uid: "usr_normal_skew_10",
    email: "skew10@zolexora.com",
    zolexora_id: "ZX-8K9M-4P2W-7Y3X",
    type: "user",
    iat: now + 10,
    exp: now + 3600,
  });
  const res3_3 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token10}` },
  });
  const body3_3 = await res3_3.json();
  console.log(`    3.3 iat = now + 10s: HTTP ${res3_3.status}, Authenticated: ${body3_3.authenticated}`);

  // Subtest 3.4: iat = now - 60s (past timestamp) -> MUST BE HTTP 200
  const tokenPast = signJwt({
    uid: "usr_normal_past",
    email: "past@zolexora.com",
    zolexora_id: "ZX-8K9M-4P2W-7Y3X",
    type: "user",
    iat: now - 60,
    exp: now + 3600,
  });
  const res3_4 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokenPast}` },
  });
  const body3_4 = await res3_4.json();
  console.log(`    3.4 iat = now - 60s: HTTP ${res3_4.status}, Authenticated: ${body3_4.authenticated}`);

  // Subtest 3.5: expired token (exp < now) -> MUST BE HTTP 401 AUTH_TOKEN_EXPIRED
  const tokenExpired = signJwt({
    uid: "usr_expired",
    email: "expired@zolexora.com",
    zolexora_id: "ZX-8K9M-4P2W-7Y3X",
    type: "user",
    iat: now - 3600,
    exp: now - 10,
  });
  const res3_5 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokenExpired}` },
  });
  const body3_5 = await res3_5.json();
  console.log(`    3.5 expired token: HTTP ${res3_5.status}, Code: ${body3_5.code}`);

  const attack3Pass =
    res3_1.status === 401 &&
    body3_1.code === "AUTH_TOKEN_FUTURE_IAT" &&
    res3_2.status === 401 &&
    body3_2.code === "AUTH_TOKEN_FUTURE_IAT" &&
    res3_3.status === 200 &&
    body3_3.authenticated === true &&
    res3_4.status === 200 &&
    body3_4.authenticated === true &&
    res3_5.status === 401 &&
    body3_5.code === "AUTH_TOKEN_EXPIRED";

  results.attack3 = {
    pass: attack3Pass,
    future600: { status: res3_1.status, code: body3_1.code },
    future301: { status: res3_2.status, code: body3_2.code },
    skew10: { status: res3_3.status, authenticated: body3_3.authenticated },
    past: { status: res3_4.status, authenticated: body3_4.authenticated },
    expired: { status: res3_5.status, code: body3_5.code },
  };
  console.log(`    [ATTACK 3 VERDICT]: ${attack3Pass ? "PASS" : "FAIL"}\n`);

  // ---------------------------------------------------------------------------
  // ATTACK 4: TOKEN REVOCATION LIFECYCLE
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 4] Token Revocation Lifecycle Probing");
  
  // 4.1 Login
  const rLog = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const bLog = await rLog.json();
  const tokenA = bLog.customToken;
  const targetUid = bLog.user.uid;
  console.log(`    4.1 Login -> Token A obtained for UID ${targetUid} (HTTP ${rLog.status})`);

  // 4.2 Verify Token A
  const rCheckA = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const bCheckA = await rCheckA.json();
  console.log(`    4.2 Token A check -> HTTP ${rCheckA.status}, Authenticated: ${bCheckA.authenticated}`);

  // Sleep 1.1s so revocation timestamp strictly exceeds token A issuance
  await new Promise((r) => setTimeout(r, 1100));

  // 4.3 Revoke Token
  const rRev = await fetch(`${BASE_URL}/api/v1/auth/tokens/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: targetUid,
      reason: "Empirical Attack 4 Life Check",
    }),
  });
  const bRev = await rRev.json();
  console.log(`    4.3 POST /api/v1/auth/tokens/revoke -> HTTP ${rRev.status}, Success: ${bRev.success}`);

  // 4.4 Check Token A post-revocation
  const rCheckARevoked = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const bCheckARevoked = await rCheckARevoked.json();
  console.log(`    4.4 Token A check after revocation -> HTTP ${rCheckARevoked.status}, Code: ${bCheckARevoked.code}`);

  // Sleep 1.1s so fresh token issuance strictly exceeds revocation timestamp
  await new Promise((r) => setTimeout(r, 1100));

  // 4.5 Login again to obtain fresh Token B
  const rLogB = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const bLogB = await rLogB.json();
  const tokenB = bLogB.customToken;
  console.log(`    4.5 Fresh Login -> Token B obtained (HTTP ${rLogB.status})`);

  // 4.6 Check Token B
  const rCheckB = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const bCheckB = await rCheckB.json();
  console.log(`    4.6 Token B check -> HTTP ${rCheckB.status}, Authenticated: ${bCheckB.authenticated}`);

  const attack4Pass =
    rCheckA.status === 200 &&
    bCheckA.authenticated === true &&
    rRev.status === 200 &&
    bRev.success === true &&
    rCheckARevoked.status === 401 &&
    bCheckARevoked.code === "AUTH_TOKEN_REVOKED" &&
    rLogB.status === 200 &&
    rCheckB.status === 200 &&
    bCheckB.authenticated === true;

  results.attack4 = {
    pass: attack4Pass,
    tokenAInitial: rCheckA.status,
    revokeStatus: rRev.status,
    tokenAPostRevokeStatus: rCheckARevoked.status,
    tokenAPostRevokeCode: bCheckARevoked.code,
    tokenBStatus: rCheckB.status,
    tokenBAuth: bCheckB.authenticated,
  };
  console.log(`    [ATTACK 4 VERDICT]: ${attack4Pass ? "PASS" : "FAIL"}\n`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("                     COMPREHENSIVE ATTACK SUMMARY                               ");
  console.log("================================================================================");
  console.log(`Attack 1 (Rate Limiting & Isolation): [${attack1Pass ? "PASS" : "FAIL"}]`);
  console.log(`Attack 2 (Turnstile Bot Defense):     [${attack2Pass ? "PASS" : "FAIL"}]`);
  console.log(`Attack 3 (Clock Skew & Future iat):   [${attack3Pass ? "PASS" : "FAIL"}]`);
  console.log(`Attack 4 (Token Revocation Life):     [${attack4Pass ? "PASS" : "FAIL"}]`);
  console.log("--------------------------------------------------------------------------------");

  const overallPass = attack1Pass && attack2Pass && attack3Pass && attack4Pass;
  console.log(`FINAL OVERALL VERDICT: ${overallPass ? "APPROVE" : "REJECT"}`);
  console.log("================================================================================\n");

  return { results, verdict: overallPass ? "APPROVE" : "REJECT" };
}

runEmpiricalEvaluation().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
