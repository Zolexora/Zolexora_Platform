import { createContext, type Context } from "react";
import type {
  ZolexoraUser,
  ZolexoraOrganization,
  SignInParams,
  OrgSignInParams,
  AdminSignInParams,
} from "../types.js";

export interface ZolexoraAuthContextValue {
  user: ZolexoraUser | null;
  org: ZolexoraOrganization | null;
  role: string | null;
  loading: boolean;
  error: Error | null;

  signIn: (
    params: SignInParams
  ) => Promise<{ user: ZolexoraUser; customToken: string; routing: any }>;
  /** Stores a Track 1 session returned by the auth service (used by usePublicSignIn). */
  applySession: (data: { customToken: string; user: any; routing?: { user_type?: string } }) => ZolexoraUser;
  orgSignIn: (
    params: OrgSignInParams
  ) => Promise<{ user: ZolexoraUser; org: ZolexoraOrganization; customToken: string }>;
  adminSignIn: (
    params: AdminSignInParams
  ) => Promise<{ admin: any; customToken: string }>;
  signOut: () => Promise<void>;

  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  switchOrganization: (orgId: string) => Promise<void>;
  clearError: () => void;

  firebaseUser: any | null;
  isAuthenticated: boolean;
}

// One shared instance even when bundled into several entry points (react, public-sign-in).
const g = globalThis as { __zolexoraAuthContext?: Context<ZolexoraAuthContextValue | null> };
export const ZolexoraAuthContext = (g.__zolexoraAuthContext ??= createContext<ZolexoraAuthContextValue | null>(null));
