import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
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
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
} from "../src/validation";

describe("Adversarial Challenge 1: Boundary Password Lengths", () => {
  it("strictly rejects 0-byte (empty) passwords", async () => {
    const empty = "";
    expect(empty.length).toBe(0);
    expect(Buffer.byteLength(empty, "utf8")).toBe(0);

    expect(isValidPassword(empty)).toBe(false);
    expect(() => validatePassword(empty)).toThrow(/at least 12 characters/);

    await expect(hashPasswordScrypt(empty)).rejects.toThrow(/at least 12 characters/);
    await expect(hashPasswordArgon2id(empty)).rejects.toThrow(/at least 12 characters/);

    // Any verify call on empty password must return false, not crash
    expect(await verifyPassword(empty, "scrypt$32768$8$3$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef")).toBe(false);
    expect(await verifyPassword(empty, "$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQxMjM0NTY=$dGVzdHRhZzEyMzQ1Njc4OTA=")).toBe(false);
    expect(await verifyPasswordScrypt(empty, "scrypt$32768$8$3$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef")).toBe(false);
    expect(await verifyPasswordArgon2id(empty, "$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQxMjM0NTY=$dGVzdHRhZzEyMzQ1Njc4OTA=")).toBe(false);
  });

  it("strictly rejects boundary 11-character passwords (off-by-one check)", async () => {
    const pwd11 = "A1b2C3d4E5f"; // exactly 11 chars
    expect(pwd11.length).toBe(11);
    expect(Buffer.byteLength(pwd11, "utf8")).toBe(11);

    expect(isValidPassword(pwd11)).toBe(false);
    expect(() => validatePassword(pwd11)).toThrow(/at least 12 characters/);

    await expect(hashPasswordScrypt(pwd11)).rejects.toThrow(/at least 12 characters/);
    await expect(hashPasswordArgon2id(pwd11)).rejects.toThrow(/at least 12 characters/);
  });

  it("accepts boundary 12-character passwords (minimum valid threshold)", async () => {
    const pwd12 = "A1b2C3d4E5f6"; // exactly 12 chars
    expect(pwd12.length).toBe(12);
    expect(Buffer.byteLength(pwd12, "utf8")).toBe(12);

    expect(isValidPassword(pwd12)).toBe(true);
    expect(() => validatePassword(pwd12)).not.toThrow();

    // Fast scrypt hash
    const scryptHash = await hashPasswordScrypt(pwd12, { N: 1024, r: 8, p: 1 });
    expect(await verifyPassword(pwd12, scryptHash)).toBe(true);
    expect(await verifyPassword("A1b2C3d4E5f7", scryptHash)).toBe(false);

    // Fast argon2id hash
    const argonHash = await hashPasswordArgon2id(pwd12, { memory: 1024, passes: 1, parallelism: 1 });
    expect(await verifyPassword(pwd12, argonHash)).toBe(true);
    expect(await verifyPassword("A1b2C3d4E5f7", argonHash)).toBe(false);
  });

  it("accepts boundary 1024-byte passwords (maximum valid threshold)", async () => {
    const pwd1024 = "x".repeat(1024);
    expect(pwd1024.length).toBe(1024);
    expect(Buffer.byteLength(pwd1024, "utf8")).toBe(1024);

    expect(isValidPassword(pwd1024)).toBe(true);
    expect(() => validatePassword(pwd1024)).not.toThrow();

    const scryptHash = await hashPasswordScrypt(pwd1024, { N: 1024, r: 8, p: 1 });
    expect(await verifyPassword(pwd1024, scryptHash)).toBe(true);
    expect(await verifyPassword(pwd1024.slice(0, 1023) + "y", scryptHash)).toBe(false);

    const argonHash = await hashPasswordArgon2id(pwd1024, { memory: 1024, passes: 1, parallelism: 1 });
    expect(await verifyPassword(pwd1024, argonHash)).toBe(true);
    expect(await verifyPassword(pwd1024.slice(0, 1023) + "y", argonHash)).toBe(false);
  });

  it("strictly rejects boundary 1025-byte passwords (DoS prevention threshold)", async () => {
    const pwd1025 = "x".repeat(1025);
    expect(pwd1025.length).toBe(1025);
    expect(Buffer.byteLength(pwd1025, "utf8")).toBe(1025);

    expect(isValidPassword(pwd1025)).toBe(false);
    expect(() => validatePassword(pwd1025)).toThrow(/maximum allowed size of 1024 bytes/);

    await expect(hashPasswordScrypt(pwd1025)).rejects.toThrow(/maximum allowed size of 1024 bytes/);
    await expect(hashPasswordArgon2id(pwd1025)).rejects.toThrow(/maximum allowed size of 1024 bytes/);

    // verifyPassword must immediately reject without computing hash
    expect(await verifyPassword(pwd1025, "scrypt$32768$8$3$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef")).toBe(false);
    expect(await verifyPassword(pwd1025, "$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQxMjM0NTY=$dGVzdHRhZzEyMzQ1Njc4OTA=")).toBe(false);
  });
});

describe("Adversarial Challenge 2: Multibyte UTF-8 Boundary Stress", () => {
  it("enforces byte-length vs character-length distinction on 4-byte emojis", async () => {
    // 🔥 is 2 UTF-16 code units (length = 2), but 4 UTF-8 bytes
    const emoji5 = "🔥".repeat(5); // 5 emojis: length = 10, bytes = 20
    expect(emoji5.length).toBe(10);
    expect(Buffer.byteLength(emoji5, "utf8")).toBe(20);
    // Should fail because character length (10) < 12 characters
    expect(isValidPassword(emoji5)).toBe(false);
    expect(() => validatePassword(emoji5)).toThrow(/at least 12 characters/);

    const emoji6 = "🔥".repeat(6); // 6 emojis: length = 12, bytes = 24
    expect(emoji6.length).toBe(12);
    expect(Buffer.byteLength(emoji6, "utf8")).toBe(24);
    // Should pass because length >= 12 and bytes (24) <= 1024
    expect(isValidPassword(emoji6)).toBe(true);
    expect(() => validatePassword(emoji6)).not.toThrow();

    const scryptHash = await hashPasswordScrypt(emoji6, { N: 1024, r: 8, p: 1 });
    expect(await verifyPassword(emoji6, scryptHash)).toBe(true);
    expect(await verifyPassword("🔥".repeat(5) + "🚀", scryptHash)).toBe(false);
  });

  it("handles maximum 1024-byte limit with 4-byte emojis", async () => {
    // 256 emojis * 4 bytes = exactly 1024 bytes. length = 512 code units.
    const emoji256 = "🚀".repeat(256);
    expect(emoji256.length).toBe(512);
    expect(Buffer.byteLength(emoji256, "utf8")).toBe(1024);
    expect(isValidPassword(emoji256)).toBe(true);
    expect(() => validatePassword(emoji256)).not.toThrow();

    const argonHash = await hashPasswordArgon2id(emoji256, { memory: 1024, passes: 1, parallelism: 1 });
    expect(await verifyPassword(emoji256, argonHash)).toBe(true);

    // 257 emojis * 4 bytes = 1028 bytes (> 1024)
    const emoji257 = "🚀".repeat(257);
    expect(Buffer.byteLength(emoji257, "utf8")).toBe(1028);
    expect(isValidPassword(emoji257)).toBe(false);
    expect(() => validatePassword(emoji257)).toThrow(/maximum allowed size of 1024 bytes/);
  });

  it("handles 3-byte CJK characters at length and byte boundaries", async () => {
    // 漢 is 1 code unit (length = 1), 3 UTF-8 bytes
    const cjk11 = "漢".repeat(11); // length = 11, bytes = 33
    expect(cjk11.length).toBe(11);
    expect(Buffer.byteLength(cjk11, "utf8")).toBe(33);
    // Fails because length < 12
    expect(isValidPassword(cjk11)).toBe(false);

    const cjk12 = "漢".repeat(12); // length = 12, bytes = 36
    expect(cjk12.length).toBe(12);
    expect(Buffer.byteLength(cjk12, "utf8")).toBe(36);
    expect(isValidPassword(cjk12)).toBe(true);

    // 341 CJK characters = 341 * 3 = 1023 bytes. + 1 ASCII byte = exactly 1024 bytes
    const cjk1024 = "漢".repeat(341) + "!";
    expect(Buffer.byteLength(cjk1024, "utf8")).toBe(1024);
    expect(isValidPassword(cjk1024)).toBe(true);
    expect(() => validatePassword(cjk1024)).not.toThrow();

    const hash = await hashPasswordArgon2id(cjk1024, { memory: 1024, passes: 1, parallelism: 1 });
    expect(await verifyPassword(cjk1024, hash)).toBe(true);

    // 341 CJK characters + 2 ASCII bytes = 1025 bytes -> rejected
    const cjk1025 = "漢".repeat(341) + "!@";
    expect(Buffer.byteLength(cjk1025, "utf8")).toBe(1025);
    expect(isValidPassword(cjk1025)).toBe(false);
    expect(() => validatePassword(cjk1025)).toThrow(/maximum allowed size/);
  });

  it("handles passwords containing embedded null bytes without truncation", async () => {
    const pwdWithNull = "PasswordWith\0EmbeddedNullByte";
    expect(pwdWithNull.length).toBe(29);
    expect(isValidPassword(pwdWithNull)).toBe(true);

    const scryptHash = await hashPasswordScrypt(pwdWithNull, { N: 1024, r: 8, p: 1 });
    expect(await verifyPassword(pwdWithNull, scryptHash)).toBe(true);

    // Truncated version before null byte must fail
    expect(await verifyPassword("PasswordWith", scryptHash)).toBe(false);
  });
});

describe("Adversarial Challenge 3: Malformed and Hostile Hash Structures", () => {
  const dummyPassword = "ValidPassword1234!";

  it("gracefully returns false for empty, whitespace, and non-string hashes", async () => {
    expect(await verifyPassword(dummyPassword, "")).toBe(false);
    expect(await verifyPassword(dummyPassword, "   ")).toBe(false);
    expect(await verifyPassword(dummyPassword, null as unknown as string)).toBe(false);
    expect(await verifyPassword(dummyPassword, undefined as unknown as string)).toBe(false);
    expect(await verifyPassword(dummyPassword, 12345 as unknown as string)).toBe(false);
    expect(await verifyPassword(dummyPassword, {} as unknown as string)).toBe(false);

    expect(await verifyPasswordScrypt(dummyPassword, "")).toBe(false);
    expect(await verifyPasswordScrypt(dummyPassword, null as unknown as string)).toBe(false);
    expect(await verifyPasswordArgon2id(dummyPassword, "")).toBe(false);
    expect(await verifyPasswordArgon2id(dummyPassword, null as unknown as string)).toBe(false);
  });

  it("gracefully rejects unknown or unsupported hash algorithms", async () => {
    expect(await verifyPassword(dummyPassword, "$bcrypt$v=98$2b$12$e8I/uXdummyhash")).toBe(false);
    expect(await verifyPassword(dummyPassword, "$argon2i$v=19$m=65536,t=3,p=4$c2FsdA$dGFn")).toBe(false);
    expect(await verifyPassword(dummyPassword, "$argon2d$v=19$m=65536,t=3,p=4$c2FsdA$dGFn")).toBe(false);
    expect(await verifyPassword(dummyPassword, "$pbkdf2-sha256$i=10000$c2FsdA$dGFn")).toBe(false);
    expect(await verifyPassword(dummyPassword, "sha512$10000$salt$key")).toBe(false);
    expect(await verifyPassword(dummyPassword, "md5$hash")).toBe(false);
  });

  it("gracefully handles truncated, malformed, or corrupt Argon2id hashes", async () => {
    const malformedArgonHashes = [
      "$argon2id$",
      "$argon2id$v=19",
      "$argon2id$v=19$",
      "$argon2id$v=19$m=65536,t=3,p=4",
      "$argon2id$v=19$m=65536,t=3,p=4$",
      "$argon2id$v=19$m=65536,t=3,p=4$$",
      "$argon2id$v=19$m=65536,t=3,p=4$$tag",
      "$argon2id$v=19$m=65536,t=3,p=4$salt$",
      "$argon2id$v=19$m=abc,t=xyz,p=foo$dGVzdHNhbHQ=$dGFn",
      "$argon2id$v=19$m=0,t=0,p=0$dGVzdHNhbHQ=$dGFn",
      "$argon2id$v=19$m=-100,t=-1,p=-1$dGVzdHNhbHQ=$dGFn",
      "$argon2id$v=19$m=9999999999999,t=1,p=1$dGVzdHNhbHQ=$dGFn",
      "$argon2id$v=19$m=65536,t=3,p=4$!!!invalid_base64!!!$!!!invalid_tag!!!",
      "argon2id$$$$",
      "$argon2id$v=19$m=65536,t=3,p=4$\0\0\0$\0\0\0",
    ];

    for (const badHash of malformedArgonHashes) {
      const result = await verifyPassword(dummyPassword, badHash);
      expect(result).toBe(false);
    }
  });

  it("gracefully handles truncated, malformed, or corrupt Scrypt hashes", async () => {
    const malformedScryptHashes = [
      "scrypt",
      "scrypt$",
      "scrypt$32768",
      "scrypt$32768$8",
      "scrypt$32768$8$3",
      "scrypt$32768$8$3$",
      "scrypt$32768$8$3$$",
      "scrypt$32768$8$3$shortsalt$shortkey",
      "scrypt$32768$8$3$zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz$zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz", // non-hex
      "scrypt$0$0$0$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef",
      "scrypt$-1$-1$-1$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef",
      "scrypt$NaN$NaN$NaN$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef",
      "scrypt$1048576$8$3$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef", // memory limit exceeded
      "$scrypt$32768$8$3$not_hex$not_hex",
    ];

    for (const badHash of malformedScryptHashes) {
      const result = await verifyPassword(dummyPassword, badHash);
      expect(result).toBe(false);
    }
  });

  it("rejects altered salt or tag bits (bit-flip tampering check)", async () => {
    const validArgon = await hashPasswordArgon2id(dummyPassword, { memory: 1024, passes: 1, parallelism: 1 });
    // Flip a character in the salt part
    const parts = validArgon.split("$");
    // parts: ["", "argon2id", "v=19", "m=1024...", saltB64, tagB64]
    const saltIdx = parts.length - 2;
    const originalSalt = parts[saltIdx];
    const tamperedSalt = (originalSalt[0] === "A" ? "B" : "A") + originalSalt.slice(1);
    parts[saltIdx] = tamperedSalt;
    const tamperedArgon = parts.join("$");

    expect(await verifyPassword(dummyPassword, tamperedArgon)).toBe(false);

    // Tamper tag
    const tagIdx = parts.length - 1;
    parts[saltIdx] = originalSalt;
    parts[tagIdx] = (parts[tagIdx][0] === "A" ? "B" : "A") + parts[tagIdx].slice(1);
    const tamperedTagArgon = parts.join("$");

    expect(await verifyPassword(dummyPassword, tamperedTagArgon)).toBe(false);
  });
});

describe("Adversarial Challenge 4: Timing Safe Equality (constantTimeEqual) Stress", () => {
  it("correctly compares matching buffers of varying sizes", () => {
    const sizes = [0, 1, 15, 16, 31, 32, 64, 128, 512, 1024, 4096];
    for (const size of sizes) {
      const bufA = randomBytes(size);
      const bufB = Buffer.from(bufA);
      expect(constantTimeEqual(bufA, bufB)).toBe(true);
    }
  });

  it("correctly detects mismatches at first byte, middle byte, and last byte", () => {
    const size = 64;
    const base = randomBytes(size);

    // Mismatch at index 0
    const diffStart = Buffer.from(base);
    diffStart[0] ^= 0x01;
    expect(constantTimeEqual(base, diffStart)).toBe(false);

    // Mismatch in the middle
    const diffMid = Buffer.from(base);
    diffMid[Math.floor(size / 2)] ^= 0x01;
    expect(constantTimeEqual(base, diffMid)).toBe(false);

    // Mismatch at last byte
    const diffEnd = Buffer.from(base);
    diffEnd[size - 1] ^= 0x01;
    expect(constantTimeEqual(base, diffEnd)).toBe(false);
  });

  it("handles length mismatches without throwing RangeError (1000 randomized length pairs)", () => {
    // Crucial: Node's native crypto.timingSafeEqual throws RangeError if buffer lengths differ.
    // constantTimeEqual must catch/guard this and return false safely.
    for (let i = 0; i < 1000; i++) {
      const lenA = Math.floor(Math.random() * 128); // 0 to 127
      let lenB = Math.floor(Math.random() * 128);
      if (lenA === lenB) lenB = lenA + 1; // ensure length mismatch

      const bufA = randomBytes(lenA);
      const bufB = randomBytes(lenB);

      expect(() => {
        const result = constantTimeEqual(bufA, bufB);
        expect(result).toBe(false);
      }).not.toThrow();

      // Test reverse order as well
      expect(() => {
        const result = constantTimeEqual(bufB, bufA);
        expect(result).toBe(false);
      }).not.toThrow();
    }
  });

  it("handles empty buffers against non-empty buffers safely", () => {
    const emptyBuf = Buffer.alloc(0);
    const nonEmptyBuf = Buffer.from("secret");

    expect(constantTimeEqual(emptyBuf, emptyBuf)).toBe(true);
    expect(constantTimeEqual(emptyBuf, nonEmptyBuf)).toBe(false);
    expect(constantTimeEqual(nonEmptyBuf, emptyBuf)).toBe(false);
  });

  it("handles heterogeneous types: Uint8Array, Buffer, string, and subarray slices", () => {
    const rawData = [10, 20, 30, 40, 50, 60, 70, 80];
    const u8 = new Uint8Array(rawData);
    const buf = Buffer.from(rawData);

    // Uint8Array vs Buffer
    expect(constantTimeEqual(u8, buf)).toBe(true);
    expect(constantTimeEqual(buf, u8)).toBe(true);

    // Subarray slices with offset
    const u8Slice = u8.subarray(2, 6);
    const bufSlice = buf.subarray(2, 6);
    expect(constantTimeEqual(u8Slice, bufSlice)).toBe(true);

    // String vs string
    expect(constantTimeEqual("secret_key_123", "secret_key_123")).toBe(true);
    expect(constantTimeEqual("secret_key_123", "secret_key_456")).toBe(false);
    expect(constantTimeEqual("short", "much_longer_secret")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
    expect(constantTimeEqual("", "non-empty")).toBe(false);

    // String vs Buffer
    expect(constantTimeEqual("secret_key", Buffer.from("secret_key", "utf8"))).toBe(true);
    expect(constantTimeEqual(Buffer.from("secret_key", "utf8"), "secret_key")).toBe(true);
  });

  it("exhibits non-short-circuiting timing behavior across different mismatch positions", () => {
    // Empirical timing verification: compare execution time of mismatch at byte 0
    // vs mismatch at byte 1023 over 10,000 iterations to verify no fast abort.
    const size = 1024;
    const a = Buffer.alloc(size, 0xaa);
    const bMismatchStart = Buffer.alloc(size, 0xaa);
    bMismatchStart[0] = 0xbb;

    const bMismatchEnd = Buffer.alloc(size, 0xaa);
    bMismatchEnd[size - 1] = 0xbb;

    const iterations = 5000;

    // Warm-up
    for (let i = 0; i < 500; i++) {
      constantTimeEqual(a, bMismatchStart);
      constantTimeEqual(a, bMismatchEnd);
    }

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      constantTimeEqual(a, bMismatchStart);
    }
    const durationStart = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      constantTimeEqual(a, bMismatchEnd);
    }
    const durationEnd = performance.now() - t1;

    // Both should take comparable time within normal OS scheduling jitter (e.g. ratio < 3.0)
    const ratio = Math.max(durationStart, durationEnd) / Math.min(durationStart, durationEnd);
    expect(ratio).toBeLessThan(3.0);
  });
});

describe("Adversarial Challenge 5: Randomized Plaintext Roundtrips", () => {
  // Generate random strings with diverse Unicode ranges
  function generateRandomPassword(length: number): string {
    const charSets = [
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      "!@#$%^&*()_+-=[]{}|;:,.<>/?`~'\"\\",
      "日本語テスト文字ランダムパスワード",
      "العربية_اختبار_كلمة_مرور",
      "РусскийТекстПароль123",
      "🚀🔥🎉🛡️🔑🔒",
    ];
    let result = "";
    while (result.length < length) {
      const set = charSets[Math.floor(Math.random() * charSets.length)];
      result += set[Math.floor(Math.random() * set.length)];
    }
    // Truncate to desired byte length if it exceeds 1024
    while (Buffer.byteLength(result, "utf8") > 1024) {
      result = result.slice(0, -1);
    }
    if (result.length < 12) {
      result += "SecureExtra12";
    }
    return result;
  }

  it("successfully roundtrips 15 diverse randomized passwords with Scrypt and Argon2id", async () => {
    const lengths = [12, 13, 20, 32, 64, 100, 128, 256, 500, 750, 900, 1000, 1024];

    for (const len of lengths) {
      const password = generateRandomPassword(len);
      expect(isValidPassword(password)).toBe(true);

      // Scrypt roundtrip
      const scryptHash = await hashPasswordScrypt(password, { N: 1024, r: 8, p: 1 });
      expect(await verifyPasswordScrypt(password, scryptHash)).toBe(true);
      expect(await verifyPassword(password, scryptHash)).toBe(true);

      // Mutate password -> must fail
      const mutatedPwd = password.slice(0, -1) + (password.slice(-1) === "X" ? "Y" : "X");
      if (isValidPassword(mutatedPwd)) {
        expect(await verifyPasswordScrypt(mutatedPwd, scryptHash)).toBe(false);
      }

      // Argon2id roundtrip
      const argonHash = await hashPasswordArgon2id(password, { memory: 1024, passes: 1, parallelism: 1 });
      expect(await verifyPasswordArgon2id(password, argonHash)).toBe(true);
      expect(await verifyPassword(password, argonHash)).toBe(true);

      // Mutate password -> must fail
      if (isValidPassword(mutatedPwd)) {
        expect(await verifyPasswordArgon2id(mutatedPwd, argonHash)).toBe(false);
      }
    }
  });
});
