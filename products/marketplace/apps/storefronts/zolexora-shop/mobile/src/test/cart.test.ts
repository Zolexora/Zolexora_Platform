import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore, useAuthStore } from "../store";
import * as SecureStore from "expo-secure-store";
import { STOREFRONT_KEY, validateStorefrontKey } from "../config/storefront";
import { STOREFRONT_HEADER } from "@zolexora/shared-api/storefront";
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
    useAuthStore.setState({ token: null, user: null });
  });

  it("should login and set token/user and call SecureStore", async () => {
    const fakeToken = "test-token-123";
    const fakeUser = { id: "1", name: "John Doe", role: "buyer" };

    await useAuthStore.getState().login(fakeToken, fakeUser);

    expect(useAuthStore.getState().token).toBe(fakeToken);
    expect(useAuthStore.getState().user).toEqual(fakeUser);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("z_token", fakeToken);
  });

  it("should logout and clear token/user and call SecureStore", async () => {
    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("z_token");
  });
});
