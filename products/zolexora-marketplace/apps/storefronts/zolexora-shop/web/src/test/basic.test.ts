import { describe, it, expect } from "vitest";
import { STOREFRONT_HEADER, STOREFRONT_KEYS, isStorefrontKey, parsePublicStorefront } from "@zolexora/shared-api/storefront";
import { applyStorefrontHeader } from "@/lib/api";

describe("Simple Test", () => {
  it("should pass", () => {
    expect(1 + 1).toBe(2);
  });
});

describe("storefront API contract", () => {
  it("uses only the canonical public keys and header", () => {
    expect(STOREFRONT_KEYS).toEqual(["zolexora-shop", "mahila-madel"]);
    expect(STOREFRONT_HEADER).toBe("X-Storefront-Key");
    expect(isStorefrontKey("zolexora-shop")).toBe(true);
    expect(isStorefrontKey("unknown")).toBe(false);
  });

  it("forces the compiled Zolexora header over caller input", () => {
    const headers: Record<string, unknown> = { [STOREFRONT_HEADER]: "mahila-madel" };
    applyStorefrontHeader(headers);
    expect(headers[STOREFRONT_HEADER]).toBe("zolexora-shop");
  });

  it("rejects malformed public responses without payment fields in the contract", () => {
    expect(() => parsePublicStorefront({ key: "unknown" })).toThrow("Invalid storefront response");
    const parsed = parsePublicStorefront({
      key: "zolexora-shop", display_name: "Zolexora Shop", canonical_host: "shop.zolexora.com", currency: "INR", locale: "en-IN",
    });
    expect(Object.keys(parsed)).not.toContain("payment_provider");
  });
});
