import { z } from "zod";

/**
 * Runtime environment configuration for Zolexora Orbit API.
 * All secrets come from Infisical via scripts/setup/with-infisical.sh.
 * No .env files; no defaults for secrets.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  PORT: z.coerce.number().default(4082),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // ── Database ─────────────────────────────────────────────────────
  ORBIT_DATABASE_URL: z.string().url(),

  // ── Auth Service integration ──────────────────────────────────────
  AUTH_SERVICE_URL: z.string().url(),
  /** Product identifier used to request a business session scope */
  ORBIT_PRODUCT_ID: z.string().default("orbit"),
  /**
   * Shared secret used by Orbit to register its permission catalog with
   * the Auth Service via PUT /api/v1/catalog/:product.
   * Must match the ORBIT_PRODUCT_KEY stored in the Auth Service's Infisical path.
   */
  ORBIT_PRODUCT_KEY: z.string(),

  // ── CORS ──────────────────────────────────────────────────────────
  /** Comma-separated list of allowed origins */
  CORS_ORIGINS: z
    .string()
    .default(
      "http://localhost:3082,http://localhost:3083,http://localhost:3084",
    ),

  // ── Feature flags ─────────────────────────────────────────────────
  SWAGGER_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
});

function parseEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "❌ Invalid environment configuration:\n",
      result.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = z.infer<typeof schema>;
