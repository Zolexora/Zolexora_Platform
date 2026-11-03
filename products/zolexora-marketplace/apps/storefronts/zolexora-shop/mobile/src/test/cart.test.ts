import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCartStore, useAuthStore } from "../store";
import { signOut } from "@zolexora/marketplace-mobile-sign-in";
import { STOREFRONT_KEY, validateStorefrontKey } from "../config/storefront";
import { STOREFRONT_HEADER } from "@zolexora/marketplace-shared-api/storefront";
import { applyStorefrontHeader } from "../lib/api";

describe("Storefront identity", () => {
  it("is compiled for Zolexora Shop and rejects conflicts", () => {
    expect(STOREFRONT_KEY).toBe("zolexora-shop");
    expect(() => validateStorefrontKey("mahila-madel")).toThrow("Expected storefront zolexora-shop");
  });

  it("forces the canonical request header over caller input", () => {
    const headers: Record<string, unknown> = { [STOREFRONT_HEADER]: "mahila-madel" };
    applyStorefrontHeader(headers);
    expect(headers[STOREFRONT_HEADER]).toBe("zolexora-shop");
  });
});

describe("Cart Store", () => {
  beforeEach(() => {
    useCartStore.setState({ count: 0 });
  });

  it("should initialize with count 0", () => {
    const state = useCartStore.getState();
    expect(state.count).toBe(0);
  });

  it("should increment the count", () => {
    useCartStore.getState().increment();
    expect(useCartStore.getState().count).toBe(1);

    useCartStore.getState().increment();
    expect(useCartStore.getState().count).toBe(2);
  });

  it("should set the count directly", () => {
    useCartStore.getState().setCount(5);
    expect(useCartStore.getState().count).toBe(5);
  });
});

describe("Auth Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: "1", name: "John Doe" } });
  });

  it("has no user without an auth-service session", async () => {
    await useAuthStore.getState().fetchMe();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("signs out at the auth service and clears the user", async () => {
    await useAuthStore.getState().logout();
    expect(signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
