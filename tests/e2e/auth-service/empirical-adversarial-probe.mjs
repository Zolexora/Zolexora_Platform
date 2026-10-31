// Empirical Adversarial Verification Harness for Challenger M2 Remediation 2
// Target: Live Zolexora Auth Service at http://localhost:3081

const BASE_URL = "http://localhost:3081";

async function runAdversarialProbes() {
  console.log("================================================================================");
  console.log("      EMPIRICAL ADVERSARIAL CHALLENGER PROBE — LIVE HTTP://LOCALHOST:3081       ");
  console.log("================================================================================\n");

  const results = [];

  // Reset baseline state before test
  const resetRes = await fetch(`${BASE_URL}/api/v1/test/reset`, { method: "POST" });
  if (!resetRes.ok) throw new Error("Failed to reset test state");
  console.log("[Setup] Baseline repository and rate limiter state reset successfully.\n");

  // ---------------------------------------------------------------------------
  // TASK 1: Brute-Force Rate Limiting (5 failures -> 6th triggers HTTP 429 Retry-After: 900)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("Task 1: 5 Failed Logins -> 6th Attempt Triggers HTTP 429 Retry-After: 900");
  console.log("--------------------------------------------------------------------------------");
  
  const testIp = "198.51.100.201";
  const testEmail = "rate_limit_probe@zolexora.com";
  let t1Passed = true;

  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": testIp,
      },
      body: JSON.stringify({
        email: testEmail,
        password: "IncorrectPassword!",
        turnstile_token: "0.valid-cf-turnstile-token",
      }),
    });

    const status = res.status;
    const data = await res.json();
    console.log(`  Attempt ${i}: Status = ${status}, Code = ${data.code}`);
    if (status !== 401 || data.code !== "AUTH_INVALID_CREDENTIALS") {
      t1Passed = false;
    }
  }

  // 6th Attempt
  const sixthRes = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": testIp,
    },
    body: JSON.stringify({
      email: testEmail,
      password: "IncorrectPassword!",
      turnstile_token: "0.valid-cf-turnstile-token",
    }),
  });

  const sixthStatus = sixthRes.status;
  const retryAfterHeader = sixthRes.headers.get("retry-after") || sixthRes.headers.get("Retry-After");
  const sixthData = await sixthRes.json();

  console.log(`  Attempt 6: Status = ${sixthStatus}`);
  console.log(`             Retry-After Header = ${retryAfterHeader}`);
  console.log(`             Body Code = ${sixthData.code}`);
  console.log(`             Retry After Seconds = ${sixthData.error?.details?.retry_after_seconds}`);

  const retryNum = Number(retryAfterHeader);
  if (
    sixthStatus === 429 &&
    sixthData.code === "AUTH_RATE_LIMITED" &&
    Number.isInteger(retryNum) &&
    retryNum > 0 &&
    retryNum <= 900
  ) {
    console.log("  >>> TASK 1 VERDICT: PASS\n");
    results.push({ task: 1, pass: true, details: `HTTP 429 received, Retry-After: ${retryAfterHeader}` });
  } else {
    console.log("  >>> TASK 1 VERDICT: FAIL\n");
    results.push({ task: 1, pass: false, details: `Status ${sixthStatus}, Retry-After: ${retryAfterHeader}` });
  }

  // ---------------------------------------------------------------------------
  // TASK 2: Introspect Token -> Revoke -> Introspect Returns HTTP 401 AUTH_TOKEN_REVOKED
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("Task 2: Active Token -> Revoke -> Subsequent Introspect Returns HTTP 401 AUTH_TOKEN_REVOKED");
  console.log("--------------------------------------------------------------------------------");

  // Step 2.1: Login to acquire genuine active token
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "0.valid-cf-turnstile-token",
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.customToken;
  const uid = loginData.user?.uid || "usr_9981";
  console.log(`  Obtained active JWT for UID: ${uid}`);

  // Step 2.2: Introspect active token
  const introspect1 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const intro1Data = await introspect1.json();
  console.log(`  Initial Introspection: Status = ${introspect1.status}, Authenticated = ${intro1Data.authenticated}`);

  // Step 2.3: Revoke token via /api/v1/auth/tokens/revoke
  const revokeRes = await fetch(`${BASE_URL}/api/v1/auth/tokens/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, reason: "Empirical challenger test revocation" }),
  });
  const revokeData = await revokeRes.json();
  console.log(`  Revoke Call: Status = ${revokeRes.status}, Success = ${revokeData.success}, Revoked At = ${revokeData.revoked_at}`);

  // Step 2.4: Subsequent Introspection
  const introspect2 = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const intro2Data = await introspect2.json();
  console.log(`  Subsequent Introspection: Status = ${introspect2.status}, Code = ${intro2Data.code}, Message = "${intro2Data.message}"`);

  if (introspect2.status === 401 && intro2Data.code === "AUTH_TOKEN_REVOKED") {
    console.log("  >>> TASK 2 VERDICT: PASS\n");
    results.push({ task: 2, pass: true, details: `HTTP 401 AUTH_TOKEN_REVOKED confirmed` });
  } else {
    console.log("  >>> TASK 2 VERDICT: FAIL\n");
    results.push({ task: 2, pass: false, details: `Status ${introspect2.status}, Code ${intro2Data.code}` });
  }

  // ---------------------------------------------------------------------------
  // TASK 3: Submit Invalid / Forged JWT Signatures to /api/v1/auth/me (HTTP 401)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("Task 3: Submit Invalid/Forged JWT Signatures to /api/v1/auth/me -> HTTP 401 Rejection");
  console.log("--------------------------------------------------------------------------------");

  // Subtest 3A: Tampered signature byte in valid token
  const parts = token.split(".");
  // Replace first character of signature
  const forgedSig = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  const tamperedToken = `${parts[0]}.${parts[1]}.${forgedSig}`;

  const res3A = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  const data3A = await res3A.json();
  console.log(`  Subtest 3A (Tampered Signature Byte): Status = ${res3A.status}, Code = ${data3A.code}`);

  // Subtest 3B: Tampered payload claims
  const fakePayload = Buffer.from(JSON.stringify({ uid: "admin_impostor", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const tamperedPayloadToken = `${parts[0]}.${fakePayload}.${parts[2]}`;

  const res3B = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tamperedPayloadToken}` },
  });
  const data3B = await res3B.json();
  console.log(`  Subtest 3B (Tampered Payload Claims): Status = ${res3B.status}, Code = ${data3B.code}`);

  // Subtest 3C: Arbitrary forged compact token
  const res3C = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.Zm9yZ2VkX3NpZ25hdHVyZV8xMjM0NTY3ODkwMTI" },
  });
  const data3C = await res3C.json();
  console.log(`  Subtest 3C (Arbitrary Forged Token): Status = ${res3C.status}, Code = ${data3C.code}`);

  const t3Pass = res3A.status === 401 && data3A.code === "AUTH_UNAUTHORIZED" &&
                 res3B.status === 401 && data3B.code === "AUTH_UNAUTHORIZED" &&
                 res3C.status === 401 && data3C.code === "AUTH_UNAUTHORIZED";

  if (t3Pass) {
    console.log("  >>> TASK 3 VERDICT: PASS\n");
    results.push({ task: 3, pass: true, details: "All forged/tampered tokens rejected with HTTP 401 AUTH_UNAUTHORIZED" });
  } else {
    console.log("  >>> TASK 3 VERDICT: FAIL\n");
    results.push({ task: 3, pass: false, details: `3A: ${res3A.status}, 3B: ${res3B.status}, 3C: ${res3C.status}` });
  }

  // ---------------------------------------------------------------------------
  // TASK 4: Upload File with Disallowed MIME Type -> HTTP 415 AUTH_INVALID_MIME_TYPE
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("Task 4: Upload File with Disallowed MIME Type -> HTTP 415 AUTH_INVALID_MIME_TYPE");
  console.log("--------------------------------------------------------------------------------");

  // Subtest 4A: Multipart upload with application/x-executable
  const formData = new FormData();
  formData.append("file", new Blob(["#!/bin/sh\necho attack"], { type: "application/x-executable" }), "malware.exe");

  const res4A = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
    method: "POST",
    body: formData,
  });
  const data4A = await res4A.json();
  console.log(`  Subtest 4A (Multipart application/x-executable): Status = ${res4A.status}, Code = ${data4A.code}`);

  // Subtest 4B: Multipart upload with disallowed application/pdf on avatar route
  const formDataPdf = new FormData();
  formDataPdf.append("file", new Blob(["%PDF-1.4 dummy content"], { type: "application/pdf" }), "doc.pdf");

  const res4B = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
    method: "POST",
    body: formDataPdf,
  });
  const data4B = await res4B.json();
  console.log(`  Subtest 4B (Multipart application/pdf on avatar route): Status = ${res4B.status}, Code = ${data4B.code}`);

  // Subtest 4C: JSON Base64 Data URI with text/plain
  const res4C = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: "data:text/plain;base64,aGVsbG8gd29ybGQ=" }),
  });
  const data4C = await res4C.json();
  console.log(`  Subtest 4C (JSON Base64 text/plain): Status = ${res4C.status}, Code = ${data4C.code}`);

  const t4Pass = res4A.status === 415 && data4A.code === "AUTH_INVALID_MIME_TYPE" &&
                 res4B.status === 415 && data4B.code === "AUTH_INVALID_MIME_TYPE" &&
                 res4C.status === 415 && data4C.code === "AUTH_INVALID_MIME_TYPE";

  if (t4Pass) {
    console.log("  >>> TASK 4 VERDICT: PASS\n");
    results.push({ task: 4, pass: true, details: "Disallowed MIME types rejected with HTTP 415 AUTH_INVALID_MIME_TYPE" });
  } else {
    console.log("  >>> TASK 4 VERDICT: FAIL\n");
    results.push({ task: 4, pass: false, details: `4A: ${res4A.status}, 4B: ${res4B.status}, 4C: ${res4C.status}` });
  }

  // ---------------------------------------------------------------------------
  // TASK 5: Upload File Exceeding 10MB -> HTTP 400 AUTH_FILE_TOO_LARGE
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("Task 5: Upload File Exceeding 10MB -> HTTP 400 AUTH_FILE_TOO_LARGE");
  console.log("--------------------------------------------------------------------------------");

  const overLimitBytes = 10 * 1024 * 1024 + 1; // 10,485,761 bytes

  // Subtest 5A: Storage KYC upload with size header exceeding 10MB
  const res5A = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-File-Mime": "application/pdf",
      "X-File-Size": String(overLimitBytes),
    },
    body: JSON.stringify({
      document_type: "passport",
      mime_type: "application/pdf",
      file_size: overLimitBytes,
    }),
  });
  const data5A = await res5A.json();
  console.log(`  Subtest 5A (KYC Upload with size 10,485,761 bytes): Status = ${res5A.status}, Code = ${data5A.code}`);

  // Subtest 5B: Storage Avatar upload with size header exceeding 10MB
  const res5B = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-File-Mime": "image/png",
      "X-File-Size": String(overLimitBytes),
    },
    body: JSON.stringify({}),
  });
  const data5B = await res5B.json();
  console.log(`  Subtest 5B (Avatar Metadata Upload exceeding 10MB): Status = ${res5B.status}, Code = ${data5B.code}`);

  const t5Pass = (res5A.status === 400 && data5A.code === "AUTH_FILE_TOO_LARGE") &&
                 (res5B.status === 400 && data5B.code === "AUTH_FILE_TOO_LARGE");

  if (t5Pass) {
    console.log("  >>> TASK 5 VERDICT: PASS\n");
    results.push({ task: 5, pass: true, details: "Uploads exceeding 10MB rejected with HTTP 400 AUTH_FILE_TOO_LARGE" });
  } else {
    console.log("  >>> TASK 5 VERDICT: FAIL\n");
    results.push({ task: 5, pass: false, details: `5A: ${res5A.status} (${data5A.code}), 5B: ${res5B.status} (${data5B.code})` });
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("                         EMPIRICAL CHALLENGE SUMMARY                            ");
  console.log("================================================================================");
  const allPassed = results.every(r => r.pass);
  for (const r of results) {
    console.log(`Task ${r.task}: [${r.pass ? "PASS" : "FAIL"}] - ${r.details}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`OVERALL VERDICT: ${allPassed ? "APPROVE" : "FAIL"}`);
  console.log("================================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runAdversarialProbes().catch((err) => {
  console.error("Test execution failed with fatal error:", err);
  process.exit(1);
});
