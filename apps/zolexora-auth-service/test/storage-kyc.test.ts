import { buildTestApp, testTokens, verifyPresignedUrl } from "./helpers/fakes.js";
import { fakeS3Objects } from "./setup.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { TokenService } from "../src/services/token.service.js";
import { InMemoryAuthRepository } from "./helpers/in-memory-auth.repository.js";
import { env } from "../src/config/env.js";

describe("Milestone 4: Storage KYC Unit Tests (Upload, MIME, RBAC, Signed URLs)", () => {
  let app: FastifyInstance;
  let repo: InMemoryAuthRepository;
  let tokenService: TokenService;

  const docOwnerId = "ZX-8K9M-4P2W-7Y3X";
  const otherUserId = "ZX-3R7V-9Q1B-5M8K";
  const docOrgId = "ZX-ORG-4B8T-9M2K-7Y4X";
  const otherOrgId = "ZX-ORG-9L2K-5V8P-3W7X";

  let ownerToken: string;
  let otherUserToken: string;
  let orgAdminToken: string;
  let orgOwnerToken: string;
  let orgMemberToken: string;
  let otherOrgAdminToken: string;
  let superadminToken: string;

  beforeAll(async () => {
    repo = new InMemoryAuthRepository();
    tokenService = testTokens();

    ownerToken = tokenService.signJwt({
      uid: docOwnerId,
      zolexora_id: docOwnerId,
      role: "user",
      permissions: ["kyc:read"],
    });

    otherUserToken = tokenService.signJwt({
      uid: otherUserId,
      zolexora_id: otherUserId,
      role: "user",
      permissions: ["kyc:read"],
    });

    orgAdminToken = tokenService.signJwt({
      uid: "emp_admin_1",
      zolexora_id: "ZX-ADMIN-DOCS-1",
      org_id: docOrgId,
      role: "admin",
      permissions: ["kyc:manage"],
    });

    orgOwnerToken = tokenService.signJwt({
      uid: "emp_owner_1",
      zolexora_id: "ZX-OWNER-DOCS-1",
      org_id: docOrgId,
      role: "owner",
      permissions: ["kyc:manage"],
    });

    orgMemberToken = tokenService.signJwt({
      uid: "emp_member_1",
      zolexora_id: "ZX-MEMBER-DOCS-1",
      org_id: docOrgId,
      role: "member",
      permissions: ["trips:read"],
    });

    otherOrgAdminToken = tokenService.signJwt({
      uid: "emp_other_admin_1",
      zolexora_id: "ZX-OTHER-ADMIN-1",
      org_id: otherOrgId,
      role: "admin",
      permissions: ["kyc:manage"],
    });

    superadminToken = tokenService.signJwt({
      uid: "superadmin_1",
      zolexora_id: "ZX-SUPERADMIN-1",
      role: "superadmin",
      is_platform_admin: true,
      permissions: ["*"],
    });

    app = await buildTestApp(repo);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. Private KYC Document Upload Tests
  // ---------------------------------------------------------------------------
  describe("KYC Document Upload (POST /api/v1/storage/kyc/upload)", () => {
    it("KYC-01: Successfully uploads PDF with magic bytes and generates canonical storage key kyc/{org_id}/{user_id}/{doc_id}.pdf", async () => {
      // PDF header: %PDF-1.4
      const pdfBase64 = Buffer.from("%PDF-1.4\n%test pdf content").toString("base64");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": docOwnerId,
          "x-organisation-id": docOrgId,
          "content-type": "application/json",
        },
        payload: {
          document_type: "passport",
          file: `data:application/pdf;base64,${pdfBase64}`,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.document_id).toBeDefined();
      expect(data.mime_type).toBe("application/pdf");
      expect(data.storage_key).toBe(`kyc/${docOrgId}/${docOwnerId}/${data.document_id}.pdf`);

      // Verify persistence in repository
      const persisted = await repo.getKycDocument(data.document_id);
      expect(persisted).not.toBeNull();
      expect(persisted?.storage_key).toBe(data.storage_key);
      expect(persisted?.user_id).toBe(docOwnerId);
      expect(persisted?.org_id).toBe(docOrgId);
    });

    it("KYC-02: Successfully uploads PNG with magic bytes and generates canonical storage key .png", async () => {
      // PNG magic bytes: \x89PNG\r\n\x1a\n
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": docOwnerId,
          "x-organisation-id": docOrgId,
          "content-type": "application/json",
        },
        payload: {
          document_type: "driving_license",
          file: `data:image/png;base64,${pngBuffer.toString("base64")}`,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.mime_type).toBe("image/png");
      expect(data.storage_key).toBe(`kyc/${docOrgId}/${docOwnerId}/${data.document_id}.png`);
    });

    it("KYC-03: Rejects unwhitelisted MIME type (text/plain) with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          "x-file-mime": "text/plain",
          "x-file-size": "500",
          "content-type": "application/json",
        },
        payload: {
          document_type: "incorporation",
          mime_type: "text/plain",
          file_size: 500,
        },
      });

      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe("AUTH_INVALID_MIME_TYPE");
    });

    it("KYC-04: Rejects content spoofing attack (magic bytes mismatch) with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      // Client claims Content-Type: application/pdf but body is PNG bytes
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          "content-type": "application/json",
        },
        payload: {
          document_type: "id_document",
          file: `data:application/pdf;base64,${pngBuffer.toString("base64")}`,
        },
      });

      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe("AUTH_INVALID_MIME_TYPE");
    });

    it("KYC-05: Rejects file exceeding 10MB bounds with HTTP 400 AUTH_FILE_TOO_LARGE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          "x-file-mime": "application/pdf",
          "x-file-size": String(10 * 1024 * 1024 + 1),
          "content-type": "application/json",
        },
        payload: {
          document_type: "gst",
          mime_type: "application/pdf",
          file_size: 10 * 1024 * 1024 + 1,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("AUTH_FILE_TOO_LARGE");
    });

    it("KYC-06: Rejects KYC upload when no auth token provided and x-require-auth is true with HTTP 401 AUTH_UNAUTHORIZED", async () => {
      const pdfBase64 = Buffer.from("%PDF-1.4\n%confidential passport doc").toString("base64");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          "x-require-auth": "true",
          "content-type": "application/json",
        },
        payload: {
          document_type: "passport",
          file: `data:application/pdf;base64,${pdfBase64}`,
        },
      });

      expect(res.statusCode).toBe(401);
      const data = res.json();
      expect(data.code).toBe("AUTH_UNAUTHORIZED");
      expect(data.message).toBe("Missing token");
    });

    it("KYC-07: Rejects KYC upload with forged or invalid auth token with HTTP 401 AUTH_UNAUTHORIZED", async () => {
      const pdfBase64 = Buffer.from("%PDF-1.4\n%confidential passport doc").toString("base64");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          authorization: "Bearer invalid.forged.token",
          "content-type": "application/json",
        },
        payload: {
          document_type: "passport",
          file: `data:application/pdf;base64,${pdfBase64}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("AUTH_UNAUTHORIZED");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Signed URL Expiry Window & RBAC Tests
  // ---------------------------------------------------------------------------
  describe("Time-Bound Signed URLs with 3-Tier RBAC (POST /api/v1/storage/kyc/signed-url)", () => {
    let testDocId: string;

    beforeAll(async () => {
      const pdfBase64 = Buffer.from("%PDF-1.4\n%confidential passport doc").toString("base64");
      const uploadRes = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": docOwnerId,
          "x-organisation-id": docOrgId,
          "content-type": "application/json",
        },
        payload: {
          document_type: "passport",
          file: `data:application/pdf;base64,${pdfBase64}`,
        },
      });

      testDocId = uploadRes.json().document_id;
    });

    it("URL-01: Document owner can generate signed URL with boundary 600s (10 min)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 600,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.signed_url.startsWith(`${env.KYC_STORAGE_S3_ENDPOINT}/${env.KYC_STORAGE_BUCKET}/kyc/`)).toBe(true);
      expect(data.signed_url).toContain("X-Amz-Expires=600");
      expect(data.signed_url).toContain("X-Amz-Signature=");
      expect(data.expires_in_seconds).toBe(600);
      expect(new Date(data.expires_at).getTime()).toBeGreaterThan(Date.now());

      // Verify the SigV4 presigned signature
      expect(await verifyPresignedUrl(data.signed_url)).toBe(true);
    });

    it("URL-02: Document owner can generate signed URL with boundary 900s (15 min)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 900,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.expires_in_seconds).toBe(900);
      expect(await verifyPresignedUrl(data.signed_url)).toBe(true);
    });

    it("URL-03: Defaults to 900 seconds (15 min) when expiry_seconds is omitted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.expires_in_seconds).toBe(900);
      expect(await verifyPresignedUrl(data.signed_url)).toBe(true);
    });

    it("URL-04: Rejects expiry below 600s with HTTP 400 AUTH_INVALID_EXPIRY_WINDOW", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 599,
        },
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_EXPIRY_WINDOW");
    });

    it("URL-05: Rejects expiry above 900s with HTTP 400 AUTH_INVALID_EXPIRY_WINDOW", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 901,
        },
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_EXPIRY_WINDOW");
    });

    it("URL-06: Organization Admin can generate signed URL for document in their organization", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${orgAdminToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 750,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.expires_in_seconds).toBe(750);
      expect(await verifyPresignedUrl(data.signed_url)).toBe(true);
    });

    it("URL-07: Organization Owner can generate signed URL for document in their organization", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${orgOwnerToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 800,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.expires_in_seconds).toBe(800);
    });

    it("URL-08: Platform Superadmin can generate signed URL for any document", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 900,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.expires_in_seconds).toBe(900);
    });

    it("URL-09: Rejects non-admin employee in the same organization with HTTP 403 AUTH_FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${orgMemberToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 900,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("AUTH_FORBIDDEN");
    });

    it("URL-10: Rejects admin of a different organization with HTTP 403 AUTH_FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${otherOrgAdminToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 900,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("AUTH_FORBIDDEN");
    });

    it("URL-11: Rejects unrelated consumer user with HTTP 403 AUTH_FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${otherUserToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 900,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("AUTH_FORBIDDEN");
    });

    it("URL-12: Tampering with signed URL parameter (expires or docId) invalidates signature", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/signed-url",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        payload: {
          document_id: testDocId,
          expiry_seconds: 900,
        },
      });

      const { signed_url } = res.json();
      expect(await verifyPresignedUrl(signed_url)).toBe(true);

      // Tamper with the expiry window
      const tamperedExpires = signed_url.replace(/X-Amz-Expires=\d+/, "X-Amz-Expires=604800");
      expect(await verifyPresignedUrl(tamperedExpires)).toBe(false);

      // Tamper with the object key (another user's document)
      const tamperedKey = signed_url.replace(/\/kyc\/[^/]+\/[^/]+\//, "/kyc/ZX-ORG-AAAA-BBBB-CCCC/ZX-AAAA-BBBB-CCCC/");
      expect(await verifyPresignedUrl(tamperedKey)).toBe(false);
    });
  });
});
