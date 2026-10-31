import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository } from "../src/repositories/in-memory-auth.repository.js";
import { CONSTANTS } from "../src/config/constants.js";

describe("apps/zolexora-auth-service integration tests", () => {
  let app: FastifyInstance;
  let repo: InMemoryAuthRepository;

  beforeAll(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildApp({ repo, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health returns ok", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe(CONSTANTS.SERVICE_NAME);
    expect(body.version).toBe(CONSTANTS.SERVICE_VERSION);
  });

  it("GET /openapi.json returns OpenAPI 3.1 specification", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/openapi.json",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toContain("Zolexora");
  });

  it("GET /docs returns swagger documentation", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/docs",
      headers: { accept: "application/json" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBe("3.1.0");
  });

  it("POST /api/v1/auth/public/signup with missing turnstile token returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/public/signup",
      payload: {
        email: "test@example.com",
        phoneNumber: "+919876543210",
        password: "CorporateSecurePass123!",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("AUTH_TURNSTILE_REQUIRED");
    expect(body.error.code).toBe("AUTH_TURNSTILE_REQUIRED");
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/auth/public/signup with short password returns 400 AUTH_PASSWORD_POLICY_VIOLATION", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/public/signup",
      payload: {
        email: "test@example.com",
        phoneNumber: "+919876543210",
        password: "Short1!",
        turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("AUTH_PASSWORD_POLICY_VIOLATION");
  });

  it("POST /api/v1/auth/employee/login with invalid org format returns 400 AUTH_INVALID_ORG_ID_FORMAT", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/employee/login",
      payload: {
        org_id: "INVALID-ORG",
        user_id_or_email: "dispatcher@zolexora.com",
        password: "CorporateSecurePass123!",
        turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("AUTH_INVALID_ORG_ID_FORMAT");
  });

  it("POST /api/v1/auth/employee/create with webmail returns 400 AUTH_WEBMAIL_DOMAIN_FORBIDDEN", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/employee/create",
      payload: {
        org_id: "ZX-ORG-4B8T-9M2K-7Y4X",
        email: "dispatcher@gmail.com",
        password: "CorporateSecurePass123!",
        turnstile_token: CONSTANTS.TURNSTILE.VALID_TOKEN,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
  });

  it("POST /api/v1/auth/admin/signup returns 403 AUTH_ADMIN_SIGNUP_FORBIDDEN", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/admin/signup",
      payload: {
        email: "superadmin@evil.com",
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe("AUTH_ADMIN_SIGNUP_FORBIDDEN");
  });

  it("Storage endpoints work as specified", async () => {
    const avatarRes = await app.inject({
      method: "POST",
      url: "/api/v1/storage/avatars/upload",
      headers: { "x-zolexora-id": "ZX-8K9M-4P2W-7Y3X" },
      payload: {},
    });
    expect(avatarRes.statusCode).toBe(200);
    expect(avatarRes.json().url).toContain("f_auto,q_auto");

    const logoRes = await app.inject({
      method: "POST",
      url: "/api/v1/storage/logos/upload",
      headers: { "x-organisation-id": "ZX-ORG-4B8T-9M2K-7Y4X" },
      payload: {},
    });
    expect(logoRes.statusCode).toBe(200);
    expect(logoRes.json().url).toContain("f_auto,q_auto");

    const kycRes = await app.inject({
      method: "POST",
      url: "/api/v1/storage/kyc/upload",
      headers: {
        "x-file-mime": "application/pdf",
        "x-file-size": "1000",
      },
      payload: {},
    });
    expect(kycRes.statusCode).toBe(201);
    const kycData = kycRes.json();
    expect(kycData.document_id).toBeDefined();

    const signedRes = await app.inject({
      method: "POST",
      url: "/api/v1/storage/kyc/signed-url",
      payload: {
        document_id: kycData.document_id,
        expiry_seconds: 600,
      },
    });
    expect(signedRes.statusCode).toBe(200);
    expect(signedRes.json().signed_url).toContain("expires=");
  });
});
