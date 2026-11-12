// Secrets are injected by `infisical run` (scripts/setup/with-infisical.sh) — the only entry point.
// This module only maps the Infisical key names onto the names the service reads.
export const SECRET_ALIASES: Record<string, string[]> = {
  AUTH_DATABASE_URL: ["ZOLEXORA_AUTHENTICATION_DATABASE_URL"],
  ADMIN_DATABASE_URL: ["ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL", "ZOLEXORA_ADMIN_DATABASE_URL"],
  TURNSTILE_SECRET_KEY: ["CF_TURNSTILE_SECRET_KEY", "CLOUDFLARE_TURNSTILE_SECRET_KEY"],
  CLOUDINARY_CLOUD_NAME: ["ZOLEXORA_CLOUDINARY_CLOUD_NAME"],
  CLOUDINARY_API_KEY: ["ZOLEXORA_CLOUDINARY_API_KEY"],
  CLOUDINARY_API_SECRET: ["ZOLEXORA_CLOUDINARY_API_SECRET"],
  RESEND_API_KEY: ["ZOLEXORA_PRODUCTION_RESEND_API_KEY", "ZOLEXORA_RESEND_API_KEY"],
  AUTH_FROM_EMAIL: ["ZOLEXORA_AUTH_FROM_EMAIL"],
  FIREBASE_PROJECT_ID: ["ZOLEXORA_FIREBASE_PROJECT_ID"],
};

export function resolveAliases(): void {
  for (const [key, aliases] of Object.entries(SECRET_ALIASES)) {
    if (process.env[key]?.trim()) continue;
    const alias = aliases.find((a) => process.env[a]?.trim());
    if (alias) process.env[key] = process.env[alias];
  }
}
