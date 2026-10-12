import { createSupabaseAuthClient } from "./client";
import type { AuthStorage, SupabaseAuthConfig } from "./types";

/** Supply Expo SecureStore or AsyncStorage so sessions persist on device. */
export function createSupabaseNativeAuthClient(config: SupabaseAuthConfig, storage: AuthStorage) {
  return createSupabaseAuthClient(config, {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  });
}
