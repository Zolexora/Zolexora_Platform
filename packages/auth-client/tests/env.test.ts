import { describe, it, expect, beforeEach, vi } from "vitest";
import { getRuntimeEnv, resolveAuthUrl } from "../src/env.js";

describe("Milestone 5: Environment Resolver (env.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      delete (window as any).__ENV__;
    }
    delete process.env.AUTH_SERVICE_URL;
    delete process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
    delete process.env.VITE_AUTH_SERVICE_URL;
    delete process.env.NEXT_PUBLIC_AUTH_URL;
    delete process.env.VITE_AUTH_URL;
    delete process.env.ZOLEXORA_AUTH_URL;
  });

  it("returns default fallback http://localhost:3081 when no environment variables are set", () => {
    expect(resolveAuthUrl()).toBe("http://localhost:3081");
  });

  it("resolves process.env.NEXT_PUBLIC_AUTH_SERVICE_URL", () => {
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL = "https://auth-next.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://auth-next.zolexora.com");
  });

  it("resolves process.env.VITE_AUTH_SERVICE_URL", () => {
    process.env.VITE_AUTH_SERVICE_URL = "https://auth-vite.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://auth-vite.zolexora.com");
  });

  it("prioritizes window.__ENV__ over process.env", () => {
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL = "https://auth-process.zolexora.com";
    (window as any).__ENV__ = {
      AUTH_SERVICE_URL: "https://auth-runtime.zolexora.com",
    };
    expect(resolveAuthUrl()).toBe("https://auth-runtime.zolexora.com");
  });

  it("prefers customUrl argument when provided and trims trailing slashes", () => {
    (window as any).__ENV__ = {
      AUTH_SERVICE_URL: "https://auth-runtime.zolexora.com",
    };
    expect(resolveAuthUrl("https://override.zolexora.com///")).toBe(
      "https://override.zolexora.com"
    );
  });

  it("SSR safety: does not crash when window is undefined", () => {
    const originalWindow = globalThis.window;
    try {
      delete (globalThis as any).window;
      expect(() => getRuntimeEnv("AUTH_SERVICE_URL")).not.toThrow();
      expect(resolveAuthUrl()).toBe("http://localhost:3081");
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
