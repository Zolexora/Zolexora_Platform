export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
  measurementId?: string;
}

export type SignupMethod = 'google' | 'email' | 'mobile';

export type RegistrationStatus =
  | 'identity_pending'
  | 'contact_verification'
  | 'profile_pending'
  | 'finalizing'
  | 'active'
  | 'expired'
  | 'cancelled';

export type VerificationMethod =
  | 'firebase_pnv'
  | 'firebase_sms_otp'
  | 'custom_email_otp';

export type TargetPlatform = 'web' | 'android' | 'ios';

export interface VerificationResult {
  method: VerificationMethod;
  target: string;
  status: 'pending' | 'verified' | 'failed';
  verifiedAt?: string;
  claimToken?: string;
  metadata?: Record<string, unknown>;
}

/**
 * User Profile — Identity and credentials of the authenticated individual.
 */
export interface ZolexoraUserProfile {
  uid: string;
  zolexora_id: string; // Canonical ZX-XXXX-XXXX-XXXX
  email?: string | null;
  phone_number?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  email_verified: boolean;
  phone_verified?: boolean;
  onboarding_completed?: boolean;
  status?: 'active' | 'suspended' | 'pending';
  created_at?: string;
  updated_at?: string;
  providers?: string[];
}

/**
 * Org Profile — Identity, tenant ID, and RBAC scope of the active organisation.
 */
export interface ZolexoraOrgProfile {
  id: string;
  zolexora_org_id: string; // Canonical ZX-ORG-XXXX-XXXX-XXXX
  name: string;
  slug: string;
  role: "owner" | "admin" | "manager" | "member" | "viewer" | string;
  permissions: string[];
  created_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Full Session payload containing User Profile and optional Org Profile.
 */
export interface ZolexoraAuthSession {
  user: ZolexoraUserProfile;
  org?: ZolexoraOrgProfile | null;
  token: string;
  is_new_user?: boolean;
}

export interface SessionExchangeOptions {
  idToken: string;
  apiBaseUrl: string;
  zolexora_id?: string;
  registrationName?: string;
  allowBuyerRegistration?: boolean;
  native?: boolean;
}

export interface MarketplaceSession<User = Record<string, unknown>> {
  user: User;
  zolexora_id?: string;
  session_token?: string | null;
}

export interface RegistrationAttemptDocument {
  attemptId: string;
  uid?: string | null;
  signupMethod: SignupMethod;
  platform: TargetPlatform;
  status: RegistrationStatus;
  
  email?: string | null;
  emailVerified: boolean;
  emailVerification?: VerificationResult;
  emailOtpHash?: string;
  emailOtpExpiresAt?: string;

  phoneNumber?: string | null;
  phoneVerified: boolean;
  phoneVerification?: VerificationResult;
  pnvSupported?: boolean;

  displayName?: string | null;
  zolexoraId?: string;

  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export type AuthErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USER_NOT_FOUND'
  | 'AUTH_EMAIL_ALREADY_IN_USE'
  | 'AUTH_PHONE_ALREADY_IN_USE'
  | 'AUTH_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL'
  | 'AUTH_CREDENTIAL_ALREADY_LINKED'
  | 'AUTH_REGISTRATION_EXPIRED'
  | 'AUTH_INVALID_REGISTRATION_STATE'
  | 'AUTH_VERIFICATION_REQUIRED'
  | 'AUTH_OTP_INVALID_OR_EXPIRED'
  | 'AUTH_PNV_UNSUPPORTED'
  | 'AUTH_PNV_FAILED'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_PASSWORD_POLICY_VIOLATION'
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_APP_CHECK_FAILED';

export interface StandardizedAuthError {
  code: AuthErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  retryAfterSeconds?: number;
}
