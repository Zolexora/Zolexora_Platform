import { createContext } from "react";
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

export const ZolexoraAuthContext =
  createContext<ZolexoraAuthContextValue | null>(null);
