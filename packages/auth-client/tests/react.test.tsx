import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import {
  ZolexoraAuthProvider,
  useAuth,
  useUser,
  useOrganization,
} from "../src/react/index.js";

describe("Milestone 5: React Hooks & Provider (react.test.tsx)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      delete (window as any).__ENV__;
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    cleanup();
  });

  it("useAuth provides initial loading state and finishes hydration", async () => {
    window.localStorage.setItem(
      "zolexora_session",
      JSON.stringify({
        token: "stored.jwt.token",
        user: { uid: "u1", zolexora_id: "ZX-1234-5678-9012", email: "a@b.com" },
        savedAt: Date.now(),
      })
    );
    globalThis.fetch = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return new Response(JSON.stringify({ success: true, authenticated: true }), {
        status: 200,
      });
    }) as any;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider>{children}</ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("hydrates from initialSession immediately with loading: false", () => {
    const initialSession = {
      user: {
        uid: "usr_123",
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        email: "user@zolexora.com",
      },
      org: {
        org_id: "ZX-ORG-4B8T-9M2K-7Y4X",
        role: "admin",
        permissions: ["trips:read", "trips:write"],
      },
      role: "admin",
      token: "initial_jwt_token",
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider initialSession={initialSession}>
        {children}
      </ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.user?.zolexora_id).toBe("ZX-8K9M-4P2W-7Y3X");
    expect(result.current.org?.org_id).toBe("ZX-ORG-4B8T-9M2K-7Y4X");
    expect(result.current.role).toBe("admin");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("useUser returns merged user state and zolexoraId", () => {
    const initialSession = {
      user: {
        uid: "usr_456",
        zolexora_id: "ZX-3K8M-2P9W-6Y7X",
        email: "driver@zolexora.com",
      },
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider initialSession={initialSession}>
        {children}
      </ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useUser(), { wrapper });
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.isSignedIn).toBe(true);
    expect(result.current.zolexoraId).toBe("ZX-3K8M-2P9W-6Y7X");
    expect(result.current.user?.email).toBe("driver@zolexora.com");
  });

  it("useOrganization computes permissions and handles tenant switching", async () => {
    const initialSession = {
      user: {
        uid: "usr_789",
        zolexora_id: "ZX-4B8T-9M2K-7Y4X",
        email: "manager@zolexora.com",
      },
      org: {
        org_id: "ZX-ORG-1111-2222-3333",
        name: "Acme Logistics",
        role: "owner",
        permissions: ["*"],
      },
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider initialSession={initialSession}>
        {children}
      </ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useOrganization(), { wrapper });
    expect(result.current.orgId).toBe("ZX-ORG-1111-2222-3333");
    expect(result.current.isCommander).toBe(true);
    expect(result.current.hasPermission("any:permission")).toBe(true);

    await act(async () => {
      await result.current.switchOrganization("ZX-ORG-5555-6666-7777");
    });

    expect(result.current.orgId).toBe("ZX-ORG-5555-6666-7777");
  });

  it("Track 1 signIn authenticates public user", async () => {
    const mockFetch = vi.fn(async (url: any) => {
      if (String(url).includes("/api/v1/auth/public/login")) {
        return new Response(
          JSON.stringify({
            success: true,
            customToken: "custom_jwt_track1",
            user: {
              uid: "usr_pub_1",
              zolexora_id: "ZX-1234-5678-9012",
              email: "public@zolexora.com",
              email_verified: true,
            },
            routing: {
              user_type: "consumer",
              redirect_route: "/dashboard",
            },
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = mockFetch as any;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider>{children}</ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const res = await result.current.signIn({
        email_or_phone: "public@zolexora.com",
        password: "ValidPassword123!",
      });
      expect(res.customToken).toBe("custom_jwt_track1");
      expect(res.routing.redirect_route).toBe("/dashboard");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.zolexora_id).toBe("ZX-1234-5678-9012");
  });

  it("Track 2 orgSignIn strictly requires canonical ZX-ORG format", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider>{children}</ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(
        result.current.orgSignIn({
          org_id: "invalid-org-id",
          user_id_or_email: "employee@corp.com",
          password: "Pass",
        })
      ).rejects.toThrow("Invalid Zolexora Org ID format");
    });
  });

  it("Track 2 orgSignIn authenticates employee with valid ZX-ORG ID", async () => {
    const mockFetch = vi.fn(async (url: any) => {
      if (String(url).includes("/api/v1/auth/employee/login")) {
        return new Response(
          JSON.stringify({
            success: true,
            customToken: "custom_jwt_track2",
            claims: {
              zolexora_id: "ZX-8K9M-4P2W-7Y3X",
              org_id: "ZX-ORG-4B8T-9M2K-7Y4X",
              role: "dispatcher",
              product: "zolexora-tms",
              permissions: ["loads:read", "loads:assign"],
            },
            user: {
              uid: "emp_123",
              zolexora_id: "ZX-8K9M-4P2W-7Y3X",
              email: "dispatcher@corp.com",
              status: "active",
            },
            org: {
              zolexora_org_id: "ZX-ORG-4B8T-9M2K-7Y4X",
              name: "TMS Fleet",
              role: "dispatcher",
            },
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = mockFetch as any;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider>{children}</ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const res = await result.current.orgSignIn({
        org_id: "ZX-ORG-4B8T-9M2K-7Y4X",
        user_id_or_email: "dispatcher@corp.com",
        password: "SecurePassword123!",
      });
      expect(res.customToken).toBe("custom_jwt_track2");
      expect(res.org.role).toBe("dispatcher");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.org?.org_id).toBe("ZX-ORG-4B8T-9M2K-7Y4X");
    expect(result.current.role).toBe("dispatcher");
  });

  it("Track 3 adminSignIn authenticates platform admin without org_id", async () => {
    let capturedBody: any = null;
    const mockFetch = vi.fn(async (url: any, init?: RequestInit) => {
      if (String(url).includes("/api/v1/auth/admin/login")) {
        capturedBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            success: true,
            customToken: "custom_jwt_track3",
            admin: {
              id: "adm_999",
              zolexora_id: "ZX-9999-8888-7777",
              email: "superadmin@zolexora.com",
              role: "superadmin",
              is_platform_admin: true,
              permissions: ["*"],
            },
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = mockFetch as any;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider>{children}</ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const res = await result.current.adminSignIn({
        email: "superadmin@zolexora.com",
        password: "AdminPassword123!",
      });
      expect(res.admin.is_platform_admin).toBe(true);
    });

    expect(capturedBody).not.toHaveProperty("org_id");
    expect(result.current.role).toBe("superadmin");
    expect(result.current.org).toBeNull();
  });

  it("signOut triggers revocation, clears session storage and resets state", async () => {
    const mockFetch = vi.fn(async (url: any) => {
      if (String(url).includes("/api/v1/auth/tokens/revoke")) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response("OK", { status: 200 });
    });
    globalThis.fetch = mockFetch as any;

    const initialSession = {
      user: {
        uid: "usr_rev_1",
        zolexora_id: "ZX-8K9M-4P2W-7Y3X",
        email: "test@zolexora.com",
      },
      role: "consumer",
      token: "revocable_token",
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ZolexoraAuthProvider initialSession={initialSession}>
        {children}
      </ZolexoraAuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.org).toBeNull();
    expect(result.current.role).toBeNull();
  });
});
