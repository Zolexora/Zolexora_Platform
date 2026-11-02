import { describe, it, expect, afterEach } from "vitest";
import { resolveAliases } from "../src/config/infisical.js";
import { loadEnv } from "../src/config/env.js";

describe("Infisical-only configuration", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("1. resolveAliases() maps Infisical key names onto canonical keys without overriding explicit values", () => {
    delete process.env.AUTH_DATABASE_URL;
    process.env.ZOLEXORA_AUTHENTICATION_DATABASE_URL = "postgresql://alias/auth";
    process.env.RESEND_API_KEY = "explicit";
    process.env.ZOLEXORA_PRODUCTION_RESEND_API_KEY = "alias";
    resolveAliases();
    expect(process.env.AUTH_DATABASE_URL).toBe("postgresql://alias/auth");
    expect(process.env.RESEND_API_KEY).toBe("explicit");
  });

  it("2. SESSION_SECRET is never derived from another credential (no alias)", () => {
    delete process.env.SESSION_SECRET;
    process.env.ZOLEXORA_AUTHENTICATION_SECRET_KEY = "x".repeat(64);
    resolveAliases();
    expect(process.env.SESSION_SECRET).toBeUndefined();
  });

  it("3. loadEnv() fails fast listing missing keys — no defaults exist", () => {
    for (const key of ["SESSION_SECRET", "PORT", "TURNSTILE_SECRET_KEY", "CLOUDINARY_CLOUD_NAME", "BASE_URL"]) {
      delete process.env[key];
    }
    expect(() => loadEnv()).toThrow(/SESSION_SECRET[\s\S]*PORT|PORT[\s\S]*SESSION_SECRET/);
    expect(() => loadEnv()).toThrow(/TURNSTILE_SECRET_KEY/);
    expect(() => loadEnv()).toThrow(/CLOUDINARY_CLOUD_NAME/);
  });

  it("4. Error output contains key names only, never secret values", () => {
    process.env.SESSION_SECRET = "too-short-secret-value";
    let message = "";
    try {
      loadEnv();
    } catch (err: any) {
      message = err.message;
    }
    expect(message).toContain("SESSION_SECRET");
    expect(message).not.toContain("too-short-secret-value");
  });

  it("5. Wildcard CORS is rejected because credentials are enabled", () => {
    process.env.CORS_ORIGIN = "*";
    expect(() => loadEnv()).toThrow(/CORS_ORIGIN/);
    process.env.CORS_ORIGIN = "https://a.example, https://b.example";
    expect(loadEnv().CORS_ORIGIN).toEqual(["https://a.example", "https://b.example"]);
  });
});
