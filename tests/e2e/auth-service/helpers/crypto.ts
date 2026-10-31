import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";

export const CROCKFORD_BASE32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const USER_ID_REGEX = /^ZX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i;
export const ORG_ID_REGEX = /^ZX-ORG-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i;

export const SCRYPT_N = 32768;
export const SCRYPT_R = 8;
export const SCRYPT_P = 3;
export const KEY_LENGTH = 64;

export function getRandomBytes(length: number): Uint8Array {
  return randomBytes(length);
}

export function generateZolexoraId(prefix = "ZX"): string {
  const bytes = getRandomBytes(12);
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += CROCKFORD_BASE32_ALPHABET[bytes[i]! % CROCKFORD_BASE32_ALPHABET.length];
  }
  return `${prefix}-${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
}

export function generateZolexoraOrgId(): string {
  return generateZolexoraId("ZX-ORG");
}

export function isValidZolexoraId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return USER_ID_REGEX.test(id.trim());
}

export function isValidZolexoraOrgId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return ORG_ID_REGEX.test(id.trim());
}

export function normalizeZolexoraId(id: string): string {
  const clean = id.trim().toUpperCase();
  if (!isValidZolexoraId(clean)) {
    throw new Error(`Invalid Zolexora ID format: "${id}". Expected ZX-XXXX-XXXX-XXXX`);
  }
  return clean;
}

export function normalizeZolexoraOrgId(id: string): string {
  const clean = id.trim().toUpperCase();
  if (!isValidZolexoraOrgId(clean)) {
    throw new Error(`Invalid Zolexora Org ID format: "${id}". Expected ZX-ORG-XXXX-XXXX-XXXX`);
  }
  return clean;
}

export function validatePassword(password: string): void {
  const length = Buffer.byteLength(password, "utf8");
  if (length < 12) {
    throw new Error("AUTH_PASSWORD_POLICY_VIOLATION: Password must be at least 12 characters.");
  }
  if (length > 1024) {
    throw new Error("AUTH_PASSWORD_POLICY_VIOLATION: Password must not exceed 1024 bytes.");
  }
}

export const scryptAsync = (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number }
) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key as Buffer)
    );
  });

export async function hashPasswordScrypt(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPasswordScrypt(password: string, encoded: string): Promise<boolean> {
  if (Buffer.byteLength(password, "utf8") > 1024) return false;
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltHex, keyHex] = parts;
  if (
    Number(n) !== SCRYPT_N ||
    Number(r) !== SCRYPT_R ||
    Number(p) !== SCRYPT_P ||
    !/^[a-f0-9]{32}$/i.test(saltHex ?? "") ||
    !keyHex
  ) {
    return false;
  }

  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;

  try {
    const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
