import { z } from "zod";
import { resolveAliases } from "./infisical.js";

// Every value comes from Infisical (scripts/setup/with-infisical.sh). No defaults, no fallbacks.
const str = z.string().trim().min(1);
const int = z.coerce.number().int().positive();
// An optional key left empty in Infisical counts as not set.
const unsetIfEmpty = <T extends z.ZodTypeAny>(t: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), t.optional());
const list = str.transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean));
// A verification provider setting: "false" (check not required) or providers tried in order (ADR 0004 §4.3).
const providers = <T extends string>(allowed: readonly T[]) =>
  str.transform((v, ctx): T[] => {
    const items = v.toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
    if (items.length === 1 && items[0] === "false") return [];
    const bad = items.filter((x) => !allowed.includes(x as T));
    if (bad.length || !items.length || new Set(items).size !== items.length) {
      ctx.addIssue({ code: "custom", message: `"false" or a comma list of: ${allowed.join(", ")}` });
      return z.NEVER;
    }
    return items as T[];
  });
// PEM in Infisical, either as-is or base64-encoded.
const pem = str.transform((v) => (v.includes("-----BEGIN") ? v : Buffer.from(v, "base64").toString("utf8")).replace(/\\n/g, "\n"));
// "tms=secret,marketplace=secret": the credential each product registers its permission catalog with.
const productKeys = str.transform((v, ctx) => {
  const out: Record<string, string> = {};
  for (const pair of v.split(",").map((x) => x.trim()).filter(Boolean)) {
    const [k, secret] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(k) || ["org", "common"].includes(k) || secret.length < 32) {
      ctx.addIssue({ code: "custom", message: "use product=secret pairs; product lowercase (not org/common), secret >= 32 chars" });
      return z.NEVER;
    }
    out[k] = secret;
  }
  return out;
});

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

  // Track 1 sign-in through Firebase Authentication (Google, phone SMS code).
  FIREBASE_PROJECT_ID: str, // ID token audience
  FIREBASE_AUTH_ISSUER: z.string().url(), // https://securetoken.google.com/<project-id>
  FIREBASE_AUTH_JWKS_URL: z.string().url(), // securetoken@system.gserviceaccount.com JWKS
  // Firebase Phone Number Verification (PNV). Optional as a group: unset = SMS code fallback only.
  FIREBASE_PNV_JWKS_URL: unsetIfEmpty(z.string().url()),
  FIREBASE_PNV_ISSUER: unsetIfEmpty(str),
  FIREBASE_PNV_AUDIENCE: unsetIfEmpty(str),
  // "true": every new account must verify a phone number before it is created.
  MOBILE_OTP_VERIFICATION: z.enum(["true", "false"]).transform((v) => v === "true"),
  SIGNUP_TICKET_TTL_SECONDS: int,

  // ADR 0004 / 0005 — businesses, teams, roles, verification.
  AUTH_ENCRYPTION_KEY: str, // base64 of 32 random bytes: `openssl rand -base64 32`
  AUTH_SIGNING_PRIVATE_KEY: pem, // ES256 (P-256) PKCS#8 PEM for business-session tokens, published at /.well-known/jwks.json
  INVITE_ACCEPT_URL: z.string().url(), // app page that opens invite links: <url>?token=…
  PWNED_PASSWORDS_API_URL: z.string().url(), // https://api.pwnedpasswords.com/range
  CATALOG_PRODUCT_KEYS: productKeys,

  IDENTITY_VERIFICATION_PROVIDER: providers(["aadhaar_offline", "digio", "manual"] as const),
  PAN_VERIFICATION_PROVIDER: providers(["gstin", "cashfree", "digio", "manual"] as const),
  GST_VERIFICATION_PROVIDER: providers(["cleartax", "cashfree", "manual"] as const),
  REGISTRATION_VERIFICATION_PROVIDER: providers(["manual"] as const),
  AUTHORITY_VERIFICATION_PROVIDER: providers(["manual"] as const),
  BANK_VERIFICATION_PROVIDER: z.enum(["false", "cashfree", "digio"]),
  BANK_VERIFICATION_METHODS: unsetIfEmpty(providers(["upi_vpa", "reverse_penny_drop", "pennyless", "penny_drop"] as const)),
  UIDAI_OFFLINE_EKYC_CERT: unsetIfEmpty(pem), // UIDAI's offline e-KYC signing certificate (or public key), PEM
  DIGIO_BASE_URL: unsetIfEmpty(z.string().url()),
  DIGIO_CLIENT_ID: unsetIfEmpty(str),
  DIGIO_CLIENT_SECRET: unsetIfEmpty(str),
  DIGIO_IDENTITY_TEMPLATE: unsetIfEmpty(str),
  DIGIO_PAN_TEMPLATE: unsetIfEmpty(str),
  DIGIO_REVERSE_PENNY_DROP_TEMPLATE: unsetIfEmpty(str),
  DIGIO_PENNY_DROP_TEMPLATE: unsetIfEmpty(str),
  CASHFREE_VERIFICATION_BASE_URL: unsetIfEmpty(z.string().url()), // https://api.cashfree.com/verification
  CASHFREE_VERIFICATION_CLIENT_ID: unsetIfEmpty(str),
  CASHFREE_VERIFICATION_CLIENT_SECRET: unsetIfEmpty(str),
  GST_CLEARTAX_BASE_URL: unsetIfEmpty(z.string().url()),
  GST_CLEARTAX_AUTH_TOKEN: unsetIfEmpty(str),
  GST_CLEARTAX_TAXABLE_ENTITY_ID: unsetIfEmpty(str),
}).superRefine((e, ctx) => {
  const need = (when: boolean, keys: (keyof typeof e)[], why: string) => {
    for (const k of keys) if (when && e[k] === undefined) ctx.addIssue({ code: "custom", path: [k], message: `required when ${why}` });
  };
  const uses = (p: string) => [e.IDENTITY_VERIFICATION_PROVIDER, e.PAN_VERIFICATION_PROVIDER, e.GST_VERIFICATION_PROVIDER]
    .some((list) => (list as string[]).includes(p)) || e.BANK_VERIFICATION_PROVIDER === p;
  if (Buffer.from(e.AUTH_ENCRYPTION_KEY, "base64").length !== 32) {
    ctx.addIssue({ code: "custom", path: ["AUTH_ENCRYPTION_KEY"], message: "must be base64 of exactly 32 bytes (openssl rand -base64 32)" });
  }
  need((e.IDENTITY_VERIFICATION_PROVIDER as string[]).includes("aadhaar_offline"), ["UIDAI_OFFLINE_EKYC_CERT"], "IDENTITY uses aadhaar_offline");
  need(uses("digio"), ["DIGIO_BASE_URL", "DIGIO_CLIENT_ID", "DIGIO_CLIENT_SECRET"], "a provider is digio");
  need((e.IDENTITY_VERIFICATION_PROVIDER as string[]).includes("digio"), ["DIGIO_IDENTITY_TEMPLATE"], "IDENTITY uses digio");
  need((e.PAN_VERIFICATION_PROVIDER as string[]).includes("digio"), ["DIGIO_PAN_TEMPLATE"], "PAN uses digio");
  need(uses("cashfree"), ["CASHFREE_VERIFICATION_BASE_URL", "CASHFREE_VERIFICATION_CLIENT_ID", "CASHFREE_VERIFICATION_CLIENT_SECRET"], "a provider is cashfree");
  need((e.GST_VERIFICATION_PROVIDER as string[]).includes("cleartax"),
    ["GST_CLEARTAX_BASE_URL", "GST_CLEARTAX_AUTH_TOKEN", "GST_CLEARTAX_TAXABLE_ENTITY_ID"], "GST uses cleartax");
  if ((e.PAN_VERIFICATION_PROVIDER as string[]).includes("gstin") && !e.GST_VERIFICATION_PROVIDER.length) {
    ctx.addIssue({ code: "custom", path: ["PAN_VERIFICATION_PROVIDER"], message: "gstin needs GST verification to be on" });
  }
  if (e.BANK_VERIFICATION_PROVIDER !== "false") {
    need(true, ["BANK_VERIFICATION_METHODS"], "BANK_VERIFICATION_PROVIDER is on");
    // Cashfree's account check picks its own rail, so it has no separate penny-less call; Digio runs bank checks as DigiStudio templates.
    const supported = e.BANK_VERIFICATION_PROVIDER === "cashfree"
      ? ["upi_vpa", "reverse_penny_drop", "penny_drop"] : ["reverse_penny_drop", "penny_drop"];
    for (const m of e.BANK_VERIFICATION_METHODS ?? []) {
      if (!supported.includes(m)) {
        ctx.addIssue({ code: "custom", path: ["BANK_VERIFICATION_METHODS"], message: `${m} is not available with ${e.BANK_VERIFICATION_PROVIDER}` });
      }
    }
    if (e.BANK_VERIFICATION_PROVIDER === "digio") {
      need((e.BANK_VERIFICATION_METHODS ?? []).includes("reverse_penny_drop"), ["DIGIO_REVERSE_PENNY_DROP_TEMPLATE"], "digio does reverse_penny_drop");
      need((e.BANK_VERIFICATION_METHODS ?? []).includes("penny_drop"), ["DIGIO_PENNY_DROP_TEMPLATE"], "digio does penny_drop");
    }
  }
}).refine(
  (e) => [e.FIREBASE_PNV_JWKS_URL, e.FIREBASE_PNV_ISSUER, e.FIREBASE_PNV_AUDIENCE].every((v) => v === undefined) ||
    [e.FIREBASE_PNV_JWKS_URL, e.FIREBASE_PNV_ISSUER, e.FIREBASE_PNV_AUDIENCE].every((v) => v !== undefined),
  { message: "Set all of FIREBASE_PNV_JWKS_URL, FIREBASE_PNV_ISSUER, FIREBASE_PNV_AUDIENCE, or none", path: ["FIREBASE_PNV_JWKS_URL"] },
);

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
