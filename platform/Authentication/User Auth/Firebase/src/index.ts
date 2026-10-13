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
export { getWebFirebaseAuth, webAuth, buildZolexoraProfile } from "./web";

