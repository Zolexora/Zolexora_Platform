/**
 * Unified Firebase Authentication & Identity Shared Contracts
 * Applicable across Web, iOS, and Android
 */

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
  target: string; // E.164 phone number or normalized email
  status: 'pending' | 'verified' | 'failed';
  verifiedAt?: string;
  claimToken?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthenticatedUser {
  uid: string; // Canonical Firebase Authentication UID
  zolexora_id: string; // ZX-XXXX-XXXX-XXXX
  email?: string | null;
  phone_number?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  onboarding_completed: boolean;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
  providers: string[]; // e.g. ['google.com', 'password', 'phone']
}

export interface SessionState {
  user: AuthenticatedUser;
  idToken: string;
  refreshToken?: string;
  active_org_id?: string | null;
  is_new_user: boolean;
}

export interface IdentityLinkingRequest {
  target_provider: 'google.com' | 'password' | 'phone';
  id_token?: string;
  phone_number?: string;
  phone_verification_id?: string;
  phone_sms_code?: string;
  pnv_token?: string;
  password?: string;
}

export interface RecoveryResult {
  success: boolean;
  method: 'email_reset_link' | 'custom_email_otp' | 'temporary_token';
  target: string;
  expires_at: string;
  message: string;
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

/**
 * Registration attempt record stored in Firestore `registrationAttempts/{attemptId}`
 */
export interface RegistrationAttemptDocument {
  attemptId: string;
  uid?: string | null; // Bound Firebase UID (null during anonymous initiation)
  signupMethod: SignupMethod;
  platform: TargetPlatform;
  status: RegistrationStatus;
  
  // Verification progress
  email?: string | null;
  emailVerified: boolean;
  emailVerification?: VerificationResult;
  emailOtpHash?: string;
  emailOtpExpiresAt?: string;

  phoneNumber?: string | null;
  phoneVerified: boolean;
  phoneVerification?: VerificationResult;
  pnvSupported?: boolean;

  // Profile data collected prior to finalization
  displayName?: string | null;
  zolexoraId?: string;

  createdAt: string;
  updatedAt: string;
  expiresAt: string; // Typically 1 hour TTL
}

/**
 * Canonical user document stored in Firestore `users/{uid}`
 */
export interface UserProfileDocument {
  uid: string;
  zolexora_id: string;
  email?: string | null;
  phone_number?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  onboarding_completed: boolean;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

/**
 * Security audit event document stored in Firestore `securityEvents/{eventId}`
 */
export interface SecurityEventDocument {
  eventId: string;
  uid?: string | null;
  eventType:
    | 'signup_started'
    | 'signup_completed'
    | 'login_success'
    | 'login_failed'
    | 'email_otp_sent'
    | 'email_otp_verified'
    | 'phone_pnv_verified'
    | 'phone_sms_verified'
    | 'identity_linked'
    | 'password_reset_requested'
    | 'password_changed';
  platform: TargetPlatform;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
