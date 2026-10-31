import { describe, it, expect } from "vitest";
import {
  generateZolexoraId,
  isValidZolexoraId,
  normalizeZolexoraId,
  generateZolexoraOrgId,
  isValidZolexoraOrgId,
  normalizeZolexoraOrgId,
  ZOLEXORA_ID_REGEX,
  ZOLEXORA_ORG_ID_REGEX,
  CROCKFORD_BASE32_ALPHABET,
} from "../src/zolexora-id";

describe("Zolexora ID & Org ID Generation (@zolexora/utils)", () => {
  it("generates valid individual user Zolexora IDs with canonical ZX- prefix", () => {
    const id = generateZolexoraId();
    expect(id).toMatch(ZOLEXORA_ID_REGEX);
    expect(isValidZolexoraId(id)).toBe(true);
    expect(normalizeZolexoraId(id.toLowerCase())).toBe(id);
  });

  it("generates valid organization Zolexora IDs with canonical ZX-ORG- prefix", () => {
    const orgId = generateZolexoraOrgId();
    expect(orgId).toMatch(ZOLEXORA_ORG_ID_REGEX);
    expect(isValidZolexoraOrgId(orgId)).toBe(true);
    expect(normalizeZolexoraOrgId(orgId.toLowerCase())).toBe(orgId);
  });

  it("differentiates user IDs from organization IDs correctly", () => {
    const userId = generateZolexoraId();
    const orgId = generateZolexoraOrgId();

    expect(isValidZolexoraId(userId)).toBe(true);
    expect(isValidZolexoraOrgId(userId)).toBe(false);

    expect(isValidZolexoraOrgId(orgId)).toBe(true);
    expect(isValidZolexoraId(orgId)).toBe(false);
  });

  it("never contains ambiguous characters (0, O, 1, I)", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateZolexoraId();
      const orgId = generateZolexoraOrgId();
      expect(id).not.toMatch(/[01OI]/);
      expect(orgId.replace("ZX-ORG-", "")).not.toMatch(/[01OI]/);
    }
  });

  it("has exactly 32 Crockford characters", () => {
    expect(CROCKFORD_BASE32_ALPHABET.length).toBe(32);
    expect(CROCKFORD_BASE32_ALPHABET).not.toMatch(/[01OI]/);
  });

  it("strictly rejects malformed user IDs", () => {
    expect(isValidZolexoraId("")).toBe(false);
    expect(isValidZolexoraId("ZX-1234")).toBe(false);
    expect(isValidZolexoraId("USER-8K9M-4P2W-7Y3X")).toBe(false);
    expect(isValidZolexoraId("ZX-0000-IIII-OOOO")).toBe(false); // 0, I, O not allowed
    expect(isValidZolexoraId("ZX-8K9M-4P2W-7Y3X-EXTRA")).toBe(false);
    expect(() => normalizeZolexoraId("INVALID-ID")).toThrow();
  });

  it("strictly rejects malformed organization IDs", () => {
    expect(isValidZolexoraOrgId("")).toBe(false);
    expect(isValidZolexoraOrgId("ORG-4B8T-9M2K-7Y1X")).toBe(false);
    expect(isValidZolexoraOrgId("ZX-4B8T-9M2K-7Y1X")).toBe(false);
    expect(isValidZolexoraOrgId("ZX-ORG-0000-IIII-OOOO")).toBe(false); // 0, I, O not allowed
    expect(isValidZolexoraOrgId("ZX-ORG-4B8T-9M2K-7Y1")).toBe(false); // too short
    expect(() => normalizeZolexoraOrgId("ZX-ORG-BAD")).toThrow();
  });
});
