import { useContext } from "react";
import { ZolexoraAuthContext, type ZolexoraAuthContextValue } from "./context.js";

/**
 * Primary authentication hook.
 * Returns { user, org, role, loading, error, signIn, orgSignIn, adminSignIn, signOut, ... }
 */
export function useAuth(): ZolexoraAuthContextValue {
  const ctx = useContext(ZolexoraAuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within a <ZolexoraAuthProvider>.");
  }
  return ctx;
}
