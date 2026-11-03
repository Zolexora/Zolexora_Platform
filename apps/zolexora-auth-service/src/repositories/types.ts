export type AccountStatus = "active" | "suspended" | "deactivated" | "pending";

export interface OrganizationRecord {
  id: string;
  zolexora_org_id: string;
  name: string;
  slug?: string | null;
  status: AccountStatus;
}

export interface EmployeeRecord {
  id: string;
  organization_id: string;
  zolexora_org_id: string;
  zolexora_id: string;
  email: string;
  password_hash: string;
  role: string;
  product?: string;
  permissions: string[];
  status: AccountStatus;
}

export interface GlobalUserRecord {
  id: string;
  zolexora_id: string;
  email: string;
  phone_number?: string | null;
  display_name?: string | null;
  firebase_uid?: string | null;
  password_hash: string;
  status: AccountStatus;
  email_verified: boolean;
  phone_verified: boolean;
}

export interface PlatformAdminRecord {
  id: string;
  zolexora_id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  permissions: string[];
  is_platform_admin: boolean;
  status: "active" | "suspended" | "deactivated";
}

export type OtpPurpose = "signup" | "reset";

export interface OtpRecord {
  email: string;
  purpose: OtpPurpose;
  code_hash: string;
  payload: Record<string, any>;
  attempts: number;
  expires_at: number; // epoch ms
}

export interface KycDocumentRecord {
  document_id: string;
  user_id: string;
  owner_id: string;
  org_id?: string;
  document_type?: string;
  storage_key: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  updated_at?: string;
}

export type RevocationType = "user_all_tokens" | "single_token";

export interface NewGlobalUser {
  zolexora_id: string;
  email: string; // already verified
  phone_number?: string; // already verified when present
  display_name: string;
  firebase_uid?: string;
  password_hash: string;
}

export interface NewEmployee {
  zolexora_org_id: string;
  email: string;
  password_hash: string;
  role: string;
  product?: string;
  permissions: string[];
}

export interface IAuthRepository {
  isHealthy(): Promise<boolean>;
  close(): Promise<void>;

  // One-time codes (signup verification, password reset)
  saveOtp(otp: OtpRecord): Promise<void>;
  getOtp(email: string, purpose: OtpPurpose): Promise<OtpRecord | null>;
  incrementOtpAttempts(email: string, purpose: OtpPurpose): Promise<void>;
  deleteOtp(email: string, purpose: OtpPurpose): Promise<void>;

  // Track 1: Public Identity
  getGlobalUserByEmail(email: string): Promise<GlobalUserRecord | null>;
  getGlobalUserByPhone(phoneNumber: string): Promise<GlobalUserRecord | null>;
  getGlobalUserByFirebaseUid(firebaseUid: string): Promise<GlobalUserRecord | null>;
  /** Links a Google (Firebase) identity to an account that has none yet. */
  linkFirebaseUid(userId: string, firebaseUid: string): Promise<void>;
  /** Returns null when the email, phone or Firebase UID is already registered (never overwrites). */
  createGlobalUser(data: NewGlobalUser): Promise<GlobalUserRecord | null>;
  updateGlobalUserPassword(email: string, passwordHash: string): Promise<GlobalUserRecord | null>;

  // Track 2: Employee
  getOrganizationByOrgId(orgId: string): Promise<OrganizationRecord | null>;
  getEmployeeByOrgAndIdentifier(orgId: string, identifier: string): Promise<EmployeeRecord | null>;
  /** Organisation must exist. Returns null when the employee already exists (never overwrites). */
  createEmployee(data: NewEmployee): Promise<EmployeeRecord | null>;

  // Track 3: Admin
  getAdminByIdentifier(identifier: string): Promise<PlatformAdminRecord | null>;

  // Revocation: user_all_tokens targets a uid, single_token targets a token jti.
  revokeToken(
    targetId: string,
    revocationType: RevocationType,
    reason: string,
    actorId: string,
  ): Promise<{ target_id: string; revoked_at: number }>;
  isTokenRevoked(uid: string, jti: string, issuedAtSeconds: number): Promise<boolean>;

  // KYC Storage
  saveKycDocument(doc: KycDocumentRecord): Promise<KycDocumentRecord>;
  getKycDocument(documentId: string): Promise<KycDocumentRecord | null>;
}
