import { describe, it, expect } from "vitest";
import {
  constantTimeEqual,
  hashPasswordScrypt,
  verifyPasswordScrypt,
  hashPasswordArgon2id,
  verifyPasswordArgon2id,
  hashPassword,
  verifyPassword,
} from "../src/crypto";
import {
  validatePassword,
  isValidPassword,
  validateCorporateEmail,
  isCorporateEmail,
  isPublicWebmailDomain,
  BLOCKED_WEBMAIL_DOMAINS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
} from "../src/validation";

describe("Cryptography & Password Hashing (@zolexora/utils)", () => {
  const validPassword = "CorporateSecurePassword2026!";

  it("hashes and verifies passwords using Scrypt", async () => {
    const hash = await hashPasswordScrypt(validPassword);
    expect(hash).toMatch(/^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/);

    const match = await verifyPasswordScrypt(validPassword, hash);
    expect(match).toBe(true);

    const wrongMatch = await verifyPasswordScrypt("WrongPassword123!", hash);
    expect(wrongMatch).toBe(false);
  });

  it("hashes and verifies passwords using Argon2id", async () => {
    const hash = await hashPasswordArgon2id(validPassword);
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$[A-Za-z0-9+/_-]+\$[A-Za-z0-9+/_-]+$/);

    const match = await verifyPasswordArgon2id(validPassword, hash);
    expect(match).toBe(true);

    const wrongMatch = await verifyPasswordArgon2id("WrongPassword123!", hash);
    expect(wrongMatch).toBe(false);
  });

  it("supports universal hashPassword and verifyPassword with algorithm auto-detection", async () => {
    const argonHash = await hashPassword(validPassword, "argon2id");
    expect(argonHash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(validPassword, argonHash)).toBe(true);
    expect(await verifyPassword("WrongPassword123!", argonHash)).toBe(false);

    const scryptHash = await hashPassword(validPassword, "scrypt");
    expect(scryptHash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword(validPassword, scryptHash)).toBe(true);
    expect(await verifyPassword("WrongPassword123!", scryptHash)).toBe(false);
  });

  it("handles corrupted or invalid hashes gracefully", async () => {
    expect(await verifyPassword(validPassword, "invalid_hash_string")).toBe(false);
    expect(await verifyPassword(validPassword, "$argon2id$corrupted$parameters")).toBe(false);
    expect(await verifyPassword(validPassword, "scrypt$invalid$format")).toBe(false);
    expect(await verifyPasswordScrypt(validPassword, "scrypt$32768$8$3$bad$hash")).toBe(false);
    expect(await verifyPasswordArgon2id(validPassword, "$argon2id$v=19$m=0$bad$hash")).toBe(false);
  });

  it("performs constant-time equality comparisons safely", () => {
    // Matching buffers
    const b1 = Buffer.from("super_secret_token_12345");
    const b2 = Buffer.from("super_secret_token_12345");
    expect(constantTimeEqual(b1, b2)).toBe(true);

    // Mismatched buffers of same length
    const b3 = Buffer.from("super_secret_token_67890");
    expect(constantTimeEqual(b1, b3)).toBe(false);

    // Mismatched buffers of different lengths (must not throw RangeError)
    const b4 = Buffer.from("short");
    expect(constantTimeEqual(b1, b4)).toBe(false);
    expect(constantTimeEqual(b4, b1)).toBe(false);

    // Strings
    expect(constantTimeEqual("token_abc", "token_abc")).toBe(true);
    expect(constantTimeEqual("token_abc", "token_xyz")).toBe(false);
    expect(constantTimeEqual("token_abc", "token_different_length")).toBe(false);
  });
});

describe("Password Policy Enforcement (@zolexora/utils)", () => {
  it("enforces minimum 12 characters", async () => {
    const shortPassword = "Short1!";
    expect(shortPassword.length).toBeLessThan(MIN_PASSWORD_LENGTH);
    expect(isValidPassword(shortPassword)).toBe(false);
    expect(() => validatePassword(shortPassword)).toThrow(/at least 12 characters/);

    await expect(hashPasswordScrypt(shortPassword)).rejects.toThrow(/at least 12 characters/);
    await expect(hashPasswordArgon2id(shortPassword)).rejects.toThrow(/at least 12 characters/);
  });

  it("accepts passwords that meet or exceed 12 characters", () => {
    const exactly12 = "TwelveChars!";
    expect(exactly12.length).toBe(12);
    expect(isValidPassword(exactly12)).toBe(true);
    expect(() => validatePassword(exactly12)).not.toThrow();
  });

  it("strictly rejects passwords exceeding 1024 bytes (DoS defense)", async () => {
    const oversizedPassword = "a".repeat(MAX_PASSWORD_BYTES + 1); // 1025 bytes
    expect(Buffer.byteLength(oversizedPassword, "utf8")).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(isValidPassword(oversizedPassword)).toBe(false);
    expect(() => validatePassword(oversizedPassword)).toThrow(/maximum allowed size/);

    await expect(hashPasswordScrypt(oversizedPassword)).rejects.toThrow(/maximum allowed size/);
    await expect(hashPasswordArgon2id(oversizedPassword)).rejects.toThrow(/maximum allowed size/);

    // verifyPassword must immediately reject without computing hash
    expect(await verifyPassword(oversizedPassword, "scrypt$32768$8$3$fake$hash")).toBe(false);
    expect(await verifyPassword(oversizedPassword, "$argon2id$v=19$fake$hash")).toBe(false);
  });
});

describe("Corporate Email Validation & Webmail Blocking (@zolexora/utils)", () => {
  it("identifies all specified public webmail domains", () => {
    const requiredDomains = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "icloud.com",
      "aol.com",
      "mail.com",
      "zoho.com",
      "proton.me",
      "protonmail.com",
      "gmx.com",
      "yandex.com",
    ];

    for (const domain of requiredDomains) {
      expect(isPublicWebmailDomain(domain)).toBe(true);
      expect(isPublicWebmailDomain(`user@${domain}`)).toBe(true);
      expect(isPublicWebmailDomain(`USER@${domain.toUpperCase()}`)).toBe(true);
    }
  });

  it("strictly blocks public webmail domains for corporate users", () => {
    const webmailAddresses = [
      "dispatcher@gmail.com",
      "driver@yahoo.com",
      "manager@hotmail.com",
      "fleet@outlook.com",
      "admin@icloud.com",
      "ops@proton.me",
    ];

    for (const email of webmailAddresses) {
      expect(isCorporateEmail(email)).toBe(false);
      expect(() => validateCorporateEmail(email)).toThrow(/Public email domains/);
    }
  });

  it("accepts valid corporate custom domains", () => {
    const corporateAddresses = [
      "alex@zolexora.com",
      "dispatcher@logistics-fleet.in",
      "operations@acme-supply-chain.co.uk",
      "driver.one@speedy-freight.com",
      "admin@partner.gov.in",
    ];

    for (const email of corporateAddresses) {
      expect(isCorporateEmail(email)).toBe(true);
      expect(validateCorporateEmail(email)).toBe(email.toLowerCase());
    }
  });

  it("normalizes corporate emails to lowercase trimmed format", () => {
    const messyEmail = "  Dispatcher@AcmeLogistics.COM  ";
    const normalized = validateCorporateEmail(messyEmail);
    expect(normalized).toBe("dispatcher@acmelogistics.com");
  });

  it("rejects invalid email formats", () => {
    expect(() => validateCorporateEmail("not-an-email")).toThrow(/Invalid email/);
    expect(() => validateCorporateEmail("missing@domain")).toThrow(/Invalid email/);
    expect(() => validateCorporateEmail("@nodomain.com")).toThrow(/Invalid email/);
  });
});
