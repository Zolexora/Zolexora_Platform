import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { isValidZolexoraOrgId } from "@zolexora/utils/zolexora-id";
import {
  DEFAULT_AUTH_SERVICE_URL,
  SESSION_STORAGE_KEY,
  SESSION_EXPIRED_EVENT,
  HEADER_AUTHORIZATION,
  HEADER_TURNSTILE_TOKEN,
} from "../constants.js";
import { resolveAuthUrl } from "../env.js";
import type {
  ZolexoraUser,
  ZolexoraOrganization,
  SignInParams,
  OrgSignInParams,
  AdminSignInParams,
  StoredSession,
} from "../types.js";
import { ZolexoraAuthContext, type ZolexoraAuthContextValue } from "./context.js";

function safeGetStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {}
  return null;
}

function loadSession(): StoredSession | null {
  const storage = safeGetStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    if (session) {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      storage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {}
}

export interface ZolexoraAuthProviderProps {
  children: ReactNode;
  authUrl?: string;
  product?: string;
  initialSession?: {
    token?: string | null;
    user?: ZolexoraUser | null;
    org?: ZolexoraOrganization | null;
    role?: string | null;
  };
  firebaseAuth?: any;
  onAuthStateChange?: (
    user: ZolexoraUser | null,
    org: ZolexoraOrganization | null
  ) => void;
}

export function ZolexoraAuthProvider({
  children,
  authUrl,
  product = "zolexora-platform",
  initialSession,
  firebaseAuth,
  onAuthStateChange,
}: ZolexoraAuthProviderProps) {
  const baseUrl = useMemo(() => resolveAuthUrl(authUrl), [authUrl]);

  const [user, setUser] = useState<ZolexoraUser | null>(
    () => initialSession?.user ?? null
  );
  const [org, setOrg] = useState<ZolexoraOrganization | null>(
    () => initialSession?.org ?? null
  );
  const [role, setRole] = useState<string | null>(
    () => initialSession?.role ?? null
  );
  const [token, setToken] = useState<string | null>(
    () => initialSession?.token ?? null
  );
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !initialSession?.user);
  const [error, setError] = useState<Error | null>(null);

  // Mount session hydration in browser
  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const stored = loadSession();
      if (!stored || !stored.token) {
        if (isMounted) setLoading(false);
        return;
      }

      // Check client-side token validity
      try {
        const parts = stored.token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            typeof atob !== "undefined"
              ? atob(parts[1]!)
              : Buffer.from(parts[1]!, "base64").toString("utf-8")
          );
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && now >= payload.exp) {
            saveSession(null);
            if (isMounted) {
              setUser(null);
              setOrg(null);
              setRole(null);
              setToken(null);
              setLoading(false);
            }
            return;
          }
        }
      } catch {}

      // Optional live session introspection with auth-service
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
          headers: { [HEADER_AUTHORIZATION]: `Bearer ${stored.token}` },
        });

        if (res.ok) {
          if (isMounted) {
            setUser(stored.user);
            setOrg(stored.org);
            setRole(stored.role);
            setToken(stored.token);
            onAuthStateChange?.(stored.user, stored.org);
          }
        } else if (res.status === 401) {
          saveSession(null);
          if (isMounted) {
            setUser(null);
            setOrg(null);
            setRole(null);
            setToken(null);
            onAuthStateChange?.(null, null);
          }
        }
      } catch {
        // Network offline or auth-service unreachable: retain cached session gracefully
        if (isMounted) {
          setUser(stored.user);
          setOrg(stored.org);
          setRole(stored.role);
          setToken(stored.token);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    hydrate();

    // Cross-tab / session expired listener
    const handleExpired = () => {
      saveSession(null);
      if (isMounted) {
        setUser(null);
        setOrg(null);
        setRole(null);
        setToken(null);
        onAuthStateChange?.(null, null);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    }

    // Firebase Auth listener if active
    let unsubscribeFirebase: (() => void) | undefined;
    if (firebaseAuth?.onAuthStateChanged) {
      unsubscribeFirebase = firebaseAuth.onAuthStateChanged((fbUser: any) => {
        if (isMounted) setFirebaseUser(fbUser);
      });
    }

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      }
      if (unsubscribeFirebase) unsubscribeFirebase();
    };
  }, [baseUrl, firebaseAuth, onAuthStateChange]);

  // Track 1 Login
  /** Stores a Track 1 session returned by the auth service (password login or Firebase sign-in). */
  const applySession = useCallback(
    (data: { customToken: string; user: any; routing?: { user_type?: string } }): ZolexoraUser => {
      const newUser: ZolexoraUser = {
        uid: data.user.uid,
        zolexora_id: data.user.zolexora_id,
        email: data.user.email,
        email_verified: data.user.email_verified,
      };
      const resolvedRole = data.routing?.user_type === "consumer" ? "consumer" : "member";
      setUser(newUser);
      setOrg(null);
      setRole(resolvedRole);
      setToken(data.customToken);
      saveSession({ token: data.customToken, user: newUser, org: null, role: resolvedRole, savedAt: Date.now() });
      onAuthStateChange?.(newUser, null);
      return newUser;
    },
    [onAuthStateChange]
  );

  const signIn = useCallback(
    async (params: SignInParams) => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/public/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(params.turnstileToken
              ? { [HEADER_TURNSTILE_TOKEN]: params.turnstileToken }
              : {}),
            "X-Target-Product": params.product || product,
          },
          body: JSON.stringify({
            ...(/^\+?[\d\s\-()]{8,}$/.test(params.email_or_phone.trim())
              ? { phone_number: params.email_or_phone }
              : { email: params.email_or_phone }),
            password: params.password,
            product: params.product || product,
            turnstile_token: params.turnstileToken,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || data.error?.message || "Sign in failed");
        }

        const newUser = applySession(data);
        return {
          user: newUser,
          customToken: data.customToken,
          routing: data.routing,
        };
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, product, firebaseAuth, applySession]
  );

  // Track 2 Org Employee Login
  const orgSignIn = useCallback(
    async (params: OrgSignInParams) => {
      setError(null);
      setLoading(true);
      try {
        // Canonical Crockford Base32 Org ID validation
        const orgId = params.org_id.trim().toUpperCase();
        if (!isValidZolexoraOrgId(orgId)) {
          throw new Error(
            `Invalid Zolexora Org ID format: "${params.org_id}". Expected ZX-ORG-XXXX-XXXX-XXXX`
          );
        }

        const res = await fetch(`${baseUrl}/api/v1/auth/employee/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(params.turnstileToken
              ? { [HEADER_TURNSTILE_TOKEN]: params.turnstileToken }
              : {}),
          },
          body: JSON.stringify({
            product: params.product || product,
            org_id: orgId,
            user_id_or_email: params.user_id_or_email,
            password: params.password,
            turnstile_token: params.turnstileToken,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(
            data.message || data.error?.message || "Employee login failed"
          );
        }

        const newUser: ZolexoraUser = {
          uid: data.user.uid,
          zolexora_id: data.user.zolexora_id,
          email: data.user.email,
          status: data.user.status,
        };

        const newOrg: ZolexoraOrganization = {
          org_id: data.claims.org_id,
          zolexora_org_id: data.claims.org_id,
          name: data.org?.name || data.claims.org_id,
          role: data.claims.role,
          permissions: data.claims.permissions || [],
        };

        if (firebaseAuth?.signInWithCustomToken) {
          await firebaseAuth.signInWithCustomToken(data.customToken);
        }

        setUser(newUser);
        setOrg(newOrg);
        setRole(data.claims.role);
        setToken(data.customToken);

        saveSession({
          token: data.customToken,
          user: newUser,
          org: newOrg,
          role: data.claims.role,
          savedAt: Date.now(),
        });

        onAuthStateChange?.(newUser, newOrg);
        return { user: newUser, org: newOrg, customToken: data.customToken };
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, product, firebaseAuth, onAuthStateChange]
  );

  // Track 3 Platform Admin Login
  const adminSignIn = useCallback(
    async (params: AdminSignInParams) => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(params.turnstileToken
              ? { [HEADER_TURNSTILE_TOKEN]: params.turnstileToken }
              : {}),
          },
          body: JSON.stringify({
            username_or_email: params.email,
            password: params.password,
            turnstile_token: params.turnstileToken,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(
            data.message || data.error?.message || "Platform Admin login failed"
          );
        }

        const newAdmin: ZolexoraUser = {
          uid: data.admin.id,
          zolexora_id: data.admin.zolexora_id,
          email: data.admin.email,
          is_platform_admin: true,
        };

        if (firebaseAuth?.signInWithCustomToken) {
          await firebaseAuth.signInWithCustomToken(data.customToken);
        }

        setUser(newAdmin);
        setOrg(null);
        setRole("superadmin");
        setToken(data.customToken);

        saveSession({
          token: data.customToken,
          user: newAdmin,
          org: null,
          role: "superadmin",
          savedAt: Date.now(),
        });

        onAuthStateChange?.(newAdmin, null);
        return { admin: data.admin, customToken: data.customToken };
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, firebaseAuth, onAuthStateChange]
  );

  // Immediate Sign Out with Backend Revocation
  const signOut = useCallback(async () => {
    try {
      if (user?.uid && token) {
        // Trigger backend token revocation
        await fetch(`${baseUrl}/api/v1/auth/tokens/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json", [HEADER_AUTHORIZATION]: `Bearer ${token}` },
          body: JSON.stringify({
            uid: user.uid,
            reason: "user_logout",
            revocation_type: "user_all_tokens",
          }),
        }).catch(() => {});
      }

      if (firebaseAuth?.signOut) {
        await firebaseAuth.signOut().catch(() => {});
      }
    } finally {
      saveSession(null);
      setUser(null);
      setOrg(null);
      setRole(null);
      setToken(null);
      setError(null);
      setFirebaseUser(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
      onAuthStateChange?.(null, null);
    }
  }, [baseUrl, user?.uid, token, firebaseAuth, onAuthStateChange]);

  const getToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (firebaseAuth?.currentUser?.getIdToken) {
        return firebaseAuth.currentUser.getIdToken(forceRefresh);
      }
      return token;
    },
    [firebaseAuth, token]
  );

  const switchOrganization = useCallback(async (orgId: string) => {
    setOrg((prev) =>
      prev
        ? { ...prev, org_id: orgId, zolexora_org_id: orgId }
        : { org_id: orgId, role: "member", permissions: [] }
    );
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<ZolexoraAuthContextValue>(
    () => ({
      user,
      org,
      role,
      loading,
      error,
      signIn,
      applySession,
      orgSignIn,
      adminSignIn,
      signOut,
      getToken,
      switchOrganization,
      clearError,
      firebaseUser,
      isAuthenticated: !!user,
    }),
    [
      user,
      org,
      role,
      loading,
      error,
      signIn,
      applySession,
      orgSignIn,
      adminSignIn,
      signOut,
      getToken,
      switchOrganization,
      clearError,
      firebaseUser,
    ]
  );

  return (
    <ZolexoraAuthContext.Provider value={value}>
      {children}
    </ZolexoraAuthContext.Provider>
  );
}
