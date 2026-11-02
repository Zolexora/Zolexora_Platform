import { z } from "zod";
import { resolveAliases } from "./infisical.js";

// Every value comes from Infisical (scripts/setup/with-infisical.sh). No defaults, no fallbacks.
const str = z.string().trim().min(1);
const int = z.coerce.number().int().positive();
const list = str.transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: int,
  HOST: str,
  BASE_URL: z.string().url(),
  // Comma-separated allow-list; "*" is rejected because credentials are enabled.
  CORS_ORIGIN: list.refine((o) => !o.includes("*"), "CORS_ORIGIN must list explicit origins, not *"),
  // Fastify trustProxy: "false", "true" (trust every hop — only behind a proxy that overwrites X-Forwarded-For),
  // or a comma-separated list of proxy IPs/CIDRs (recommended).
  TRUST_PROXY: str.transform((v): boolean | string[] =>
    v === "true" ? true : v === "false" ? false : v.split(",").map((s) => s.trim()),
  ),

  AUTH_DATABASE_URL: str,
  ADMIN_DATABASE_URL: str,

  SESSION_SECRET: z.string().min(32),
  TOKEN_TTL_SECONDS: int,

  TURNSTILE_SECRET_KEY: str,
  TURNSTILE_VERIFY_URL: z.string().url(),
  TURNSTILE_TIMEOUT_MS: int,
  TURNSTILE_EXPECTED_HOSTNAMES: list,

  RATE_LIMIT_MAX_ATTEMPTS: int,
  RATE_LIMIT_WINDOW_SECONDS: int,
  RATE_LIMIT_LOCKOUT_SECONDS: int,

  OTP_TTL_SECONDS: int,
  OTP_MAX_ATTEMPTS: int,

  CLOUDINARY_CLOUD_NAME: str,
  CLOUDINARY_API_KEY: str,
  CLOUDINARY_API_SECRET: str,
  // KYC documents: any S3-compatible private bucket (Supabase Storage, Cloudflare R2, AWS S3, MinIO…).
  // Switching provider = changing these values in Infisical; no code change.
  KYC_STORAGE_S3_ENDPOINT: z.string().url(), // path-style base URL, e.g. https://<ref>.supabase.co/storage/v1/s3
  KYC_STORAGE_S3_REGION: str,
  KYC_STORAGE_BUCKET: str,
  KYC_STORAGE_ACCESS_KEY_ID: str,
  KYC_STORAGE_SECRET_ACCESS_KEY: str,
  KYC_SIGNED_URL_DEFAULT_TTL: int,

  RESEND_API_KEY: str,
  RESEND_API_URL: z.string().url(),
  AUTH_FROM_EMAIL: str,
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(): EnvConfig {
  resolveAliases();
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `[CONFIG_FATAL] Invalid or missing Infisical configuration (start via scripts/setup/with-infisical.sh):\n${missing}`,
    );
  }
  return result.data;
}

export const env: EnvConfig = loadEnv();
