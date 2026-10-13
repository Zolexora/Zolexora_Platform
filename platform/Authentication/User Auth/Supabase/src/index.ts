export { createSupabaseAuthClient } from "./client";
export { supabaseAuth } from "./auth";
export {
  createSupabaseNativeAuthClient,
  nativeAuth,
  createNativeMarketplaceAuth,
} from "./native";
export {
  createSupabaseBrowserAuthClient,
  createSupabaseServerAuthClient,
} from "./ssr";
export { getWebSupabaseAuth, webAuth, buildZolexoraProfile } from "./web";
export { exchangeSupabaseToken, exchangeFirebaseToken } from "./session";
export {
  generateZolexoraId,
  isValidZolexoraId,
  normalizeZolexoraId,
} from "./zolexora-id";
export type {
  AuthStorage,
  SupabaseAuthConfig,
  SupabaseAuthOptions,
  SupabaseAuthUserData,
  SupabaseClientConfig,
  ZolexoraUserProfile,
  MarketplaceSession,
  SessionExchangeOptions,
} from "./types";
