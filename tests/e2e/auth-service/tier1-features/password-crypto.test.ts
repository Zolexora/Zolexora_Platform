import { describe, it, expect } from "vitest";
import {
  hashPasswordScrypt,
  verifyPasswordScrypt,
  validatePassword,
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
} from "../helpers/crypto";
import { FIXTURES } from "../helpers/fixtures";

describe("Tier 1: Feature 6 — Cryptographic Password Hashing & Timing Defense", () => {
  it("T1.6.01: Scrypt hashing produces format scrypt$32768$8$3$<16_byte_salt_hex>$<64_byte_key_hex>", async () => {
    const hash = await hashPasswordScrypt(FIXTURES.passwords.standard);
    const parts = hash.split("$");

    expect(parts.length).toBe(6);
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(SCRYPT_N);
    expect(Number(parts[2])).toBe(SCRYPT_R);
    expect(Number(parts[3])).toBe(SCRYPT_P);
    expect(parts[4].length).toBe(32); // 16 bytes in hex = 32 chars
    expect(parts[5].length).toBe(128); // 64 bytes in hex = 128 chars
  });

  it("T1.6.02: Scrypt password verification succeeds for identical plaintext and fails for mismatch", async () => {
    const hash = await hashPasswordScrypt(FIXTURES.passwords.standard);
    const match = await verifyPasswordScrypt(FIXTURES.passwords.standard, hash);
    const mismatch = await verifyPasswordScrypt("WrongPassword999!", hash);

    expect(match).toBe(true);
    expect(mismatch).toBe(false);
  });

  it("T1.6.03: Password length < 12 characters throws AUTH_PASSWORD_POLICY_VIOLATION", () => {
    expect(() => validatePassword(FIXTURES.passwords.short11Chars)).toThrow(
      /AUTH_PASSWORD_POLICY_VIOLATION.*at least 12 characters/i
    );
  });

  it("T1.6.04: Password length > 1024 bytes throws AUTH_PASSWORD_POLICY_VIOLATION to prevent DoS", () => {
    expect(() => validatePassword(FIXTURES.passwords.tooLong1025Bytes)).toThrow(
      /AUTH_PASSWORD_POLICY_VIOLATION.*not exceed 1024 bytes/i
    );
  });

  it("T1.6.05: Scrypt verification rejects passwords exceeding 1024 bytes immediately without computation", async () => {
    const hash = await hashPasswordScrypt(FIXTURES.passwords.standard);
    const result = await verifyPasswordScrypt(FIXTURES.passwords.tooLong1025Bytes, hash);
    expect(result).toBe(false);
  });
});
