#!/usr/bin/env node
/**
 * Empirical Attack Harness for Gate 3 Verification
 * Target: http://localhost:3081
 * Challenger: challenger_m3_1_gen8
 */

import crypto from "node:crypto";

const BASE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3081";
const SECRET = process.env.SESSION_SECRET || "zolexora-platform-auth-secret-key-32bytes-min";

function signJwtWithIat(payload, secret = SECRET) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function run() {
  console.log("================================================================================");
  console.log("            CHALLENGER_M3_1_GEN8 LIVE EMPIRICAL ATTACK SUITE                    ");
  console.log(`Target: ${BASE_URL}`);
  console.log("================================================================================\n");

  const attackResults = {};

  // ---------------------------------------------------------------------------
  // ATTACK 1: Brute-Force Rate Limiting (5 failures -> 6th returns HTTP 429 & Retry-After: 900)
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 1] Rate Limiting (5 failures -> 6th returns HTTP 429 & Retry-After: 900)");
  const attack1Ip = `198.51.100.${Math.floor(Math.random() * 150) + 50}`;
  const attack1Email = `attacker_rate_limit_${Date.now()}@zolexora.com`;
  const attemptStatuses = [];

  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": attack1Ip,
      },
      body: JSON.stringify({
        email: attack1Email,
        password: "IncorrectPassword123!",
        turnstile_token: "1x00000000000000000000AA",
      }),
    });
    const body = await res.json();
    attemptStatuses.push({ attempt: i, status: res.status, code: body.code });
    console.log(`    Attempt ${i}: HTTP ${res.status} (code: ${body.code})`);
  }

  const res6 = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": attack1Ip,
    },
    body: JSON.stringify({
      email: attack1Email,
      password: "IncorrectPassword123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const res6Body = await res6.json();
  const retryAfterHeader = res6.headers.get("retry-after") || res6.headers.get("Retry-After");
  console.log(`    Attempt 6: HTTP ${res6.status}`);
  console.log(`    Retry-After Header: ${retryAfterHeader}`);
  console.log(`    Response Body: ${JSON.stringify(res6Body)}`);

  const attack1Passed =
    res6.status === 429 &&
    res6Body.code === "AUTH_RATE_LIMITED" &&
    retryAfterHeader === "900";
  attackResults.attack1 = {
    pass: attack1Passed,
    status: res6.status,
    retryAfter: retryAfterHeader,
    code: res6Body.code,
    attempts1to5: attemptStatuses,
  };
  console.log(`    Verdict: ${attack1Passed ? "PASS" : "FAIL"}\n`);

  // ---------------------------------------------------------------------------
  // ATTACK 2: Turnstile Bot Defense (missing/bad token -> HTTP 400/403, pass token -> HTTP 200)
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 2] Turnstile Bot Defense (missing/bad token -> HTTP 403, 1x000...AA -> pass)");
  
  // 2A: Missing token
  const resMissing = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
    }),
  });
  const bodyMissing = await resMissing.json();
  console.log(`    2A (Missing Token): HTTP ${resMissing.status} (code: ${bodyMissing.code})`);

  // 2B: Official Cloudflare Failure Token (2x00000000000000000000AA)
  const resFailToken = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "2x00000000000000000000AA",
    }),
  });
  const bodyFailToken = await resFailToken.json();
  console.log(`    2B (2x000...AA Token): HTTP ${resFailToken.status} (code: ${bodyFailToken.code})`);

  // 2C: Forged / Arbitrary Token
  const resForged = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "malicious_forged_bot_token",
    }),
  });
  const bodyForged = await resForged.json();
  console.log(`    2C (Forged Token): HTTP ${resForged.status} (code: ${bodyForged.code})`);

  // 2D: Official Cloudflare Pass Token (1x00000000000000000000AA)
  const resPassToken = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const bodyPassToken = await resPassToken.json();
  console.log(`    2D (1x000...AA Token): HTTP ${resPassToken.status} (success: ${bodyPassToken.success})`);

  const attack2Passed =
    (resMissing.status === 400 || resMissing.status === 403) &&
    resFailToken.status === 403 &&
    bodyFailToken.code === "AUTH_TURNSTILE_FAILED" &&
    resForged.status === 403 &&
    bodyForged.code === "AUTH_TURNSTILE_FAILED" &&
    resPassToken.status === 200 &&
    bodyPassToken.success === true;
  attackResults.attack2 = {
    pass: attack2Passed,
    missingStatus: resMissing.status,
    missingCode: bodyMissing.code,
    failTokenStatus: resFailToken.status,
    failTokenCode: bodyFailToken.code,
    forgedStatus: resForged.status,
    forgedCode: bodyForged.code,
    passTokenStatus: resPassToken.status,
    passTokenSuccess: bodyPassToken.success,
  };
  console.log(`    Verdict: ${attack2Passed ? "PASS" : "FAIL"}\n`);

  // ---------------------------------------------------------------------------
  // ATTACK 3: Clock Skew / Future iat (+10m) -> HTTP 401
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 3] Clock Skew / Future iat (+10m) -> HTTP 401");
  const nowSec = Math.floor(Date.now() / 1000);
  const futureIat = nowSec + 600; // 10 minutes (600 seconds) in the future
  const futureExp = nowSec + 3600;

  const futureToken = signJwtWithIat({
    uid: "usr_attacker_future_iat",
    email: "future_iat@zolexora.com",
    zolexora_id: "ZX-8K9M-4P2W-7Y3X",
    type: "user",
    iat: futureIat,
    exp: futureExp,
  });

  const resFuture = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${futureToken}` },
  });
  const futureBodyText = await resFuture.text();
  let futureBodyJson = {};
  try {
    futureBodyJson = JSON.parse(futureBodyText);
  } catch {}

  console.log(`    Constructed Token with iat = now + 600s (${futureIat})`);
  console.log(`    Request: GET ${BASE_URL}/api/v1/auth/me`);
  console.log(`    Response Status: HTTP ${resFuture.status}`);
  console.log(`    Response Headers: ${JSON.stringify(Object.fromEntries(resFuture.headers.entries()))}`);
  console.log(`    Response Body: ${futureBodyText}`);

  const attack3Passed = resFuture.status === 401;
  attackResults.attack3 = {
    pass: attack3Passed,
    status: resFuture.status,
    expectedStatus: 401,
    body: futureBodyJson,
    rawBody: futureBodyText,
  };
  console.log(`    Verdict: ${attack3Passed ? "PASS" : "FAIL (Expected HTTP 401, observed HTTP " + resFuture.status + ")"}\n`);

  // ---------------------------------------------------------------------------
  // ATTACK 4: Token Revocation Lifecycle (revoked token -> HTTP 401, fresh token -> HTTP 200)
  // ---------------------------------------------------------------------------
  console.log(">>> [ATTACK 4] Token Revocation Lifecycle (revoked token -> HTTP 401, fresh token -> HTTP 200)");
  
  // 4.1 Login
  const resLogin1 = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const login1Json = await resLogin1.json();
  const token1 = login1Json.customToken;
  const targetUid = login1Json.user.uid;
  console.log(`    4.1: Acquired active Token 1 for UID ${targetUid} (HTTP ${resLogin1.status})`);

  // 4.2 Verify Token 1 on /api/v1/auth/me
  const resMe1 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const me1Json = await resMe1.json();
  console.log(`    4.2: Verified Token 1 on /api/v1/auth/me -> HTTP ${resMe1.status} (authenticated: ${me1Json.authenticated})`);

  // Wait 1.1s so revocation timestamp T > token1.iat
  await new Promise((r) => setTimeout(r, 1100));

  // 4.3 Revoke Token
  const resRevoke = await fetch(`${BASE_URL}/api/v1/auth/tokens/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: targetUid,
      reason: "Empirical Attack 4 Revocation",
    }),
  });
  const revokeJson = await resRevoke.json();
  console.log(`    4.3: POST /api/v1/auth/tokens/revoke -> HTTP ${resRevoke.status} (success: ${revokeJson.success}, revoked_at: ${revokeJson.revoked_at})`);

  // 4.4 Attempt /api/v1/auth/me with revoked Token 1
  const resMeRevoked = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const meRevokedJson = await resMeRevoked.json();
  console.log(`    4.4: GET /api/v1/auth/me with revoked Token 1 -> HTTP ${resMeRevoked.status} (code: ${meRevokedJson.code})`);

  // Wait 1.1s so fresh token.iat > revocation timestamp T
  await new Promise((r) => setTimeout(r, 1100));

  // 4.5 Mint fresh Token 2 for same user
  const resLogin2 = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "1x00000000000000000000AA",
    }),
  });
  const login2Json = await resLogin2.json();
  const token2 = login2Json.customToken;
  console.log(`    4.5: Re-authenticated and acquired fresh Token 2 (HTTP ${resLogin2.status})`);

  // 4.6 Verify fresh Token 2 on /api/v1/auth/me
  const resMeFresh = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const meFreshJson = await resMeFresh.json();
  console.log(`    4.6: GET /api/v1/auth/me with fresh Token 2 -> HTTP ${resMeFresh.status} (authenticated: ${meFreshJson.authenticated})`);

  const attack4Passed =
    resMe1.status === 200 &&
    resRevoke.status === 200 &&
    revokeJson.success === true &&
    resMeRevoked.status === 401 &&
    meRevokedJson.code === "AUTH_TOKEN_REVOKED" &&
    resLogin2.status === 200 &&
    resMeFresh.status === 200 &&
    meFreshJson.authenticated === true;
  attackResults.attack4 = {
    pass: attack4Passed,
    initialStatus: resMe1.status,
    revokeStatus: resRevoke.status,
    revokedCheckStatus: resMeRevoked.status,
    revokedCheckCode: meRevokedJson.code,
    freshTokenStatus: resMeFresh.status,
    freshTokenAuth: meFreshJson.authenticated,
  };
  console.log(`    Verdict: ${attack4Passed ? "PASS" : "FAIL"}\n`);

  // ---------------------------------------------------------------------------
  // FINAL EVALUATION
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("                          EMPIRICAL RESULTS SUMMARY                             ");
  console.log("================================================================================");
  console.log(`Attack 1 (Rate Limiting):            [${attackResults.attack1.pass ? "PASS" : "FAIL"}]`);
  console.log(`Attack 2 (Turnstile Bot Defense):    [${attackResults.attack2.pass ? "PASS" : "FAIL"}]`);
  console.log(`Attack 3 (Clock Skew / Future iat):  [${attackResults.attack3.pass ? "PASS" : "FAIL"}]`);
  console.log(`Attack 4 (Token Revocation Life):    [${attackResults.attack4.pass ? "PASS" : "FAIL"}]`);
  console.log("--------------------------------------------------------------------------------");
  
  const allPassed =
    attackResults.attack1.pass &&
    attackResults.attack2.pass &&
    attackResults.attack3.pass &&
    attackResults.attack4.pass;

  console.log(`OVERALL EMPIRICAL VERDICT: ${allPassed ? "APPROVE" : "REJECT"}`);
  console.log("================================================================================\n");

  return { attackResults, verdict: allPassed ? "APPROVE" : "REJECT" };
}

run().catch((err) => {
  console.error("Fatal attack runner failure:", err);
  process.exit(1);
});
