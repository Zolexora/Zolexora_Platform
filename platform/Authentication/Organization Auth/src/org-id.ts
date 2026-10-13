import { randomBytes } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates a unique Zolexora Organization ID.
 * Format: ZX-ORG-XXXX-XXXX-XXXX
 */
export function generateZolexoraOrgId(): string {
  const bytes = randomBytes(12);
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `ZX-ORG-${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
}

export function isValidZolexoraOrgId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return /^ZX-ORG-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i.test(id.trim());
}
