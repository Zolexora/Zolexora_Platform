import { useAuth } from "./use-auth.js";

/**
 * User identity hook.
 * Returns Firebase user + Zolexora profile merged.
 */
export function useUser() {
  const { user, firebaseUser, loading } = useAuth();
  return {
    user,
    firebaseUser,
    zolexoraId: user?.zolexora_id ?? null,
    isLoaded: !loading,
    isSignedIn: !!user,
  };
}
