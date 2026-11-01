import { describe, it, expect } from "vitest";
import {
  generateZolexoraId,
  isValidZolexoraId,
  normalizeZolexoraId,
  generateZolexoraOrgId,
  isValidZolexoraOrgId,
} from "../src/zolexora-id";

describe("Zolexora ID & Org ID Generation", () => {
  it("generates valid individual user Zolexora IDs with canonical ZX- prefix", () => {
    const id = generateZolexoraId();
    expect(id).toMatch(/^ZX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(isValidZolexoraId(id)).toBe(true);
    expect(normalizeZolexoraId(id.toLowerCase())).toBe(id);
  });

  it("generates valid organization Zolexora IDs with canonical ZX-ORG- prefix", () => {
    const orgId = generateZolexoraOrgId();
    expect(orgId).toMatch(/^ZX-ORG-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(isValidZolexoraOrgId(orgId)).toBe(true);
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
});
