import { readFileSync } from "node:fs";

// Business rules only. Runtime configuration lives in env.ts and comes from Infisical.
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

export const CONSTANTS = {
  SERVICE_NAME: "zolexora-auth-service",
  SERVICE_VERSION: pkg.version as string,

  PRODUCTS: {
    CONSUMER: ["clarityfi", "marketplace", "maunkavach"],
    ENTERPRISE: ["zolexora-tms", "zolexora-ims", "zolexora-erp"],
  },

  STORAGE: {
    ALLOWED_MIMES: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    SIGNED_URL_MIN_TTL: 600,
    SIGNED_URL_MAX_TTL: 900,
  },

  TOKEN: {
    CLOCK_SKEW_TOLERANCE_SECONDS: 300,
  },

  // Business sessions (ADR 0005 §6.6): short access token, rotating refresh token.
  BUSINESS: {
    ACCESS_TTL_SECONDS: 900,
    REFRESH_TTL_SECONDS: 30 * 24 * 3600,
    TICKET_TTL_SECONDS: 300, // business picker and MFA step
    INVITE_TTL_SECONDS: 7 * 24 * 3600,
  },

  // A Firebase ID / PNV token must have been issued within this window to be exchanged.
  FIREBASE: {
    MAX_TOKEN_AGE_SECONDS: 300,
  },
} as const;
