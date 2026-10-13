import { randomBytes } from "node:crypto";

/**
 * Valid character alphabet for Zolexora IDs.
 * Base32 Crockford-inspired (excludes ambiguous chars: 0, O, 1, I).
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates a unique, high-entropy Zolexora ID.
 * Format: ZX-XXXX-XXXX-XXXX (e.g., ZX-8K9M-4P2W-7Y3X)
 * 
 * @param prefix Custom prefix (default: "ZX")
 * @returns Unique Zolexora ID string
 */
export function generateZolexoraId(prefix = "ZX"): string {
  const bytes = randomBytes(12);
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `${prefix}-${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
}

/**
 * Validates whether an ID matches the official Zolexora ID format.
 */
export function isValidZolexoraId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const regex = /^ZX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i;
  return regex.test(id.trim());
}

/**
 * Normalizes a Zolexora ID to uppercase standard format.
 */
export function normalizeZolexoraId(id: string): string {
  const clean = id.trim().toUpperCase();
  if (!isValidZolexoraId(clean)) {
    throw new Error(`Invalid Zolexora ID format: "${id}". Expected ZX-XXXX-XXXX-XXXX`);
  }
  return clean;
}
