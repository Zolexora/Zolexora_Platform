export const CONSTANTS = {
  SERVICE_NAME: "zolexora-auth-service",
  SERVICE_VERSION: "2.0.0",
  DEFAULT_PORT: 3081,
  DEFAULT_HOST: "0.0.0.0",
  
  PRODUCTS: {
    CONSUMER: ["clarityfi", "marketplace", "maunkavach"],
    ENTERPRISE: ["zolexora-tms", "zolexora-ims", "zolexora-erp"],
  },
  
  STORAGE: {
    ALLOWED_MIMES: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB exact (10,485,760 bytes)
    SIGNED_URL_MIN_TTL: 600, // 10 minutes
    SIGNED_URL_MAX_TTL: 900, // 15 minutes
    SIGNED_URL_DEFAULT_TTL: 900, // 15 minutes default
  },
  
  TURNSTILE: {
    VALID_TOKEN: "0.valid-cf-turnstile-token",
    TIMEOUT_DUPLICATE_TOKEN: "0.timeout-or-duplicate-token",
    INVALID_TOKEN: "0.invalid-cf-turnstile-token",
  },
  
  RATE_LIMIT: {
    MAX_FAILURES: 5,
    LOCKOUT_SECONDS: 900, // 15 minutes
    WINDOW_MS: 15 * 60 * 1000,
  },
  
  PASSWORD: {
    MIN_LENGTH: 12,
    MAX_BYTES: 1024,
  },
  
  OTP: {
    DEFAULT_DEV_OTP: "123456",
    TEST_DEV_OTP: "000000",
    TTL_SECONDS: 600,
  },

  TOKEN: {
    CLOCK_SKEW_TOLERANCE_SECONDS: 300, // 5 minutes maximum allowed future clock skew
  },
} as const;
