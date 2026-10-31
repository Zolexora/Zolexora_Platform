import { z } from "zod";
import { resolveAliases } from "./infisical.js";

// Secrets have no defaults: they must come from Infisical. Fixed dev values exist only for NODE_ENV=test.
const IS_TEST = process.env.NODE_ENV === "test";
const secret = (testValue: string, min = 1) =>
  IS_TEST ? z.string().min(min).default(testValue) : z.string().min(min);


const envSchema = z.object({
  PORT: z.coerce.number().default(3081),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BASE_URL: z.string().default("http://localhost:3081"),
  CORS_ORIGIN: z.string().default("*"),

  // Databases
  AUTH_DATABASE_URL: secret("postgresql://postgres:postgres@localhost:5432/zolexora_auth"),
  ADMIN_DATABASE_URL: secret("postgresql://postgres:postgres@localhost:5440/platform_admin"),
  DATABASE_URL: z.string().optional(),

  // Session & Cryptography
  SESSION_SECRET: secret("zolexora-platform-auth-secret-key-32bytes-min", 16),

  // Cloudflare Turnstile
  // Cloudflare's always-pass test key, allowed only under NODE_ENV=test.
  TURNSTILE_SECRET_KEY: secret("1x0000000000000000000000000000000AA"),
  TURNSTILE_VERIFY_URL: z
    .string()
    .url()
    .default("https://challenges.cloudflare.com/turnstile/v0/siteverify"),
  TURNSTILE_TIMEOUT_MS: z.coerce.number().default(5000),
  TURNSTILE_EXPECTED_HOSTNAMES: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().default(5),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().default(900),

  // Storage & Media
  CLOUDINARY_CLOUD_NAME: z.string().default("zolexora"),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  KYC_STORAGE_ENDPOINT: z.string().default("https://storage.zolexora.com"),
  KYC_SIGNED_URL_DEFAULT_TTL: z.coerce.number().default(900),

  // Firebase Admin Credentials
  FIREBASE_PROJECT_ID: z.string().default("zolexora-auth"),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Email & Resend
  RESEND_API_KEY: z.string().optional(),
  AUTH_FROM_EMAIL: z.string().default("Zolexora <auth@zolexora.com>"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(): EnvConfig {
  resolveAliases();
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`[CONFIG_FATAL] Invalid environment configuration:\n${errorDetails}`);
  }
  return result.data;
}

// At import time secrets may not be synced yet (main() syncs, then calls refreshEnv(), which validates strictly).
function initialEnv(): EnvConfig {
  try {
    return loadEnv();
  } catch (err) {
    if (IS_TEST) throw err;
    return envSchema.partial().parse(process.env) as EnvConfig;
  }
}

export let env: EnvConfig = initialEnv();

export function refreshEnv(): EnvConfig {
  env = loadEnv();
  return env;
}
