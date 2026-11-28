/**
 * Valid character alphabet for Zolexora IDs.
 * Base32 Crockford-inspired (excludes ambiguous chars: 0, O, 1, I).
 */
export const CROCKFORD_BASE32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Official canonical Regular Expressions for Zolexora User and Org IDs.
 */
export const ZOLEXORA_ID_REGEX = /^ZX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i;
export const ZOLEXORA_ORG_ID_REGEX = /^ZX-ORG-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i;
export const ZOLEXORA_HANDLE_REGEX = /^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]@zolexora\.com$/i;
export const ZOLEXORA_PARTNER_HANDLE_REGEX = /^[cv][0-9]{6,12}@zolexora\.com$/i;

/**
 * Generates cryptographically secure random bytes across Browser, Node, Edge, and Mobile.
 */
export function getRandomBytes(length: number): Uint8Array {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const arr = new Uint8Array(length);
    globalThis.crypto.getRandomValues(arr);
    return arr;
  }
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

/**
 * Generates a unique, high-entropy Zolexora ID.
 * Format: ZX-XXXX-XXXX-XXXX (e.g., ZX-8K9M-4P2W-7Y3X)
 * 
 * @param prefix Custom prefix (default: "ZX")
 * @returns Unique Zolexora ID string
 */
export function generateZolexoraId(prefix = "ZX"): string {
  const bytes = getRandomBytes(12);
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += CROCKFORD_BASE32_ALPHABET[bytes[i]! % CROCKFORD_BASE32_ALPHABET.length];
  }
  return `${prefix}-${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
}

export function isValidZolexoraHandle(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return ZOLEXORA_HANDLE_REGEX.test(id.trim());
}

export function formatZolexoraHandle(userid: string): string {
  const clean = userid.trim().toLowerCase().replace(/@zolexora\.com$/i, "");
  const handle = `${clean}@zolexora.com`;
  if (!ZOLEXORA_HANDLE_REGEX.test(handle)) {
    throw new Error(`Invalid Zolexora userid "${userid}". Use 3-50 lowercase letters, digits, '.', '_' or '-'.`);
  }
  return handle;
}

export function generatePartnerZolexoraId(kind: "client" | "vendor"): string {
  const prefix = kind === "client" ? "c" : "v";
  const bytes = getRandomBytes(8);
  let digits = "";
  for (let i = 0; i < 8; i++) {
    digits += String(bytes[i]! % 10);
  }
  return `${prefix}${digits}@zolexora.com`;
}

/**
 * Validates whether an ID matches the official Zolexora ID format (legacy ZX-... or userid@zolexora.com).
 */
export function isValidZolexoraId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  return ZOLEXORA_ID_REGEX.test(trimmed) || ZOLEXORA_HANDLE_REGEX.test(trimmed);
}

/**
 * Normalizes a Zolexora ID (lowercase for @zolexora.com handles, uppercase for ZX-...).
 */
export function normalizeZolexoraId(id: string): string {
  const trimmed = id?.trim();
  if (trimmed && ZOLEXORA_HANDLE_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const clean = trimmed?.toUpperCase();
  if (!clean || !ZOLEXORA_ID_REGEX.test(clean)) {
    throw new Error(`Invalid Zolexora ID format: "${id}". Expected userid@zolexora.com or ZX-XXXX-XXXX-XXXX`);
  }
  return clean;
}

/**
 * Generates a unique, high-entropy Zolexora Organization ID.
 * Format: ZX-ORG-XXXX-XXXX-XXXX
 */
export function generateZolexoraOrgId(): string {
  return generateZolexoraId("ZX-ORG");
}

/**
 * Validates whether an ID matches the official Zolexora Organization ID format (ZX-ORG-... or userid@zolexora.com).
 */
export function isValidZolexoraOrgId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  return ZOLEXORA_ORG_ID_REGEX.test(trimmed) || ZOLEXORA_HANDLE_REGEX.test(trimmed);
}

/**
 * Normalizes a Zolexora Organization ID (lowercase for @zolexora.com handles, uppercase for ZX-ORG-...).
 */
export function normalizeZolexoraOrgId(id: string): string {
  const trimmed = id?.trim();
  if (trimmed && ZOLEXORA_HANDLE_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const clean = trimmed?.toUpperCase();
  if (!clean || !ZOLEXORA_ORG_ID_REGEX.test(clean)) {
    throw new Error(`Invalid Zolexora Organization ID format: "${id}". Expected userid@zolexora.com or ZX-ORG-XXXX-XXXX-XXXX`);
  }
  return clean;
}
