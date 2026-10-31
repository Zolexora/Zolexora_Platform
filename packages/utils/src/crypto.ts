import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import * as nodeCrypto from "node:crypto";
import { validatePassword, MAX_PASSWORD_BYTES } from "./validation.js";

// Internal typing for Node.js 24 native argon2 methods
interface NodeCryptoNativeArgon2 {
  argon2?: (
    algorithm: string,
    parameters: {
      message: string | Buffer | Uint8Array;
      nonce: Buffer | Uint8Array;
      parallelism?: number;
      passes?: number;
      memory?: number;
      tagLength?: number;
      secret?: Buffer | Uint8Array;
      associatedData?: Buffer | Uint8Array;
      type?: number;
    },
    callback: (err: Error | null, result: Buffer) => void
  ) => void;
  argon2Sync?: (
    algorithm: string,
    parameters: {
      message: string | Buffer | Uint8Array;
      nonce: Buffer | Uint8Array;
      parallelism?: number;
      passes?: number;
      memory?: number;
      tagLength?: number;
      secret?: Buffer | Uint8Array;
      associatedData?: Buffer | Uint8Array;
      type?: number;
    }
  ) => Buffer;
}

const nativeCrypto = nodeCrypto as unknown as NodeCryptoNativeArgon2;

export interface ScryptConfig {
  N: number;
  r: number;
  p: number;
  keyLength: number;
  saltLength: number;
  maxmem: number;
}

export const DEFAULT_SCRYPT_CONFIG: ScryptConfig = {
  N: 32768, // 1 << 15
  r: 8,
  p: 3,
  keyLength: 64,
  saltLength: 16,
  maxmem: 64 * 1024 * 1024,
};

export interface Argon2idConfig {
  memory: number; // in KiB (65536 = 64 MB)
  passes: number; // t (iterations/time)
  parallelism: number; // p (threads)
  tagLength: number; // derived key length in bytes
  saltLength: number; // 16 bytes
}

export const DEFAULT_ARGON2ID_CONFIG: Argon2idConfig = {
  memory: 65536,
  passes: 3,
  parallelism: 4,
  tagLength: 32,
  saltLength: 16,
};

/**
 * Constant-time equality check between buffers, Uint8Arrays, or strings.
 * Guarantees resistance against timing side-channel attacks.
 * If input lengths differ, performs a dummy comparison of equal length before returning false.
 */
export function constantTimeEqual(
  a: Buffer | Uint8Array | string,
  b: Buffer | Uint8Array | string
): boolean {
  const bufA = typeof a === "string" ? Buffer.from(a, "utf8") : Buffer.from(a);
  const bufB = typeof b === "string" ? Buffer.from(b, "utf8") : Buffer.from(b);

  if (bufA.length === bufB.length) {
    return timingSafeEqual(bufA, bufB);
  }

  // To prevent timing leakage on length mismatch, perform dummy comparison
  // against a buffer of identical length to bufA, then return false.
  const dummy = Buffer.alloc(bufA.length, 0);
  timingSafeEqual(bufA, dummy);
  return false;
}

/**
 * Promise wrapper around node:crypto scrypt.
 */
function scryptAsync(
  password: string | Buffer,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

/**
 * Promise wrapper around native node:crypto argon2.
 */
function argon2Async(
  algorithm: string,
  parameters: {
    message: string | Buffer | Uint8Array;
    nonce: Buffer | Uint8Array;
    parallelism?: number;
    passes?: number;
    memory?: number;
    tagLength?: number;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (typeof nativeCrypto.argon2 !== "function") {
      return reject(
        new Error("Native crypto.argon2 is not available in the current Node.js runtime.")
      );
    }
    nativeCrypto.argon2(algorithm, parameters, (err, tag) => {
      if (err) reject(err);
      else resolve(tag);
    });
  });
}

/**
 * Hashes a plaintext password using Scrypt with a 16-byte random cryptographic salt.
 * Enforces password policy: min 12 characters, max 1024 bytes.
 *
 * @param password Plaintext password string
 * @param config Optional Scrypt tuning parameters
 * @returns Encoded hash string (format: scrypt$32768$8$3$<saltHex>$<keyHex>)
 */
export async function hashPasswordScrypt(
  password: string,
  config: Partial<ScryptConfig> = {}
): Promise<string> {
  validatePassword(password);
  const opts = { ...DEFAULT_SCRYPT_CONFIG, ...config };
  const salt = randomBytes(opts.saltLength);
  const key = await scryptAsync(password, salt, opts.keyLength, {
    N: opts.N,
    r: opts.r,
    p: opts.p,
    maxmem: opts.maxmem,
  });

  return `scrypt$${opts.N}$${opts.r}$${opts.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Verifies a plaintext password against an encoded Scrypt hash using constant-time comparison.
 * Strictly rejects passwords exceeding 1024 bytes before executing crypto operations.
 *
 * @param password Plaintext candidate password
 * @param encodedHash Stored hash string
 * @returns boolean indicating password match
 */
export async function verifyPasswordScrypt(
  password: string,
  encodedHash: string
): Promise<boolean> {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;

  const parts = encodedHash.split("$");
  // Expected format: scrypt$N$r$p$saltHex$keyHex or $scrypt$...
  const [algorithm, nStr, rStr, pStr, saltHex, keyHex] = parts[0] === ""
    ? parts.slice(1)
    : parts;

  if (
    algorithm !== "scrypt" ||
    !nStr ||
    !rStr ||
    !pStr ||
    !saltHex ||
    !keyHex ||
    !/^[a-f0-9]{32,}$/i.test(saltHex) ||
    !/^[a-f0-9]{32,}$/i.test(keyHex)
  ) {
    return false;
  }

  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");

  try {
    const actualKey = await scryptAsync(password, salt, expectedKey.length, {
      N: n,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return constantTimeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

/**
 * Hashes a plaintext password using Argon2id with a 16-byte random cryptographic salt.
 * Enforces password policy: min 12 characters, max 1024 bytes.
 *
 * @param password Plaintext password string
 * @param config Optional Argon2id tuning parameters (memory, passes, parallelism)
 * @returns Standard RFC 9106 PHC hash string ($argon2id$v=19$m=65536,t=3,p=4$<saltB64>$<tagB64>)
 */
export async function hashPasswordArgon2id(
  password: string,
  config: Partial<Argon2idConfig> = {}
): Promise<string> {
  validatePassword(password);
  const opts = { ...DEFAULT_ARGON2ID_CONFIG, ...config };
  const salt = randomBytes(opts.saltLength);

  const tag = await argon2Async("argon2id", {
    message: password,
    nonce: salt,
    memory: opts.memory,
    passes: opts.passes,
    parallelism: opts.parallelism,
    tagLength: opts.tagLength,
  });

  const saltB64 = salt.toString("base64").replace(/=+$/, "");
  const tagB64 = tag.toString("base64").replace(/=+$/, "");

  return `$argon2id$v=19$m=${opts.memory},t=${opts.passes},p=${opts.parallelism}$${saltB64}$${tagB64}`;
}

/**
 * Parses an Argon2id PHC or dollar-delimited hash string into parameters and buffers.
 */
function parseArgon2idHash(encodedHash: string): {
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  expectedTag: Buffer;
} | null {
  if (!encodedHash || typeof encodedHash !== "string") return null;
  const clean = encodedHash.trim();
  const parts = clean.split("$").filter(Boolean);

  if (parts.length < 4 || parts[0] !== "argon2id") return null;

  let paramStr = "";
  let saltStr = "";
  let tagStr = "";

  if (parts[1] && parts[1].startsWith("v=")) {
    paramStr = parts[2] ?? "";
    saltStr = parts[3] ?? "";
    tagStr = parts[4] ?? "";
  } else {
    paramStr = parts[1] ?? "";
    saltStr = parts[2] ?? "";
    tagStr = parts[3] ?? "";
  }

  if (!paramStr || !saltStr || !tagStr) return null;

  const params: Record<string, number> = {};
  for (const item of paramStr.split(",")) {
    const [k, v] = item.split("=");
    if (k && v) params[k.trim()] = Number(v.trim());
  }

  const memory = params.m ?? DEFAULT_ARGON2ID_CONFIG.memory;
  const passes = params.t ?? DEFAULT_ARGON2ID_CONFIG.passes;
  const parallelism = params.p ?? DEFAULT_ARGON2ID_CONFIG.parallelism;

  // Salt and Tag may be base64, base64url, or hex
  const salt = Buffer.from(saltStr, /^[0-9a-f]+$/i.test(saltStr) ? "hex" : "base64");
  const expectedTag = Buffer.from(tagStr, /^[0-9a-f]+$/i.test(tagStr) ? "hex" : "base64");

  if (salt.length === 0 || expectedTag.length === 0) return null;

  return { memory, passes, parallelism, salt, expectedTag };
}

/**
 * Verifies a plaintext password against an encoded Argon2id hash using constant-time comparison.
 * Strictly rejects passwords exceeding 1024 bytes before executing crypto operations.
 *
 * @param password Plaintext candidate password
 * @param encodedHash Stored hash string
 * @returns boolean indicating password match
 */
export async function verifyPasswordArgon2id(
  password: string,
  encodedHash: string
): Promise<boolean> {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;

  const parsed = parseArgon2idHash(encodedHash);
  if (!parsed) return false;

  try {
    const actualTag = await argon2Async("argon2id", {
      message: password,
      nonce: parsed.salt,
      memory: parsed.memory,
      passes: parsed.passes,
      parallelism: parsed.parallelism,
      tagLength: parsed.expectedTag.length,
    });

    return constantTimeEqual(actualTag, parsed.expectedTag);
  } catch {
    return false;
  }
}

/**
 * Universal password hashing helper supporting Argon2id and Scrypt.
 * Defaults to Argon2id.
 */
export async function hashPassword(
  password: string,
  algorithm: "argon2id" | "scrypt" = "argon2id"
): Promise<string> {
  if (algorithm === "scrypt") {
    return hashPasswordScrypt(password);
  }
  return hashPasswordArgon2id(password);
}

/**
 * Universal password verification helper. Automatically detects hash format
 * (Argon2id or Scrypt) and verifies with constant-time equality.
 */
export async function verifyPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;

  const clean = encodedHash.trim();
  if (clean.startsWith("$argon2id$") || clean.startsWith("argon2id$")) {
    return verifyPasswordArgon2id(password, clean);
  }
  if (clean.startsWith("scrypt$") || clean.startsWith("$scrypt$")) {
    return verifyPasswordScrypt(password, clean);
  }

  return false;
}
