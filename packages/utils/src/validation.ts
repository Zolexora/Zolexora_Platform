/**
 * Password Policy & Email Validation Utilities for Zolexora Platform
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_BYTES = 1024;

/**
 * Public webmail domains strictly blocked for corporate / organization accounts.
 */
export const BLOCKED_WEBMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "mail.com",
  "zoho.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
] as const;

const BLOCKED_WEBMAIL_SET = new Set<string>(BLOCKED_WEBMAIL_DOMAINS);

/**
 * Validates password length constraints:
 * - Minimum 12 characters
 * - Maximum 1024 UTF-8 bytes (prevents hashing algorithmic complexity DoS)
 *
 * @throws Error if password fails length policy
 */
export function validatePassword(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength > MAX_PASSWORD_BYTES) {
    throw new Error(`Password exceeds maximum allowed size of ${MAX_PASSWORD_BYTES} bytes.`);
  }
}

/**
 * Returns true if password satisfies length constraints (min 12 chars, max 1024 bytes).
 */
export function isValidPassword(password: string): boolean {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return false;
  }
  return Buffer.byteLength(password, "utf8") <= MAX_PASSWORD_BYTES;
}

/**
 * Standard email format validation regex.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes email address to trimmed lowercase.
 */
export function normalizeEmail(email: string): string {
  if (typeof email !== "string") {
    throw new Error("Email must be a string.");
  }
  const clean = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(clean)) {
    throw new Error("Invalid email address format.");
  }
  return clean;
}

/**
 * Checks if a given domain or email address belongs to a public webmail provider.
 */
export function isPublicWebmailDomain(emailOrDomain: string): boolean {
  if (!emailOrDomain || typeof emailOrDomain !== "string") return false;
  const input = emailOrDomain.trim().toLowerCase();
  const domain = input.includes("@") ? input.slice(input.lastIndexOf("@") + 1) : input;
  return BLOCKED_WEBMAIL_SET.has(domain);
}

/**
 * Validates that an email is valid and belongs to a private/corporate domain.
 * Strictly blocks public consumer webmail providers (e.g., gmail.com, yahoo.com).
 *
 * @param email Raw email address
 * @returns Clean normalized email address
 * @throws Error if email is invalid or belongs to a public webmail domain
 */
export function validateCorporateEmail(email: string): string {
  const clean = normalizeEmail(email);
  const domain = clean.slice(clean.lastIndexOf("@") + 1);
  if (BLOCKED_WEBMAIL_SET.has(domain)) {
    throw new Error(`Public email domains like "${domain}" are not permitted for corporate employees.`);
  }
  return clean;
}

/**
 * Returns true if the email is a valid format and is NOT from a public webmail provider.
 */
export function isCorporateEmail(email: string): boolean {
  try {
    validateCorporateEmail(email);
    return true;
  } catch {
    return false;
  }
}
