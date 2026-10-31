export interface OrganizationRecord {
  id: string;
  zolexora_org_id: string;
  name: string;
  slug?: string | null;
  status: "active" | "suspended" | "deactivated" | "pending";
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
  status: "active" | "suspended" | "deactivated" | "pending";
}

export interface GlobalUserRecord {
  id: string;
  zolexora_id: string;
  email: string;
  phone_number?: string | null;
  display_name?: string | null;
  password_hash: string;
  status: "active" | "suspended" | "deactivated" | "pending";
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

export interface PendingRegistrationRecord {
  attempt_id: string;
  email: string;
  phone_number: string;
  display_name?: string;
  password_hash: string;
  plain_password?: string;
  otp: string;
  email_verified: boolean;
  zolexora_id: string;
  expires_at: number;
}

export interface KycDocumentRecord {
  document_id: string;
  user_id?: string;
  owner_id?: string;
  org_id?: string;
  document_type?: string;
  storage_key: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  updated_at?: string;
}


export interface IAuthRepository {
  // Health & Lifecycle
  isHealthy(): Promise<boolean>;
  close(): Promise<void>;
  reset(): Promise<void>;

  // Track 1: Public Identity
  createPendingRegistration(data: {
    email: string;
    phone_number: string;
    password: string;
    password_hash: string;
    display_name?: string;
    zolexora_id: string;
    otp: string;
  }): Promise<PendingRegistrationRecord>;
  getPendingRegistrationByEmail(email: string): Promise<PendingRegistrationRecord | null>;
  verifyPendingEmailOtp(email: string, otp: string): Promise<boolean>;
  getGlobalUserByEmail(email: string): Promise<GlobalUserRecord | null>;
  createGlobalUser(data: {
    zolexora_id: string;
    email: string;
    phone_number?: string;
    display_name?: string;
    password_hash: string;
  }): Promise<GlobalUserRecord>;

  // Track 2: Employee
  getOrganizationByOrgId(orgId: string): Promise<OrganizationRecord | null>;
  getEmployeeByOrgAndIdentifier(orgId: string, identifier: string): Promise<EmployeeRecord | null>;
  createEmployee(data: {
    zolexora_org_id: string;
    email: string;
    password_hash: string;
    role?: string;
    product?: string;
    permissions?: string[];
  }): Promise<EmployeeRecord>;

  // Track 3: Admin
  getAdminByIdentifier(identifier: string): Promise<PlatformAdminRecord | null>;

  // Session & Revocation
  revokeToken(
    uid: string,
    reason?: string,
    actorId?: string,
    revocationType?: "user_all_tokens" | "single_token"
  ): Promise<{ uid: string; revoked_at: number }>;
  isTokenRevoked(tokenOrUid: string, issuedAtSeconds?: number): Promise<boolean>;
  getLatestRevocationTime?(targetId: string): Promise<number | null>;

  // KYC Storage
  saveKycDocument(doc: KycDocumentRecord): Promise<KycDocumentRecord>;
  getKycDocument(documentId: string): Promise<KycDocumentRecord | null>;
}
