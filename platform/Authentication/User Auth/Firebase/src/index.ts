export type {
  FirebaseClientConfig,
  MarketplaceSession,
  SessionExchangeOptions,
  ZolexoraUserProfile,
} from "./types";

export { exchangeFirebaseToken } from "./session";

export {
  generateZolexoraId,
  isValidZolexoraId,
  normalizeZolexoraId,
} from "./zolexora-id";

export {
  resolveFirebaseConfig,
  getWebFirebaseAuth,
  getIdToken,
  webAuth,
  buildZolexoraProfile,
} from "./web";

export {
  createZolexoraFetch,
  zolexoraFetch,
  HEADER_ZOLEXORA_ID,
  HEADER_ORGANISATION_ID,
  HEADER_AUTHORIZATION,
  type ZolexoraFetchOptions,
} from "./client";

export {
  ZolexoraAuthProvider,
  FirebaseAuthProvider,
  useAuth,
  useUser,
  useOrganization,
  SignedIn,
  SignedOut,
  Protect,
  UserButton,
  type ZolexoraAuthContextValue,
  type ZolexoraAuthProviderProps,
} from "./react";
