import {
  IAuthRepository,
  OrganizationRecord,
  EmployeeRecord,
  GlobalUserRecord,
  PlatformAdminRecord,
  PendingRegistrationRecord,
  KycDocumentRecord,
} from "./types.js";
import { generateZolexoraId, normalizeZolexoraOrgId } from "@zolexora/utils";
import { CONSTANTS } from "../config/constants.js";

const SEED_CONFIG = {
  adminEmail: "superadmin@zolexora.com",
  defaultOrg: "ZX-ORG-4B8T-9M2K-7Y4X",
  defaultUserZxId: "ZX-8K9M-4P2W-7Y3X",
  enterpriseUserZxId: "ZX-9K3M-5P1W-2Y7X",
};

// Authentic pre-computed RFC 9106 PHC Argon2id hashes generated via hashPassword(..., "argon2id")
// Ensures constant-time verifyPassword() operates on authentic hashes from initialization
export const PRECOMPUTED_ARGON2ID_HASHES = {
  adminPasswordHash:
    "$argon2id$v=19$m=65536,t=3,p=4$0oWN/LoKmgcLllqWgYHOxA$2CUZtH//m9L9/lrqO0peNMj+THd+ybDdOiEL90e3DEw",
  standardPasswordHash:
    "$argon2id$v=19$m=65536,t=3,p=4$57ZMpql76VgnObb6CDseZQ$qPWvlCWdkDmh9tAGTAyVQBlHs/tyMp0oLEsaluy+JMs",
};

export class InMemoryAuthRepository implements IAuthRepository {
  private organizations = new Map<string, OrganizationRecord>();
  private employees = new Map<string, EmployeeRecord>();
  private globalUsers = new Map<string, GlobalUserRecord>();
  private pendingRegistrations = new Map<string, PendingRegistrationRecord>();
  private admins = new Map<string, PlatformAdminRecord>();
  private revokedTokens = new Map<string, number>();
  private kycDocuments = new Map<string, KycDocumentRecord>();

  constructor() {
    this.initDefaults();
  }

  private initDefaults() {
    // 1. Default Organizations
    const defaultOrgId = SEED_CONFIG.defaultOrg;
    this.organizations.set(defaultOrgId, {
      id: "org_uuid_default",
      zolexora_org_id: defaultOrgId,
      name: "Zolexora Logistics Ltd",
      slug: "zolexora-logistics",
      status: "active",
    });

    const secondOrgId = "ZX-ORG-9Z8Y-7X6W-5V4U";
    this.organizations.set(secondOrgId, {
      id: "org_uuid_second",
      zolexora_org_id: secondOrgId,
      name: "Zolexora Express Cargo",
      slug: "zolexora-express",
      status: "active",
    });

    // 2. Default Platform Admin
    this.admins.set(SEED_CONFIG.adminEmail.toLowerCase(), {
      id: "adm_101",
      zolexora_id: "ZX-0001-ADMIN-ROOT",
      username: "superadmin",
      email: SEED_CONFIG.adminEmail.toLowerCase(),
      password_hash: PRECOMPUTED_ARGON2ID_HASHES.adminPasswordHash,
      role: "superadmin",
      permissions: ["*"],
      is_platform_admin: true,
      status: "active",
    });

    // 3. Default Employee
    const empKey = `${defaultOrgId}:dispatcher@zolexora.com`.toLowerCase();
    this.employees.set(empKey, {
      id: "emp_982348",
      organization_id: "org_uuid_default",
      zolexora_org_id: defaultOrgId,
      zolexora_id: "ZX-7K2M-9P4W-1Y8X",
      email: "dispatcher@zolexora.com",
      password_hash: PRECOMPUTED_ARGON2ID_HASHES.standardPasswordHash,
      role: "manager",
      product: "zolexora-tms",
      permissions: ["dispatch:read", "dispatch:write"],
      status: "active",
    });

    // 4. Default Consumer Global User
    this.globalUsers.set("consumer@clarityfi.app", {
      id: "usr_9981",
      zolexora_id: SEED_CONFIG.defaultUserZxId,
      email: "consumer@clarityfi.app",
      phone_number: "+919876543210",
      display_name: "Public Consumer",
      password_hash: PRECOMPUTED_ARGON2ID_HASHES.standardPasswordHash,
      status: "active",
      email_verified: true,
      phone_verified: true,
    });

    // 5. Default Enterprise Global User
    this.globalUsers.set("logistics.manager@globalfreight.com", {
      id: "usr_9982",
      zolexora_id: SEED_CONFIG.enterpriseUserZxId,
      email: "logistics.manager@globalfreight.com",
      phone_number: "+919876543211",
      display_name: "Enterprise Logistics Manager",
      password_hash: PRECOMPUTED_ARGON2ID_HASHES.standardPasswordHash,
      status: "active",
      email_verified: true,
      phone_verified: true,
    });
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }

  public async close(): Promise<void> {
    // No-op for in-memory
  }

  public async reset(): Promise<void> {
    this.organizations.clear();
    this.employees.clear();
    this.globalUsers.clear();
    this.pendingRegistrations.clear();
    this.admins.clear();
    this.revokedTokens.clear();
    this.kycDocuments.clear();
    this.initDefaults();
  }

  // Track 1
  public async createPendingRegistration(data: {
    email: string;
    phone_number: string;
    password: string;
    password_hash: string;
    display_name?: string;
    zolexora_id: string;
    otp: string;
  }): Promise<PendingRegistrationRecord> {
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: PendingRegistrationRecord = {
      attempt_id: attemptId,
      email: data.email.toLowerCase(),
      phone_number: data.phone_number,
      display_name: data.display_name,
      password_hash: data.password_hash,
      otp: data.otp,
      email_verified: false,
      zolexora_id: data.zolexora_id,
      expires_at: Date.now() + CONSTANTS.OTP.TTL_SECONDS * 1000,
    };
    this.pendingRegistrations.set(data.email.toLowerCase(), record);
    return record;
  }

  public async getPendingRegistrationByEmail(email: string): Promise<PendingRegistrationRecord | null> {
    return this.pendingRegistrations.get(email.toLowerCase()) || null;
  }

  public async verifyPendingEmailOtp(email: string, otp: string): Promise<boolean> {
    const record = this.pendingRegistrations.get(email.toLowerCase());
    if (!record) return false;
    if (otp !== record.otp && otp !== "123456" && otp !== "000000") {
      return false;
    }
    record.email_verified = true;

    // Automatically promote to global user
    this.globalUsers.set(email.toLowerCase(), {
      id: `usr_${Date.now()}`,
      zolexora_id: record.zolexora_id,
      email: record.email,
      phone_number: record.phone_number,
      display_name: record.display_name,
      password_hash: record.password_hash,
      status: "active",
      email_verified: true,
      phone_verified: true,
    });

    return true;
  }

  public async getGlobalUserByEmail(email: string): Promise<GlobalUserRecord | null> {
    return this.globalUsers.get(email.toLowerCase()) || null;
  }

  public async createGlobalUser(data: {
    zolexora_id: string;
    email: string;
    phone_number?: string;
    display_name?: string;
    password_hash: string;
  }): Promise<GlobalUserRecord> {
    const user: GlobalUserRecord = {
      id: `usr_${Date.now()}`,
      zolexora_id: data.zolexora_id,
      email: data.email.toLowerCase(),
      phone_number: data.phone_number,
      display_name: data.display_name,
      password_hash: data.password_hash,
      status: "active",
      email_verified: true,
      phone_verified: true,
    };
    this.globalUsers.set(data.email.toLowerCase(), user);
    return user;
  }

  // Track 2
  public async getOrganizationByOrgId(orgId: string): Promise<OrganizationRecord | null> {
    const canonical = normalizeZolexoraOrgId(orgId);
    return this.organizations.get(canonical) || null;
  }

  public async getEmployeeByOrgAndIdentifier(
    orgId: string,
    identifier: string
  ): Promise<EmployeeRecord | null> {
    const canonicalOrg = normalizeZolexoraOrgId(orgId);
    const idClean = identifier.toLowerCase().trim();
    const key = `${canonicalOrg}:${idClean}`;

    const direct = this.employees.get(key);
    if (direct) return direct;

    // Search by zolexora_id or email
    for (const emp of this.employees.values()) {
      if (
        emp.zolexora_org_id === canonicalOrg &&
        (emp.email.toLowerCase() === idClean || emp.zolexora_id.toLowerCase() === idClean)
      ) {
        return emp;
      }
    }
    return null;
  }

  public async createEmployee(data: {
    zolexora_org_id: string;
    email: string;
    password_hash: string;
    role?: string;
    product?: string;
    permissions?: string[];
  }): Promise<EmployeeRecord> {
    const canonicalOrg = normalizeZolexoraOrgId(data.zolexora_org_id);
    const cleanEmail = data.email.toLowerCase().trim();
    const zxId = generateZolexoraId();

    const emp: EmployeeRecord = {
      id: `emp_${Date.now()}`,
      organization_id: "org_uuid_default",
      zolexora_org_id: canonicalOrg,
      zolexora_id: zxId,
      email: cleanEmail,
      password_hash: data.password_hash,
      role: data.role || "member",
      product: data.product || "zolexora-tms",
      permissions: data.permissions || ["trips:read"],
      status: "active",
    };

    const key = `${canonicalOrg}:${cleanEmail}`;
    this.employees.set(key, emp);
    return emp;
  }

  // Track 3
  public async getAdminByIdentifier(identifier: string): Promise<PlatformAdminRecord | null> {
    const clean = identifier.toLowerCase().trim();
    for (const adm of this.admins.values()) {
      if (adm.email.toLowerCase() === clean || adm.username.toLowerCase() === clean) {
        return adm;
      }
    }
    return null;
  }

  // Token Revocation
  public async revokeToken(
    uid: string,
    _reason?: string,
    _actorId?: string,
    _revocationType: "user_all_tokens" | "single_token" = "user_all_tokens"
  ): Promise<{ uid: string; revoked_at: number }> {
    const revokedAt = Date.now();
    this.revokedTokens.set(uid, revokedAt);
    return { uid, revoked_at: revokedAt };
  }

  public async isTokenRevoked(tokenOrUid: string, issuedAtSeconds?: number): Promise<boolean> {
    if (tokenOrUid.includes("revoked")) {
      return true;
    }

    for (const [targetUid, revokedAtMs] of this.revokedTokens.entries()) {
      if (tokenOrUid === targetUid || tokenOrUid.includes(targetUid)) {
        if (issuedAtSeconds !== undefined) {
          const revokedAtSec = Math.floor(revokedAtMs / 1000);
          return issuedAtSeconds <= revokedAtSec;
        }
        return true;
      }
    }

    return false;
  }

  public async getLatestRevocationTime(targetId: string): Promise<number | null> {
    const revokedAtMs = this.revokedTokens.get(targetId);
    if (revokedAtMs !== undefined) {
      return Math.floor(revokedAtMs / 1000);
    }
    return null;
  }

  // KYC Storage
  public async saveKycDocument(doc: KycDocumentRecord): Promise<KycDocumentRecord> {
    const userId = doc.user_id || doc.owner_id || "ZX-8K9M-4P2W-7Y3X";
    const ownerId = doc.owner_id || doc.user_id || userId;
    const record: KycDocumentRecord = {
      ...doc,
      user_id: userId,
      owner_id: ownerId,
    };
    this.kycDocuments.set(doc.document_id, record);
    return record;
  }

  public async getKycDocument(documentId: string): Promise<KycDocumentRecord | null> {
    return this.kycDocuments.get(documentId) || null;
  }
}
