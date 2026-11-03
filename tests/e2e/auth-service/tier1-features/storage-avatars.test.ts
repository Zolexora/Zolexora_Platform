import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TestHarness } from "../helpers/http-client";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 1: Feature 8B — Cloudinary Public Avatars & Org Logos E2E", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.getInstance();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(() => harness.resetState());

  it("T1.8B.01: Public avatar upload delivers f_auto,q_auto optimized URL at users/avatars/{zx_id}", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harness.userAuth(),
        "X-Zolexora-ID": FIXTURES.ids.validUser,
      },
      body: JSON.stringify({ file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("f_auto,q_auto");
    expect(data.public_id).toBe(`users/avatars/${FIXTURES.ids.validUser}`);
  });

  it("T1.8B.02: Public avatar upload rejects malformed Crockford user ID with HTTP 400", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harness.userAuth(),
        "X-Zolexora-ID": "ZX-INVALID-1234",
      },
      body: JSON.stringify({ file: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("AUTH_INVALID_ID_FORMAT");
  });

  it("T1.8B.03: Public avatar upload rejects forbidden MIME (application/pdf) with HTTP 415", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harness.userAuth(),
        "X-Zolexora-ID": FIXTURES.ids.validUser,
        "X-File-Mime": "application/pdf",
      },
      body: JSON.stringify({ file: "data:application/pdf;base64,JVBERi0xLjQK" }),
    });

    expect(res.status).toBe(415);
    const data = await res.json();
    expect(data.code).toBe("AUTH_INVALID_MIME_TYPE");
  });

  it("T1.8B.04: Public avatar upload rejects oversized payload (>10MB) with HTTP 400", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/avatars/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harness.userAuth(),
        "X-Zolexora-ID": FIXTURES.ids.validUser,
        "X-File-Mime": "image/jpeg",
        "X-File-Size": String(10 * 1024 * 1024 + 1),
      },
      body: JSON.stringify({ file_size: 10 * 1024 * 1024 + 1 }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("AUTH_FILE_TOO_LARGE");
  });

  it("T1.8B.05: Organization logo upload delivers f_auto,q_auto optimized URL at orgs/logos/{org_id}", async () => {
    const res = await fetch(`${harness.baseUrl}/api/v1/storage/logos/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harness.orgAdminAuth(),
        "X-Organisation-ID": FIXTURES.ids.validOrg,
      },
      body: JSON.stringify({ file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("f_auto,q_auto");
    expect(data.public_id).toBe(`orgs/logos/${FIXTURES.ids.validOrg}`);
  });
});
