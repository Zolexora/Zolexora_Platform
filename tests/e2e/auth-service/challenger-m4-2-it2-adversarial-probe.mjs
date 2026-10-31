// Adversarial Challenger M4.2 Iteration 2 Empirical Probe Suite
// Deep stress-testing of Signed URLs & 3-Tier RBAC on live port 3081

import { TokenService } from "../../../apps/zolexora-auth-service/dist/services/token.service.js";
import { StorageService } from "../../../apps/zolexora-auth-service/dist/services/storage.service.js";
import { createHmac } from "node:crypto";
import fs from "node:fs";

const BASE_URL = "http://localhost:3081";
const LOG_FILE = new URL("../../../.agents/teamwork/challenger_m4_2_it2/raw_probe_logs.json", import.meta.url);

async function runAdversarialChallengerSuite() {
  console.log("================================================================================");
  console.log("  CHALLENGER M4.2 IT2: DEEP ADVERSARIAL STRESS TEST (PORT 3081)                 ");
  console.log("================================================================================\n");

  const results = [];
  const probeLogs = [];

  function record(id, title, passed, details) {
    const item = { id, title, passed, details };
    results.push(item);
    console.log(`[${passed ? "PASS" : "FAIL"}] ${id}: ${title}`);
    if (!passed) {
      console.log(`       Details: ${JSON.stringify(details)}`);
    }
  }

  // Check Health
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthJson = await healthRes.json();
  if (!healthRes.ok || healthJson.service !== "zolexora-auth-service") {
    throw new Error(`Auth service not healthy on port 3081: status ${healthRes.status}`);
  }
  console.log(`Auth Service is live on port 3081 (${healthJson.service}, status: ${healthJson.status})\n`);

  // Initialize helpers
  const tokenService = new TokenService();
  const storageService = new StorageService("zolexora", "https://storage.zolexora.com");

  // Setup identities
  const docOwner = {
    uid: "ZX-USR-OWNER-IT2",
    zolexora_id: "ZX-USR-OWNER-IT2",
    org_id: "ZX-ORG-AAA1-1111-2222",
    role: "member",
    permissions: ["kyc:read"],
  };
  const docOwnerToken = tokenService.signJwt(docOwner);

  const orgAdmin = {
    uid: "ZX-USR-ADMIN-IT2",
    zolexora_id: "ZX-USR-ADMIN-IT2",
    org_id: "ZX-ORG-AAA1-1111-2222",
    role: "admin",
    permissions: ["kyc:manage"],
  };
  const orgAdminToken = tokenService.signJwt(orgAdmin);

  const orgOwner = {
    uid: "ZX-USR-ORGOWN-IT2",
    zolexora_id: "ZX-USR-ORGOWN-IT2",
    org_id: "ZX-ORG-AAA1-1111-2222",
    role: "owner",
    permissions: ["kyc:manage"],
  };
  const orgOwnerToken = tokenService.signJwt(orgOwner);

  const orgAMember = {
    uid: "ZX-USR-MEMBA-IT2",
    zolexora_id: "ZX-USR-MEMBA-IT2",
    org_id: "ZX-ORG-AAA1-1111-2222",
    role: "member",
    permissions: ["kyc:read"],
  };
  const orgAMemberToken = tokenService.signJwt(orgAMember);

  const foreignOrgAdmin = {
    uid: "ZX-USR-FOR-ADMIN",
    zolexora_id: "ZX-USR-FOR-ADMIN",
    org_id: "ZX-ORG-BBB2-3333-4444",
    role: "admin",
    permissions: ["kyc:manage"],
  };
  const foreignOrgAdminToken = tokenService.signJwt(foreignOrgAdmin);

  const superadmin = {
    uid: "ZX-USR-SUPER-IT2",
    zolexora_id: "ZX-USR-SUPER-IT2",
    role: "superadmin",
    is_platform_admin: true,
    permissions: ["*"],
  };
  const superadminToken = tokenService.signJwt(superadmin);

  // Setup doc
  const pdfBytes = Buffer.from("%PDF-1.7\n%CONFIDENTIAL KYC DOCUMENT RECORD");
  const uploadRes = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${docOwnerToken}`,
      "Content-Type": "application/json",
      "x-zolexora-id": docOwner.zolexora_id,
      "x-organisation-id": docOwner.org_id,
    },
    body: JSON.stringify({
      user_id: docOwner.zolexora_id,
      org_id: docOwner.org_id,
      document_type: "driving_license",
      file: `data:application/pdf;base64,${pdfBytes.toString("base64")}`,
    }),
  });
  const uploadData = await uploadRes.json();
  if (uploadRes.status !== 201 || !uploadData.document_id) {
    throw new Error(`Failed to provision KYC document: ${JSON.stringify(uploadData)}`);
  }
  const testDocId = uploadData.document_id;
  console.log(`Provisioned test KYC doc: ${testDocId} in ${docOwner.org_id}\n`);

  // --- SECTION 1: Boundary Value Testing for Expiry Window (600-900s) ---
  console.log("--------------------------------------------------------------------------------");
  console.log("SECTION 1: Precise Boundary Value Analysis (600 - 900 seconds)");
  console.log("--------------------------------------------------------------------------------");

  const boundaryCases = [
    { expiry: 599, shouldPass: false, label: "Strict lower bound - 1s (599s)" },
    { expiry: 600, shouldPass: true, label: "Exact minimum allowed (600s)" },
    { expiry: 750, shouldPass: true, label: "Midpoint nominal (750s)" },
    { expiry: 900, shouldPass: true, label: "Exact maximum allowed (900s)" },
    { expiry: 901, shouldPass: false, label: "Strict upper bound + 1s (901s)" },
    { expiry: 0, shouldPass: false, label: "Zero expiry (0s)" },
    { expiry: -100, shouldPass: false, label: "Negative expiry (-100s)" },
    { expiry: 86400, shouldPass: false, label: "Excessive expiry (86400s / 24h)" },
    { expiry: "invalid_string", shouldPass: false, label: "Non-numeric string expiry" },
  ];

  for (let i = 0; i < boundaryCases.length; i++) {
    const c = boundaryCases[i];
    const res = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${docOwnerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_id: testDocId,
        expiry_seconds: c.expiry,
      }),
    });
    const body = await res.json();
    probeLogs.push({ test: c.label, status: res.status, body });

    if (c.shouldPass) {
      const ok = res.status === 200 && body.expires_in_seconds === c.expiry && typeof body.signed_url === "string";
      record(`BOUND-${i + 1}`, c.label, ok, { status: res.status, body });
    } else {
      const ok = res.status === 400 && body.code === "AUTH_INVALID_EXPIRY_WINDOW";
      record(`BOUND-${i + 1}`, c.label, ok, { status: res.status, body });
    }
  }

  // --- SECTION 2: 3-Tier RBAC Access Matrix ---
  console.log("\n--------------------------------------------------------------------------------");
  console.log("SECTION 2: 3-Tier RBAC Access Matrix");
  console.log("--------------------------------------------------------------------------------");

  // 2.1 Owner
  const resOwner = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${docOwnerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: testDocId }),
  });
  const dataOwner = await resOwner.json();
  record("RBAC-1", "Document Owner gets signed URL (HTTP 200)", resOwner.status === 200 && !!dataOwner.signed_url, dataOwner);

  // 2.2 Org Admin (same org)
  const resOrgAdmin = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${orgAdminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: testDocId, expiry_seconds: 700 }),
  });
  const dataOrgAdmin = await resOrgAdmin.json();
  record("RBAC-2", "Org Admin (same org) gets signed URL (HTTP 200)", resOrgAdmin.status === 200 && !!dataOrgAdmin.signed_url, dataOrgAdmin);

  // 2.3 Org Owner (same org)
  const resOrgOwner = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${orgOwnerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: testDocId, expiry_seconds: 800 }),
  });
  const dataOrgOwner = await resOrgOwner.json();
  record("RBAC-3", "Org Owner (same org) gets signed URL (HTTP 200)", resOrgOwner.status === 200 && !!dataOrgOwner.signed_url, dataOrgOwner);

  // 2.4 Platform Superadmin
  const resSuper = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${superadminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: testDocId }),
  });
  const dataSuper = await resSuper.json();
  record("RBAC-4", "Platform Superadmin gets signed URL (HTTP 200)", resSuper.status === 200 && !!dataSuper.signed_url, dataSuper);

  // 2.5 Org Member (same org, non-admin) -> MUST BE 403
  const resOrgMember = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${orgAMemberToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: testDocId }),
  });
  const dataOrgMember = await resOrgMember.json();
  record("RBAC-5", "Org Member non-admin forbidden (HTTP 403 AUTH_FORBIDDEN)", resOrgMember.status === 403 && dataOrgMember.code === "AUTH_FORBIDDEN", dataOrgMember);

  // 2.6 Foreign Org Admin (different org) -> MUST BE 403
  const resForeignAdmin = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${foreignOrgAdminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: testDocId }),
  });
  const dataForeignAdmin = await resForeignAdmin.json();
  record("RBAC-6", "Foreign Org Admin forbidden (HTTP 403 AUTH_FORBIDDEN)", resForeignAdmin.status === 403 && dataForeignAdmin.code === "AUTH_FORBIDDEN", dataForeignAdmin);

  // 2.7 Unauthenticated with x-require-auth -> MUST BE 401
  const resUnauth = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-require-auth": "true" },
    body: JSON.stringify({ document_id: testDocId }),
  });
  const dataUnauth = await resUnauth.json();
  record("RBAC-7", "Unauthenticated request rejected with x-require-auth (HTTP 401)", resUnauth.status === 401 && dataUnauth.code === "AUTH_UNAUTHORIZED", dataUnauth);

  // 2.8 Forged JWT Signature -> MUST BE 401
  const forgedToken = docOwnerToken.slice(0, -6) + "abcdef";
  const resForged = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${forgedToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: testDocId }),
  });
  const dataForged = await resForged.json();
  record("RBAC-8", "Forged JWT signature rejected (HTTP 401 AUTH_UNAUTHORIZED)", resForged.status === 401 && dataForged.code === "AUTH_UNAUTHORIZED", dataForged);

  // 2.9 Nonexistent Document ID -> MUST BE 404
  const resNonExistent = await fetch(`${BASE_URL}/api/v1/storage/kyc/signed-url`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${docOwnerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: "kyc_nonexistent_999999" }),
  });
  const dataNonExistent = await resNonExistent.json();
  record("RBAC-9", "Non-existent document returns HTTP 404 AUTH_DOCUMENT_NOT_FOUND", resNonExistent.status === 404 && dataNonExistent.code === "AUTH_DOCUMENT_NOT_FOUND", dataNonExistent);

  // --- SECTION 3: Cryptographic Signature Tamper-Proofing ---
  console.log("\n--------------------------------------------------------------------------------");
  console.log("SECTION 3: Cryptographic Signature Tamper-Proofing & Time Verification");
  console.log("--------------------------------------------------------------------------------");

  const genuineUrl = dataOwner.signed_url;
  const parsed = new URL(genuineUrl);
  const realDocId = testDocId;
  const realExpires = parsed.searchParams.get("expires");
  const realSig = parsed.searchParams.get("sig");

  // 3.1 Genuine URL passes
  const checkGenuine = storageService.verifySignedUrl(genuineUrl);
  record("TAMPER-1", "Genuine URL verifies true", checkGenuine.valid === true, checkGenuine);

  // 3.2 Path doc_id tampered
  const urlTamperedDoc = genuineUrl.replace(realDocId, "kyc_forged_doc_1111");
  const checkTamperedDoc = storageService.verifySignedUrl(urlTamperedDoc);
  record("TAMPER-2", "Tampered doc_id in URL rejected (INVALID_SIGNATURE)", checkTamperedDoc.valid === false && checkTamperedDoc.reason === "INVALID_SIGNATURE", checkTamperedDoc);

  // 3.3 Expiry extended by 1 second
  const urlTamperedExpiry = genuineUrl.replace(`expires=${realExpires}`, `expires=${Number(realExpires) + 1}`);
  const checkTamperedExpiry = storageService.verifySignedUrl(urlTamperedExpiry);
  record("TAMPER-3", "Tampered expires (+1s) rejected (INVALID_SIGNATURE)", checkTamperedExpiry.valid === false && checkTamperedExpiry.reason === "INVALID_SIGNATURE", checkTamperedExpiry);

  // 3.4 Signature bitflip
  const flippedSig = (realSig[0] === "f" ? "0" : "f") + realSig.slice(1);
  const urlTamperedSig = genuineUrl.replace(`sig=${realSig}`, `sig=${flippedSig}`);
  const checkTamperedSig = storageService.verifySignedUrl(urlTamperedSig);
  record("TAMPER-4", "Flipped signature hex rejected (INVALID_SIGNATURE)", checkTamperedSig.valid === false && checkTamperedSig.reason === "INVALID_SIGNATURE", checkTamperedSig);

  // 3.5 Signature truncated (timingSafeEqual length check)
  const truncSig = realSig.slice(0, 32);
  const urlTruncSig = genuineUrl.replace(`sig=${realSig}`, `sig=${truncSig}`);
  const checkTruncSig = storageService.verifySignedUrl(urlTruncSig);
  record("TAMPER-5", "Truncated signature hex rejected (INVALID_SIGNATURE)", checkTruncSig.valid === false && checkTruncSig.reason === "INVALID_SIGNATURE", checkTruncSig);

  // 3.6 Expired URL rejected with URL_EXPIRED
  const pastTime = Math.floor(Date.now() / 1000) - 100;
  const expiredSig = createHmac("sha256", "zolexora-platform-auth-secret-key-32bytes-min")
    .update(`${testDocId}:${pastTime}`)
    .digest("hex");
  const expiredUrl = `https://storage.zolexora.com/private/kyc/${testDocId}?expires=${pastTime}&sig=${expiredSig}`;
  const checkExpired = storageService.verifySignedUrl(expiredUrl);
  record("TAMPER-6", "Expired URL rejected with URL_EXPIRED", checkExpired.valid === false && checkExpired.reason === "URL_EXPIRED", checkExpired);

  // 3.7 Missing sig parameter
  const noSigUrl = `https://storage.zolexora.com/private/kyc/${testDocId}?expires=${realExpires}`;
  const checkNoSig = storageService.verifySignedUrl(noSigUrl);
  record("TAMPER-7", "Missing sig param rejected (MALFORMED_URL)", checkNoSig.valid === false && checkNoSig.reason === "MALFORMED_URL", checkNoSig);

  // 3.8 Missing expires parameter
  const noExpiresUrl = `https://storage.zolexora.com/private/kyc/${testDocId}?sig=${realSig}`;
  const checkNoExpires = storageService.verifySignedUrl(noExpiresUrl);
  record("TAMPER-8", "Missing expires param rejected (MALFORMED_URL)", checkNoExpires.valid === false && checkNoExpires.reason === "MALFORMED_URL", checkNoExpires);

  // 3.9 Completely malformed non-URL string
  const checkGarbage = storageService.verifySignedUrl("not a valid url at all ::::");
  record("TAMPER-9", "Garbage input handled safely (INVALID_URL)", checkGarbage.valid === false && checkGarbage.reason === "INVALID_URL", checkGarbage);

  // Summary
  console.log("\n================================================================================");
  console.log("                           DEEP ADVERSARIAL SCOREBOARD                          ");
  console.log("================================================================================");
  const allPassed = results.every((r) => r.passed);
  console.log(`Total Probes Executed: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`OVERALL EMPIRICAL VERDICT: ${allPassed ? "APPROVE" : "REJECT"}`);
  console.log("================================================================================\n");

  fs.mkdirSync(new URL(".", LOG_FILE), { recursive: true });
  fs.writeFileSync(
    LOG_FILE,
    JSON.stringify({ allPassed, summary: { total: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }, results, probeLogs }, null, 2),
    "utf8"
  );

  if (!allPassed) {
    process.exit(1);
  }
}

runAdversarialChallengerSuite().catch((err) => {
  console.error("Adversarial probe execution failed:", err);
  process.exit(1);
});
