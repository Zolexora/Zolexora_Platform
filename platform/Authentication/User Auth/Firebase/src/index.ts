export type {
  FirebaseClientConfig,
  MarketplaceSession,
  SessionExchangeOptions,
  ZolexoraUserProfile,
  ZolexoraOrgProfile,
  ZolexoraAuthSession,
} from "./types";

export { exchangeFirebaseToken } from "./session";

export {
  generateZolexoraId,
  isValidZolexoraId,
  normalizeZolexoraId,
  generateZolexoraOrgId,
  isValidZolexoraOrgId,
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

export {
  ZolexoraAuthCard,
  ZolexoraSignIn,
  ZolexoraSignUp,
  ZolexoraOnboarding,
  OtpInput,
  PasswordRequirements,
  checkPasswordRules,
  BuildingIcon,
  type ZolexoraAuthCardProps,
  type ZolexoraSignInProps,
  type ZolexoraSignUpProps,
  type ZolexoraOnboardingProps,
  type AuthMode,
  type OtpInputProps,
  type PasswordRulesResult,
} from "./ui";

