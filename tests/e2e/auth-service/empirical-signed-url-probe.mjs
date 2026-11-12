// Empirical Adversarial Verification Harness for Challenger M4.2
// Target: Live Zolexora Auth Service at http://localhost:3081
// Tests: Signed URL Expiry Bounds, 3-Tier RBAC Access Control, Authorized Verification, Signature Tampering

import { TokenService } from "../../../apps/auth-service/dist/services/token.service.js";
import { StorageService } from "../../../apps/auth-service/dist/services/storage.service.js";

const BASE_URL = "http://localhost:3081";

async function runEmpiricalAttackSuite() {
  console.log("================================================================================");
  console.log("   EMPIRICAL ADVERSARIAL CHALLENGER M4.2 — SIGNED URLS & RBAC (PORT 3081)       ");
  console.log("================================================================================\n");

  const results = [];
  const rawLogs = [];

  function logProbe(name, reqSummary, res, body) {
    const entry = {
      name,
      request: reqSummary,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body,
    };
    rawLogs.push(entry);
    console.log(`[PROBE] ${name}`);
    console.log(`  -> Status: ${res.status} ${res.statusText}`);
    console.log(`  -> Content-Type: ${res.headers.get("content-type")}`);
    console.log(`  -> Body: ${JSON.stringify(body)}`);
    return entry;
  }

  // Step 0: Ensure Auth Service is healthy on port 3081
  console.log("--------------------------------------------------------------------------------");
  console.log("Setup: Verifying Port 3081 Health & Resetting State");
  console.log("--------------------------------------------------------------------------------");
  
  const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
  if (!healthRes.ok) {
    throw new Error(`Auth Service healthcheck failed with status ${healthRes.status}`);
  }
  const healthData = await healthRes.json();
  console.log(`  Health Status: ${healthData.status}, Service: ${healthData.service}, Port: ${healthData.port}`);

  const resetRes = await fetch(`${BASE_URL}/api/v1/test/reset`, { method: "POST" });
  if (!resetRes.ok) throw new Error("Failed to reset test repository state");
  console.log("  Baseline state reset successfully.\n");

  // Initialize helper services for token generation & signature verification
  const tokenService = new TokenService();
  const storageService = new StorageService("zolexora", "https://storage.zolexora.com");

  // Create Identity Tokens
  const user1OwnerToken = tokenService.signJwt({
    uid: "ZX-USR-OWNER-M4-1",
    zolexora_id: "ZX-USR-OWNER-M4-1",
    org_id: "ZX-ORG-AAAA-1111-2222",
    role: "member",
    permissions: ["kyc:read"],
  });

  const user2UnrelatedToken = tokenService.signJwt({
    uid: "ZX-USR-UNRELATED-2",
    zolexora_id: "ZX-USR-UNRELATED-2",
    org_id: "ZX-ORG-ZZZZ-9999-8888",
    role: "user",
    permissions: ["kyc:read"],
  });

  const user3OrgBMemberToken = tokenService.signJwt({
    uid: "ZX-USR-ORGB-MEMBER-3",
    zolexora_id: "ZX-USR-ORGB-MEMBER-3",
    org_id: "ZX-ORG-BBBB-3333-4444",
    role: "member",
    permissions: ["kyc:read"],
  });

  const user4OrgAMemberToken = tokenService.signJwt({
    uid: "ZX-USR-ORGA-MEMBER-4",
    zolexora_id: "ZX-USR-ORGA-MEMBER-4",
    org_id: "ZX-ORG-AAAA-1111-2222",
    role: "member",
    permissions: ["trips:read"],
  });

  const orgAdminToken = tokenService.signJwt({
    uid: "ZX-USR-ORGA-ADMIN-5",
    zolexora_id: "ZX-USR-ORGA-ADMIN-5",
    org_id: "ZX-ORG-AAAA-1111-2222",
    role: "admin",
    permissions: ["kyc:manage"],
  });

  const orgOwnerToken = tokenService.signJwt({
    uid: "ZX-USR-ORGA-OWNER-6",
    zolexora_id: "ZX-USR-ORGA-OWNER-6",
    org_id: "ZX-ORG-AAAA-1111-2222",
    role: "owner",
    permissions: ["kyc:manage"],
  });

  const superadminToken = tokenService.signJwt({
    uid: "ZX-USR-SUPERADMIN-7",
    zolexora_id: "ZX-USR-SUPERADMIN-7",
    role: "superadmin",
    is_platform_admin: true,
    permissions: ["*"],
  });

  // Setup: Provision private KYC document for User 1 in Org A
  console.log("--------------------------------------------------------------------------------");
  console.log("Provisioning: Create Private KYC Document for User 1 in Org A");
  console.log("--------------------------------------------------------------------------------");

  const pdfBase64 = Buffer.from("%PDF-1.4\n%confidential passport doc payload").toString("base64");
  const uploadRes = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user1OwnerToken}`,
      "Content-Type": "application/json",
      "x-zolexora-id": "ZX-USR-OWNER-M4-1",
      "x-organisation-id": "ZX-ORG-AAAA-1111-2222",
    },
    body: JSON.stringify({
      user_id: "ZX-USR-OWNER-M4-1",
      org_id: "ZX-ORG-AAAA-1111-2222",
      document_type: "passport",
      file: `data:application/pdf;base64,${pdfBase64}`,
    }),
  });
  const uploadData = await uploadRes.json();
  const testDocId = uploadData.document_id;
  logProbe("Provision KYC Document", { user: "ZX-USR-OWNER-M4-1", org: "ZX-ORG-AAAA-1111-2222" }, uploadRes, uploadData);

  if (
    uploadRes.status === 201 &&
    testDocId &&
    uploadData.storage_key === `kyc/ZX-ORG-AAAA-1111-2222/ZX-USR-OWNER-M4-1/${testDocId}.pdf`
  ) {
    console.log(`  Document created successfully: doc_id = ${testDocId}`);
    console.log(`  Storage Key: ${uploadData.storage_key}\n`);
    results.push({ test: "Setup Provisioning", pass: true, details: `Created doc ${testDocId}` });
  } else {
    console.error("  Document provisioning FAILED!");
    results.push({ test: "Setup Provisioning", pass: false, details: `Status ${uploadRes.status}` });
    process.exit(1);
  }

  // ===========================================================================
  // ATTACK 1: Expiry Window Bounds Check
  // ===========================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("ATTACK 1: Expiry Window Bounds Check");
  console.log("--------------------------------------------------------------------------------");

  // 1A: expiry_seconds = 300 (5 min) -> MUST BE REJECTED with HTTP 400 (AUTH_INVALID_EXPIRY_WINDOW)
  const res1A = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user1OwnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 300,
    }),
  });
  const data1A = await res1A.json();
  logProbe("Attack 1A (expiry_seconds: 300)", { doc: testDocId, expiry_seconds: 300 }, res1A, data1A);

  const pass1A = res1A.status === 400 && data1A.code === "AUTH_INVALID_EXPIRY_WINDOW";
  results.push({
    test: "Attack 1A (expiry 300s rejected)",
    pass: pass1A,
    status: res1A.status,
    code: data1A.code,
    details: data1A.message,
  });

  // 1B: expiry_seconds = 1800 (30 min) -> MUST BE REJECTED with HTTP 400 (AUTH_INVALID_EXPIRY_WINDOW)
  const res1B = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user1OwnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 1800,
    }),
  });
  const data1B = await res1B.json();
  logProbe("Attack 1B (expiry_seconds: 1800)", { doc: testDocId, expiry_seconds: 1800 }, res1B, data1B);

  const pass1B = res1B.status === 400 && data1B.code === "AUTH_INVALID_EXPIRY_WINDOW";
  results.push({
    test: "Attack 1B (expiry 1800s rejected)",
    pass: pass1B,
    status: res1B.status,
    code: data1B.code,
    details: data1B.message,
  });

  // 1C: expiry_seconds = 900 (15 min) -> accepted with HTTP 200
  const res1C = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user1OwnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 900,
    }),
  });
  const data1C = await res1C.json();
  logProbe("Attack 1C (expiry_seconds: 900)", { doc: testDocId, expiry_seconds: 900 }, res1C, data1C);

  const pass1C =
    res1C.status === 200 &&
    data1C.expires_in_seconds === 900 &&
    typeof data1C.signed_url === "string" &&
    typeof data1C.expires_at === "string";
  results.push({
    test: "Attack 1C (expiry 900s accepted)",
    pass: pass1C,
    status: res1C.status,
    expires_in_seconds: data1C.expires_in_seconds,
  });

  // 1D: omit expiry_seconds -> accepted with HTTP 200, default 900
  const res1D = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user1OwnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
    }),
  });
  const data1D = await res1D.json();
  logProbe("Attack 1D (omit expiry_seconds)", { doc: testDocId }, res1D, data1D);

  const pass1D =
    res1D.status === 200 &&
    data1D.expires_in_seconds === 900 &&
    typeof data1D.signed_url === "string";
  results.push({
    test: "Attack 1D (omitted expiry defaults to 900s)",
    pass: pass1D,
    status: res1D.status,
    expires_in_seconds: data1D.expires_in_seconds,
  });

  console.log(`\n>>> ATTACK 1 VERDICT: ${pass1A && pass1B && pass1C && pass1D ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // ATTACK 2: RBAC Access Control Violation
  // ===========================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("ATTACK 2: RBAC Access Control Violation");
  console.log("--------------------------------------------------------------------------------");

  // 2A: User 2 (unrelated user) requests signed URL -> MUST BE REJECTED with HTTP 403 AUTH_FORBIDDEN
  const res2A = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user2UnrelatedToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 900,
    }),
  });
  const data2A = await res2A.json();
  logProbe("Attack 2A (User 2 unrelated)", { doc: testDocId, caller: "ZX-USR-UNRELATED-2" }, res2A, data2A);

  const pass2A = res2A.status === 403 && data2A.code === "AUTH_FORBIDDEN";
  results.push({
    test: "Attack 2A (User 2 unrelated forbidden)",
    pass: pass2A,
    status: res2A.status,
    code: data2A.code,
    details: data2A.message,
  });

  // 2B: User 3 (member in different Org B) requests signed URL -> MUST BE REJECTED with HTTP 403 AUTH_FORBIDDEN
  const res2B = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user3OrgBMemberToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 900,
    }),
  });
  const data2B = await res2B.json();
  logProbe("Attack 2B (User 3 Org B member)", { doc: testDocId, caller: "ZX-USR-ORGB-MEMBER-3", org: "ZX-ORG-BBBB-3333-4444" }, res2B, data2B);

  const pass2B = res2B.status === 403 && data2B.code === "AUTH_FORBIDDEN";
  results.push({
    test: "Attack 2B (User 3 Org B member forbidden)",
    pass: pass2B,
    status: res2B.status,
    code: data2B.code,
    details: data2B.message,
  });

  // 2C: User 4 (member in Org A with role member, non-admin) requests signed URL -> MUST BE REJECTED with HTTP 403 AUTH_FORBIDDEN
  const res2C = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user4OrgAMemberToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 900,
    }),
  });
  const data2C = await res2C.json();
  logProbe("Attack 2C (User 4 Org A member non-admin)", { doc: testDocId, caller: "ZX-USR-ORGA-MEMBER-4", org: "ZX-ORG-AAAA-1111-2222", role: "member" }, res2C, data2C);

  const pass2C = res2C.status === 403 && data2C.code === "AUTH_FORBIDDEN";
  results.push({
    test: "Attack 2C (User 4 Org A member non-admin forbidden)",
    pass: pass2C,
    status: res2C.status,
    code: data2C.code,
    details: data2C.message,
  });

  console.log(`\n>>> ATTACK 2 VERDICT: ${pass2A && pass2B && pass2C ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // ATTACK 3: Authorized Access Verification
  // ===========================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("ATTACK 3: Authorized Access Verification");
  console.log("--------------------------------------------------------------------------------");

  // 3A: User 1 (document owner) requests signed URL -> succeeds with HTTP 200 { signed_url, expires_at }
  const res3A = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user1OwnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 900,
    }),
  });
  const data3A = await res3A.json();
  logProbe("Attack 3A (User 1 document owner)", { doc: testDocId, caller: "ZX-USR-OWNER-M4-1" }, res3A, data3A);

  const pass3A =
    res3A.status === 200 &&
    typeof data3A.signed_url === "string" &&
    typeof data3A.expires_at === "string" &&
    data3A.expires_in_seconds === 900;
  results.push({
    test: "Attack 3A (User 1 doc owner succeeds)",
    pass: pass3A,
    status: res3A.status,
    signed_url: data3A.signed_url,
    expires_at: data3A.expires_at,
  });

  // 3B: Org Admin in Org A requests signed URL -> succeeds with HTTP 200
  const res3B = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${orgAdminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 750,
    }),
  });
  const data3B = await res3B.json();
  logProbe("Attack 3B (Org Admin in Org A)", { doc: testDocId, caller: "ZX-USR-ORGA-ADMIN-5", org: "ZX-ORG-AAAA-1111-2222", role: "admin" }, res3B, data3B);

  const pass3B =
    res3B.status === 200 &&
    typeof data3B.signed_url === "string" &&
    data3B.expires_in_seconds === 750;
  results.push({
    test: "Attack 3B (Org Admin in Org A succeeds)",
    pass: pass3B,
    status: res3B.status,
    expires_in_seconds: data3B.expires_in_seconds,
  });

  // 3C: Org Owner in Org A requests signed URL -> succeeds with HTTP 200
  const res3C = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${orgOwnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 800,
    }),
  });
  const data3C = await res3C.json();
  logProbe("Attack 3C (Org Owner in Org A)", { doc: testDocId, caller: "ZX-USR-ORGA-OWNER-6", org: "ZX-ORG-AAAA-1111-2222", role: "owner" }, res3C, data3C);

  const pass3C =
    res3C.status === 200 &&
    typeof data3C.signed_url === "string" &&
    data3C.expires_in_seconds === 800;
  results.push({
    test: "Attack 3C (Org Owner in Org A succeeds)",
    pass: pass3C,
    status: res3C.status,
    expires_in_seconds: data3C.expires_in_seconds,
  });

  // 3D: Platform Superadmin requests signed URL -> succeeds with HTTP 200
  const res3D = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${superadminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: testDocId,
      expiry_seconds: 900,
    }),
  });
  const data3D = await res3D.json();
  logProbe("Attack 3D (Platform Superadmin)", { doc: testDocId, caller: "ZX-USR-SUPERADMIN-7", role: "superadmin" }, res3D, data3D);

  const pass3D =
    res3D.status === 200 &&
    typeof data3D.signed_url === "string" &&
    data3D.expires_in_seconds === 900;
  results.push({
    test: "Attack 3D (Platform Superadmin succeeds)",
    pass: pass3D,
    status: res3D.status,
    expires_in_seconds: data3D.expires_in_seconds,
  });

  console.log(`\n>>> ATTACK 3 VERDICT: ${pass3A && pass3B && pass3C && pass3D ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // ATTACK 4: Signature Tampering
  // ===========================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("ATTACK 4: Signature Tampering & Cryptographic Verification");
  console.log("--------------------------------------------------------------------------------");

  const genuineSignedUrl = data3A.signed_url;
  console.log(`  Genuine Signed URL under test:\n  ${genuineSignedUrl}`);

  // 4A: Verify genuine signed URL -> MUST BE VALID
  const verifyGenuine = storageService.verifySignedUrl(genuineSignedUrl);
  console.log(`  4A: Genuine URL Verification: valid = ${verifyGenuine.valid}, reason = ${verifyGenuine.reason || "NONE"}`);
  const pass4A = verifyGenuine.valid === true;
  results.push({
    test: "Attack 4A (Genuine URL verification)",
    pass: pass4A,
    valid: verifyGenuine.valid,
  });

  // 4B: Tamper with document_id in URL path -> verification MUST FAIL
  const tamperedDocUrl = genuineSignedUrl.replace(testDocId, "kyc_impostor_victim_doc_99999");
  const verifyTamperedDoc = storageService.verifySignedUrl(tamperedDocUrl);
  console.log(`  4B: Tampered Document ID URL Verification: valid = ${verifyTamperedDoc.valid}, reason = ${verifyTamperedDoc.reason}`);
  const pass4B = verifyTamperedDoc.valid === false && verifyTamperedDoc.reason === "INVALID_SIGNATURE";
  results.push({
    test: "Attack 4B (Tampered doc_id rejected)",
    pass: pass4B,
    valid: verifyTamperedDoc.valid,
    reason: verifyTamperedDoc.reason,
  });

  // 4C: Tamper with expires parameter -> verification MUST FAIL
  const parsedUrl = new URL(genuineSignedUrl);
  const currentExpires = parsedUrl.searchParams.get("expires");
  const tamperedExpiresUrl = genuineSignedUrl.replace(`expires=${currentExpires}`, `expires=${Number(currentExpires) + 86400}`);
  const verifyTamperedExpires = storageService.verifySignedUrl(tamperedExpiresUrl);
  console.log(`  4C: Tampered Expires URL Verification: valid = ${verifyTamperedExpires.valid}, reason = ${verifyTamperedExpires.reason}`);
  const pass4C = verifyTamperedExpires.valid === false && verifyTamperedExpires.reason === "INVALID_SIGNATURE";
  results.push({
    test: "Attack 4C (Tampered expires rejected)",
    pass: pass4C,
    valid: verifyTamperedExpires.valid,
    reason: verifyTamperedExpires.reason,
  });

  // 4D: Tamper with HMAC signature hex -> verification MUST FAIL
  const currentSig = parsedUrl.searchParams.get("sig");
  const forgedSig = (currentSig[0] === "a" ? "b" : "a") + currentSig.slice(1);
  const tamperedSigUrl = genuineSignedUrl.replace(`sig=${currentSig}`, `sig=${forgedSig}`);
  const verifyTamperedSig = storageService.verifySignedUrl(tamperedSigUrl);
  console.log(`  4D: Tampered Signature Hex URL Verification: valid = ${verifyTamperedSig.valid}, reason = ${verifyTamperedSig.reason}`);
  const pass4D = verifyTamperedSig.valid === false && verifyTamperedSig.reason === "INVALID_SIGNATURE";
  results.push({
    test: "Attack 4D (Tampered signature rejected)",
    pass: pass4D,
    valid: verifyTamperedSig.valid,
    reason: verifyTamperedSig.reason,
  });

  // 4E: Expired URL check (past expiry) -> verification MUST FAIL with URL_EXPIRED
  const pastExpiry = Math.floor(Date.now() / 1000) - 300;
  const expiredCanonical = `${testDocId}:${pastExpiry}`;
  const crypto = await import("node:crypto");
  const expiredSig = crypto.createHmac("sha256", "zolexora-platform-auth-secret-key-32bytes-min")
    .update(expiredCanonical)
    .digest("hex");
  const expiredUrl = `https://storage.zolexora.com/private/kyc/${testDocId}?expires=${pastExpiry}&sig=${expiredSig}`;
  const verifyExpired = storageService.verifySignedUrl(expiredUrl);
  console.log(`  4E: Expired URL Verification: valid = ${verifyExpired.valid}, reason = ${verifyExpired.reason}`);
  const pass4E = verifyExpired.valid === false && verifyExpired.reason === "URL_EXPIRED";
  results.push({
    test: "Attack 4E (Expired URL rejected)",
    pass: pass4E,
    valid: verifyExpired.valid,
    reason: verifyExpired.reason,
  });

  console.log(`\n>>> ATTACK 4 VERDICT: ${pass4A && pass4B && pass4C && pass4D && pass4E ? "PASS" : "FAIL"}\n`);

  // ===========================================================================
  // SUMMARY OF EMPIRICAL ATTACKS
  // ===========================================================================
  console.log("================================================================================");
  console.log("                       EMPIRICAL ATTACK RESULTS SUMMARY                         ");
  console.log("================================================================================");
  const allPassed = results.every((r) => r.pass);
  for (const r of results) {
    console.log(`  [${r.pass ? "PASS" : "FAIL"}] ${r.test}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`OVERALL VERDICT: ${allPassed ? "APPROVE" : "REJECT"}`);
  console.log("================================================================================\n");

  // Output raw logs as JSON string for report generation
  import("node:fs").then((fs) => {
    const logFile = new URL("../../../.agents/teamwork/challenger_m4_2/raw_probe_logs.json", import.meta.url);
    fs.mkdirSync(new URL(".", logFile), { recursive: true });
    fs.writeFileSync(
      logFile,
      JSON.stringify({ allPassed, results, rawLogs }, null, 2),
      "utf8"
    );
  });

  if (!allPassed) {
    process.exit(1);
  }
}

runEmpiricalAttackSuite().catch((err) => {
  console.error("Fatal error during empirical attack suite execution:", err);
  process.exit(1);
});
