import * as crypto from "crypto";

export type SignupMethod = "google" | "email" | "mobile";
export type TargetPlatform = "web" | "android" | "ios";

export type RegistrationStatus =
  | "identity_pending"
  | "contact_verification"
  | "profile_pending"
  | "finalizing"
  | "active"
  | "expired"
  | "cancelled";

export interface RegistrationAttemptData {
  attemptId: string;
  uid?: string | null;
  signupMethod: SignupMethod;
  platform: TargetPlatform;
  status: RegistrationStatus;

  email?: string | null;
  emailVerified: boolean;
  emailOtpHash?: string;
  emailOtpSalt?: string;
  emailOtpExpiresAt?: string;
  emailOtpAttempts?: number;

  phoneNumber?: string | null;
  phoneVerified: boolean;
  phoneVerificationMethod?: "firebase_pnv" | "firebase_sms_otp";
  pnvSupported?: boolean;

  displayName?: string | null;
  zolexoraId?: string;

  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

const ALLOWED_TRANSITIONS: Record<RegistrationStatus, RegistrationStatus[]> = {
  identity_pending: ["contact_verification", "cancelled", "expired"],
  contact_verification: ["contact_verification", "profile_pending", "cancelled", "expired"],
  profile_pending: ["finalizing", "cancelled", "expired"],
  finalizing: ["active", "profile_pending", "cancelled", "expired"],
  active: [],
  expired: [],
  cancelled: [],
};

export class RegistrationStateMachine {
  static canTransition(from: RegistrationStatus, to: RegistrationStatus): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static isExpired(attempt: RegistrationAttemptData): boolean {
    return new Date().toISOString() > attempt.expiresAt;
  }

  static generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  static hashOtp(otp: string, salt: string): string {
    return crypto.createHash("sha256").update(`${otp}:${salt}`).digest("hex");
  }

  static verifyOtp(otp: string, salt: string, expectedHash: string): boolean {
    const computedHash = this.hashOtp(otp, salt);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computedHash, "hex"),
        Buffer.from(expectedHash, "hex")
      );
    } catch {
      return false;
    }
  }

  static areContactsSatisfied(attempt: RegistrationAttemptData): boolean {
    // Both email and phone must be verified for production security
    return Boolean(attempt.emailVerified && attempt.phoneVerified);
  }

  static determineNextState(attempt: RegistrationAttemptData): RegistrationStatus {
    if (this.isExpired(attempt)) {
      return "expired";
    }
    if (this.areContactsSatisfied(attempt)) {
      return "profile_pending";
    }
    return "contact_verification";
  }
}
