import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 1: Feature 8 — Cloudinary Media & Private KYC Document Security", () => {
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

  it("T1.8.01: Public avatar upload to Cloudinary returns optimized f_auto,q_auto URL at users/avatars/{zx_id}", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Zolexora-ID": FIXTURES.ids.validUser,
      },
      body: JSON.stringify({ file: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("f_auto,q_auto");
    expect(data.public_id).toBe(`users/avatars/${FIXTURES.ids.validUser}`);
  });

  it("T1.8.02: Public organization logo upload delivers optimized URL at orgs/logos/{org_id}", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/logos/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Organisation-ID": FIXTURES.ids.validOrg,
      },
      body: JSON.stringify({ file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("f_auto,q_auto");
    expect(data.public_id).toBe(`orgs/logos/${FIXTURES.ids.validOrg}`);
  });

  it("T1.8.03: Private KYC upload strictly rejects non-whitelisted MIME types with HTTP 415", async () => {
    for (const forbiddenMime of FIXTURES.storage.forbiddenMimes) {
      const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-File-Mime": forbiddenMime,
          "X-File-Size": "5000",
        },
        body: JSON.stringify({
          document_type: "passport",
          mime_type: forbiddenMime,
          file_size: 5000,
        }),
      });

      expect(res.status).toBe(415);
      const data = await res.json();
      expect(data.code).toBe("AUTH_INVALID_MIME_TYPE");
    }
  });

  it("T1.8.04: Private KYC upload exceeding 10MB limit is rejected with HTTP 400 AUTH_FILE_TOO_LARGE", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-File-Mime": "application/pdf",
        "X-File-Size": String(FIXTURES.storage.exceededFileSize),
      },
      body: JSON.stringify({
        document_type: "aadhaar",
        mime_type: "application/pdf",
        file_size: FIXTURES.storage.exceededFileSize,
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("AUTH_FILE_TOO_LARGE");
  });

  it("T1.8.05: Time-bound signed URL generation enforces 10–15 minute expiration window", async () => {
    // 1. Upload valid KYC file
    const uploadRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-File-Mime": "application/pdf",
        "X-File-Size": "2048",
      },
      body: JSON.stringify({
        document_type: "incorporation",
        mime_type: "application/pdf",
        file_size: 2048,
      }),
    });
    expect(uploadRes.status).toBe(201);
    const uploadData = await uploadRes.json();

    // 2. Request signed URL with default expiry (600s = 10 min)
    const signRes = await fetch(`${harness.baseUrl}/api/v1/storage/kyc/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: uploadData.document_id,
        expiry_seconds: 600,
      }),
    });

    expect(signRes.status).toBe(200);
    const signData = await signRes.json();
    expect(signData.signed_url).toBeDefined();
    expect(signData.expires_in_seconds).toBe(600);
    expect(signData.expires_at).toBeDefined();
  });
});
