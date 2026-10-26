"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { getWebFirebaseAuth, webAuth, buildZolexoraProfile } from "./web";
import type { FirebaseClientConfig, ZolexoraUserProfile, ZolexoraOrgProfile } from "./types";
import { generateZolexoraOrgId } from "./zolexora-id";

export interface ZolexoraAuthContextValue {
  // Authentication State
  isSignedIn: boolean;
  isLoaded: boolean;
  user: ZolexoraUserProfile | null;
  firebaseUser: User | null;
  token: string | null;
  auth: Auth;

  // Fresh token retrieval
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;

  // High-Level Auth Actions
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ user: User; idToken: string; profile: ZolexoraUserProfile; zolexoraId: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ user: User; idToken: string; profile: ZolexoraUserProfile; zolexoraId: string }>;
  signInWithGoogle: () => Promise<{
    user: User;
    idToken: string;
    profile: ZolexoraUserProfile;
    zolexoraId: string;
  }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;

  // Dual Profile Model: Organization / Workspace State
  org: ZolexoraOrgProfile | null;
  organisations: ZolexoraOrgProfile[];
  activeOrgId: string | null;
  setActiveOrgId: (orgId: string | null) => void;
  createOrganisation: (name: string, metadata?: Record<string, unknown>) => Promise<ZolexoraOrgProfile>;
  switchOrganisation: (orgId: string) => void;

  // Multi-Tenant RBAC Context (policed later)
  isCommander: boolean;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  setPermissions: (permissions: string[]) => void;
  setIsCommander: (isCommander: boolean) => void;
}

export const ZolexoraAuthContext = createContext<ZolexoraAuthContextValue | null>(null);

export interface ZolexoraAuthProviderProps {
  /** Optional custom Firebase config; if omitted, automatically reads env vars */
  config?: Partial<FirebaseClientConfig>;
  /** Optional pre-initialized Auth instance */
  authInstance?: Auth;
  /** Optional initial active organization ID */
  initialOrgId?: string;
  /** Optional initial organisations */
  initialOrgs?: ZolexoraOrgProfile[];
  /** Optional callback fired when auth state resolves */
  onAuthStateChange?: (user: ZolexoraUserProfile | null, org?: ZolexoraOrgProfile | null) => void;
  children: ReactNode;
}

/**
 * Universal Authentication Provider.
 * Wrap your application root with this provider for zero-configuration, native authentication.
 */
export function ZolexoraAuthProvider({
  config,
  authInstance,
  initialOrgId,
  initialOrgs,
  onAuthStateChange,
  children,
}: ZolexoraAuthProviderProps) {
  const auth = useMemo(
    () => authInstance || getWebFirebaseAuth(config),
    [authInstance, config]
  );

  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [user, setUser] = useState<ZolexoraUserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [organisations, setOrganisations] = useState<ZolexoraOrgProfile[]>(() => {
    if (initialOrgs && initialOrgs.length > 0) return initialOrgs;
    if (typeof localStorage !== "undefined") {
      try {
        const stored = localStorage.getItem("zolexora_org_profiles");
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => {
    if (initialOrgId) return initialOrgId;
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("zolexora_active_org_id");
    }
    return null;
  });

  const [org, setOrg] = useState<ZolexoraOrgProfile | null>(() => {
    const currentOrgId = initialOrgId || (typeof localStorage !== "undefined" ? localStorage.getItem("zolexora_active_org_id") : null);
    if (!currentOrgId) return null;
    const match = organisations.find((o) => o.zolexora_org_id === currentOrgId || o.id === currentOrgId);
    if (match) return match;
    const storedName = typeof localStorage !== "undefined" ? localStorage.getItem("zolexora_org_name") : null;
    if (storedName) {
      return {
        id: currentOrgId,
        zolexora_org_id: currentOrgId,
        name: storedName,
        slug: storedName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        role: "owner",
        permissions: ["*"],
      };
    }
    return null;
  });

  const [permissions, setPermissions] = useState<string[]>([]);
  const [isCommander, setIsCommander] = useState(false);

  const setActiveOrgId = useCallback((orgId: string | null) => {
    setActiveOrgIdState(orgId);
    if (typeof localStorage !== "undefined") {
      if (orgId) {
        localStorage.setItem("zolexora_active_org_id", orgId);
      } else {
        localStorage.removeItem("zolexora_active_org_id");
        localStorage.removeItem("zolexora_org_name");
      }
    }
    if (orgId) {
      const match = organisations.find((o) => o.zolexora_org_id === orgId || o.id === orgId);
      if (match) {
        setOrg(match);
      }
    } else {
      setOrg(null);
    }
  }, [organisations]);

  const createOrganisation = useCallback(
    async (name: string, metadata?: Record<string, unknown>): Promise<ZolexoraOrgProfile> => {
      const cleanName = name.trim();
      const orgId = generateZolexoraOrgId();
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "org";
      const newOrg: ZolexoraOrgProfile = {
        id: orgId,
        zolexora_org_id: orgId,
        name: cleanName,
        slug,
        role: "owner",
        permissions: ["*"],
        created_at: new Date().toISOString(),
        metadata,
      };

      setOrganisations((prev) => {
        const next = [...prev.filter((o) => o.zolexora_org_id !== orgId), newOrg];
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("zolexora_org_profiles", JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      if (typeof localStorage !== "undefined") {
        localStorage.setItem("zolexora_active_org_id", orgId);
        localStorage.setItem("zolexora_org_name", cleanName);
      }

      setOrg(newOrg);
      setActiveOrgIdState(orgId);
      return newOrg;
    },
    []
  );

  const switchOrganisation = useCallback(
    (orgId: string) => {
      const match = organisations.find((o) => o.zolexora_org_id === orgId || o.id === orgId);
      if (match) {
        setOrg(match);
        setActiveOrgIdState(match.zolexora_org_id);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("zolexora_active_org_id", match.zolexora_org_id);
          localStorage.setItem("zolexora_org_name", match.name);
        }
      } else {
        setActiveOrgIdState(orgId);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("zolexora_active_org_id", orgId);
        }
      }
    },
    [organisations]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      setFirebaseUser(current);
      if (current) {
        try {
          const [idToken, profile] = await Promise.all([
            current.getIdToken(),
            buildZolexoraProfile(current),
          ]);
          setToken(idToken);
          setUser(profile);
          onAuthStateChange?.(profile, org);
        } catch {
          setToken(null);
          setUser(null);
          onAuthStateChange?.(null, null);
        }
      } else {
        setToken(null);
        setUser(null);
        onAuthStateChange?.(null, null);
      }
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, [auth, onAuthStateChange, org]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const res = await webAuth.signInWithEmail(auth, email, password);
      setToken(res.idToken);
      setUser(res.profile);
      setFirebaseUser(res.user);
      return res;
    },
    [auth]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await webAuth.createEmailAccount(auth, email, password, displayName);
      setToken(res.idToken);
      setUser(res.profile);
      setFirebaseUser(res.user);
      return res;
    },
    [auth]
  );

  const signInWithGoogle = useCallback(async () => {
    const res = await webAuth.signInWithGoogle(auth);
    setToken(res.idToken);
    setUser(res.profile);
    setFirebaseUser(res.user);
    return res;
  }, [auth]);

  const signOut = useCallback(async () => {
    await webAuth.signOut(auth);
    setToken(null);
    setUser(null);
    setFirebaseUser(null);
    setOrg(null);
    setActiveOrgId(null);
    setPermissions([]);
    setIsCommander(false);
  }, [auth, setActiveOrgId]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      await webAuth.sendPasswordReset(auth, email);
    },
    [auth]
  );

  const fetchIdToken = useCallback(
    async (forceRefresh = false) => {
      if (!auth.currentUser) return null;
      const freshToken = await auth.currentUser.getIdToken(forceRefresh);
      setToken(freshToken);
      return freshToken;
    },
    [auth]
  );

  const hasPermission = useCallback(
    (permission: string) => {
      if (isCommander) return true;
      return permissions.includes(permission);
    },
    [isCommander, permissions]
  );

  const value = useMemo<ZolexoraAuthContextValue>(
    () => ({
      isSignedIn: !!firebaseUser,
      isLoaded,
      user,
      firebaseUser,
      token,
      auth,
      getIdToken: fetchIdToken,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      org,
      organisations,
      activeOrgId,
      setActiveOrgId,
      createOrganisation,
      switchOrganisation,
      isCommander,
      permissions,
      hasPermission,
      setPermissions,
      setIsCommander,
    }),
    [
      firebaseUser,
      isLoaded,
      user,
      token,
      auth,
      fetchIdToken,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      org,
      organisations,
      activeOrgId,
      setActiveOrgId,
      createOrganisation,
      switchOrganisation,
      isCommander,
      permissions,
      hasPermission,
    ]
  );

  return (
    <ZolexoraAuthContext.Provider value={value}>
      {children}
    </ZolexoraAuthContext.Provider>
  );
}

/** Drop-in alias matching Firebase naming convention */
export const FirebaseAuthProvider = ZolexoraAuthProvider;

/**
 * Universal hook providing authentication state, identity, tokens, and actions.
 */
export function useAuth(): ZolexoraAuthContextValue {
  const ctx = useContext(ZolexoraAuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used within a <ZolexoraAuthProvider> (or <FirebaseAuthProvider>)."
    );
  }
  return ctx;
}

/**
 * Convenience hook for user identity and canonical Zolexora ID.
 */
export function useUser() {
  const { user, isLoaded, isSignedIn } = useAuth();
  return {
    user,
    zolexoraId: user?.zolexora_id ?? null,
    isLoaded,
    isSignedIn,
  };
}

/**
 * Convenience hook for active tenant scoping and RBAC permissions.
 */
export function useOrganization() {
  const {
    org,
    organisations,
    activeOrgId,
    setActiveOrgId,
    createOrganisation,
    switchOrganisation,
    isCommander,
    permissions,
    hasPermission,
    setPermissions,
    setIsCommander,
  } = useAuth();

  return {
    org,
    organization: org,
    organisations,
    organizations: organisations,
    activeOrgId,
    setActiveOrgId,
    createOrganisation,
    createOrganization: createOrganisation,
    switchOrganisation,
    switchOrganization: switchOrganisation,
    isCommander,
    permissions,
    hasPermission,
    setPermissions,
    setIsCommander,
  };
}

/**
 * Clerk-style component: renders children ONLY when signed in.
 */
export function SignedIn({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded || !isSignedIn) return null;
  return <>{children}</>;
}

/**
 * Clerk-style component: renders children ONLY when signed out.
 */
export function SignedOut({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded || isSignedIn) return null;
  return <>{children}</>;
}

/**
 * RBAC guard component: renders children only if user is authorized.
 */
export function Protect({
  permission,
  role,
  fallback = null,
  children,
}: {
  permission?: string;
  role?: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { isSignedIn, isLoaded, isCommander, hasPermission } = useAuth();
  if (!isLoaded || !isSignedIn) return <>{fallback}</>;
  if (isCommander) return <>{children}</>;
  if (role && role.toLowerCase() === "commander" && !isCommander) return <>{fallback}</>;
  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Headless/lightweight drop-in User badge with Zolexora ID and sign-out action.
 */
export function UserButton({
  className = "",
  showZolexoraId = true,
  showOrg = true,
}: {
  className?: string;
  showZolexoraId?: boolean;
  showOrg?: boolean;
}) {
  const { user, org, signOut } = useAuth();
  if (!user) return null;

  const initial = (user.display_name || user.email || "Z")[0]?.toUpperCase() || "Z";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.75rem",
        fontSize: "0.875rem",
      }}
      className={`zolexora-user-button ${className}`}
    >
      <div
        style={{
          width: "2rem",
          height: "2rem",
          borderRadius: "9999px",
          backgroundColor: "#4f46e5",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
        }}
      >
        {initial}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 500, color: "inherit" }}>
          {user.display_name?.split(" [")[0] || user.email}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          {showZolexoraId && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#818cf8",
              }}
            >
              {user.zolexora_id}
            </span>
          )}
          {showOrg && org && (
            <span
              style={{
                fontSize: "0.6875rem",
                padding: "0.05rem 0.35rem",
                borderRadius: "0.25rem",
                background: "rgba(99, 102, 241, 0.2)",
                color: "#a5b4fc",
                fontWeight: 600,
              }}
              title={org.zolexora_org_id}
            >
              {org.name}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        style={{
          marginLeft: "0.5rem",
          padding: "0.25rem 0.5rem",
          fontSize: "0.75rem",
          cursor: "pointer",
          borderRadius: "0.25rem",
          border: "1px solid rgba(255,255,255,0.2)",
          background: "transparent",
          color: "inherit",
        }}
        title="Sign Out"
      >
        Sign Out
      </button>
    </div>
  );
}
