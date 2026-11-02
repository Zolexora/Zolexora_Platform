// Test-only configuration. Production values come exclusively from Infisical.
import { beforeEach, vi } from "vitest";

Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "3081",
  HOST: "127.0.0.1",
  BASE_URL: "http://localhost:3081",
  CORS_ORIGIN: "http://localhost:3000",
  TRUST_PROXY: "true",
  AUTH_DATABASE_URL: "postgresql://unused-in-tests/auth",
  ADMIN_DATABASE_URL: "postgresql://unused-in-tests/admin",
  SESSION_SECRET: "test-session-secret-0123456789abcdef0123456789",
  STORAGE_SIGNING_SECRET: "test-storage-secret-0123456789abcdef012345678",
  TOKEN_TTL_SECONDS: "3600",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  TURNSTILE_VERIFY_URL: "https://turnstile.test/siteverify",
  TURNSTILE_TIMEOUT_MS: "5000",
  TURNSTILE_EXPECTED_HOSTNAMES: "localhost",
  RATE_LIMIT_MAX_ATTEMPTS: "5",
  RATE_LIMIT_WINDOW_SECONDS: "900",
  RATE_LIMIT_LOCKOUT_SECONDS: "900",
  OTP_TTL_SECONDS: "600",
  OTP_MAX_ATTEMPTS: "5",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-cloudinary-key",
  CLOUDINARY_API_SECRET: "test-cloudinary-secret",
  KYC_STORAGE_ENDPOINT: "https://storage.test",
  KYC_SIGNED_URL_DEFAULT_TTL: "900",
  RESEND_API_KEY: "test-resend-key",
  RESEND_API_URL: "https://mail.test/emails",
  AUTH_FROM_EMAIL: "Zolexora Test <auth@zolexora.test>",
});

/** Fake Cloudinary upload API; echoes a deterministic secure_url. */
async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("https://api.cloudinary.com/")) {
    const form = init?.body as FormData;
    const publicId = String(form.get("public_id"));
    const file = form.get("file") as Blob;
    const format = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    return Response.json({
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/${publicId}.${format}`,
      public_id: publicId,
      bytes: file.size,
      format,
      version: 1,
    });
  }
  throw new Error(`Unexpected network call in tests: ${url}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});
