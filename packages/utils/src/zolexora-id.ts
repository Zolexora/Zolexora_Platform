/**
 * Official canonical Regular Expressions for Zolexora Handles (@zolexora.com).
 */
export const ZOLEXORA_HANDLE_REGEX = /^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]@zolexora\.com$/i;
export const ZOLEXORA_PARTNER_HANDLE_REGEX = /^(?:[cv]|sp)[0-9]{6,12}@zolexora\.com$/i;

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

export function generateZolexoraHandle(prefix: "u" | "e" | "c" | "v" | "sp" = "u"): string {
  const bytes = getRandomBytes(8);
  let digits = "";
  for (let i = 0; i < 8; i++) {
    digits += String(bytes[i]! % 10);
  }
  return `${prefix}${digits}@zolexora.com`;
}

export function generatePartnerZolexoraId(kind: "client" | "vendor" | "service_provider"): string {
  const prefix = kind === "client" ? "c" : kind === "vendor" ? "v" : "sp";
  return generateZolexoraHandle(prefix);
}

/**
 * Validates whether an ID matches the official Zolexora handle format (<userid>@zolexora.com).
 */
export function isValidZolexoraId(id: string): boolean {
  return isValidZolexoraHandle(id);
}

/**
 * Normalizes a Zolexora ID to lowercase <userid>@zolexora.com.
 */
export function normalizeZolexoraId(id: string): string {
  const trimmed = id?.trim();
  if (!trimmed || !ZOLEXORA_HANDLE_REGEX.test(trimmed)) {
    throw new Error(`Invalid Zolexora ID format: "${id}". Expected <userid>@zolexora.com`);
  }
  return trimmed.toLowerCase();
}

/**
 * Validates whether an ID matches the official Zolexora Organization handle format (<userid>@zolexora.com).
 */
export function isValidZolexoraOrgId(id: string): boolean {
  return isValidZolexoraHandle(id);
}

/**
 * Normalizes a Zolexora Organization ID to lowercase <userid>@zolexora.com.
 */
export function normalizeZolexoraOrgId(id: string): string {
  const trimmed = id?.trim();
  if (!trimmed || !ZOLEXORA_HANDLE_REGEX.test(trimmed)) {
    throw new Error(`Invalid Zolexora Organization ID format: "${id}". Expected <userid>@zolexora.com`);
  }
  return trimmed.toLowerCase();
}
