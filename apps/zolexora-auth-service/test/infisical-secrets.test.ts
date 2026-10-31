import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  syncSecretsFromInfisical,
  getSecretsDiagnostics,
  getSecret,
  resolveAliases,
  SECRET_ALIASES,
} from "../src/config/infisical.js";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository } from "../src/repositories/in-memory-auth.repository.js";

describe("Infisical Dynamic Secrets Sync & Structured Fallback Diagnostics", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("1. syncSecretsFromInfisical() produces valid structured diagnostics in fallback mode", async () => {
    const diag = await syncSecretsFromInfisical({ forceFallback: true });

    expect(diag).toBeDefined();
    expect(diag.status).toBe("environment_fallback");
    expect(diag.provider).toBe("process_environment");
    expect(diag.workspaceId).toBe("188824cd-59ce-468f-b60f-f2da7aeefe63");
    expect(diag.secretsPath).toBe("/");
    expect(Array.isArray(diag.diagnostics)).toBe(true);
    expect(diag.diagnostics.length).toBeGreaterThan(0);
    expect(diag.timestamp).toBeDefined();
    expect(diag.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("2. resolveAliases() maps Zolexora_Auth vault aliases to canonical auth-service keys", () => {
    delete process.env.AUTH_DATABASE_URL;
    process.env.ZOLEXORA_AUTHENTICATION_DATABASE_URL = "postgresql://zolexora_test_user:pass@remote:5432/zolexora_auth";

    delete process.env.FIREBASE_PROJECT_ID;
    process.env.ZOLEXORA_FIREBASE_PROJECT_ID = "zolexora-auth-cloud";

    delete process.env.SESSION_SECRET;
    process.env.ZOLEXORA_AUTHENTICATION_SECRET_KEY = "super-secret-vault-jwt-key-32chars";

    resolveAliases();

    expect(process.env.AUTH_DATABASE_URL).toBe("postgresql://zolexora_test_user:pass@remote:5432/zolexora_auth");
    expect(process.env.FIREBASE_PROJECT_ID).toBe("zolexora-auth-cloud");
    expect(process.env.SESSION_SECRET).toBe("super-secret-vault-jwt-key-32chars");
  });

  it("3. getSecret() correctly resolves canonical key and alias fallback", () => {
    delete process.env.RESEND_API_KEY;
    process.env.ZOLEXORA_PRODUCTION_RESEND_API_KEY = "re_test_live_key_99999";

    const secret = getSecret("RESEND_API_KEY");
    expect(secret).toBe("re_test_live_key_99999");

    const defaultVal = getSecret("NON_EXISTENT_KEY", "fallback_default");
    expect(defaultVal).toBe("fallback_default");
  });

  it("4. GET /api/v1/health/secrets returns HTTP 200 with diagnostics schema", async () => {
    const repo = new InMemoryAuthRepository();
    const app = await buildApp({ repo, logger: false });
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health/secrets",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBeDefined();
    expect(body.provider).toBeDefined();
    expect(body.workspaceId).toBe("188824cd-59ce-468f-b60f-f2da7aeefe63");
    expect(Array.isArray(body.diagnostics)).toBe(true);

    await app.close();
  });

  it("5. GET /api/v1/health includes secrets sync status summary", async () => {
    const repo = new InMemoryAuthRepository();
    const app = await buildApp({ repo, logger: false });
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.secrets).toBeDefined();
    expect(body.secrets.status).toBeDefined();
    expect(body.secrets.provider).toBeDefined();

    await app.close();
  });
});
