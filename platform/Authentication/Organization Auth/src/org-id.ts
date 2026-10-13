const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function getRandomBytes(length: number): Uint8Array {
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
 * Generates a unique Zolexora Organization ID.
 * Format: ZX-ORG-XXXX-XXXX-XXXX
 */
export function generateZolexoraOrgId(): string {
  const bytes = getRandomBytes(12);
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
