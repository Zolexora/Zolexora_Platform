import { describe, it, expect } from "vitest";
import {
  formatZolexoraHandle,
  generatePartnerZolexoraId,
  generateZolexoraHandle,
  isValidZolexoraHandle,
  isValidZolexoraId,
  isValidZolexoraOrgId,
  normalizeZolexoraId,
  normalizeZolexoraOrgId,
  ZOLEXORA_HANDLE_REGEX,
  ZOLEXORA_PARTNER_HANDLE_REGEX,
} from "../src/zolexora-id";

describe("Zolexora Handle & Partner ID (@zolexora/utils)", () => {
  it("formats and validates chosen <userid>@zolexora.com handles", () => {
    const handle = formatZolexoraHandle("Infosys_India");
    expect(handle).toBe("infosys_india@zolexora.com");
    expect(handle).toMatch(ZOLEXORA_HANDLE_REGEX);
    expect(isValidZolexoraHandle(handle)).toBe(true);
    expect(isValidZolexoraId(handle)).toBe(true);
    expect(isValidZolexoraOrgId(handle)).toBe(true);
    expect(normalizeZolexoraId("Infosys_India@Zolexora.com")).toBe("infosys_india@zolexora.com");
    expect(normalizeZolexoraOrgId("Infosys_India@Zolexora.com")).toBe("infosys_india@zolexora.com");
  });

  it("generates valid partner and user @zolexora.com handles", () => {
    const clientId = generatePartnerZolexoraId("client");
    const vendorId = generatePartnerZolexoraId("vendor");
    const spId = generatePartnerZolexoraId("service_provider");
    const userId = generateZolexoraHandle("u");

    expect(clientId).toMatch(/^c[0-9]{8}@zolexora\.com$/);
    expect(vendorId).toMatch(/^v[0-9]{8}@zolexora\.com$/);
    expect(spId).toMatch(/^sp[0-9]{8}@zolexora\.com$/);
    expect(clientId).toMatch(ZOLEXORA_PARTNER_HANDLE_REGEX);
    expect(vendorId).toMatch(ZOLEXORA_PARTNER_HANDLE_REGEX);
    expect(spId).toMatch(ZOLEXORA_PARTNER_HANDLE_REGEX);
    expect(userId).toMatch(/^u[0-9]{8}@zolexora\.com$/);
    expect(isValidZolexoraId(clientId)).toBe(true);
    expect(isValidZolexoraId(vendorId)).toBe(true);
    expect(isValidZolexoraId(spId)).toBe(true);
  });

  it("rejects legacy ZX- and malformed IDs", () => {
    expect(isValidZolexoraId("")).toBe(false);
    expect(isValidZolexoraId("ZX-8K9M-4P2W-7Y3X")).toBe(false);
    expect(isValidZolexoraOrgId("ZX-ORG-8K9M-4P2W-7Y3X")).toBe(false);
    expect(isValidZolexoraId("ab@zolexora.com")).toBe(false); // < 3 chars
    expect(() => normalizeZolexoraId("ZX-8K9M-4P2W-7Y3X")).toThrow();
    expect(() => normalizeZolexoraOrgId("ZX-ORG-8K9M-4P2W-7Y3X")).toThrow();
    expect(() => formatZolexoraHandle("a")).toThrow();
  });
});
