import { randomUUID } from "node:crypto";
// TEST ONLY. Never imported by src/ — production always uses PostgresAuthRepository.
import { generateZolexoraId, normalizeZolexoraOrgId } from "@zolexora/utils";
import {
  IAuthRepository,
  OrganizationRecord,
  EmployeeRecord,
  GlobalUserRecord,
  PlatformAdminRecord,
  KycDocumentRecord,
  OtpRecord,
  OtpPurpose,
  NewGlobalUser,
  NewEmployee,
  RevocationType,
} from "../../src/repositories/types.js";

export const TEST_PASSWORDS = {
  standard: "CorporateSecurePass123!",
  admin: "MasterSuperadminSecret2026!",
};

// scrypt hashes of TEST_PASSWORDS (work on every Node version).
const HASHES = {
  standard:
    "scrypt$32768$8$3$8e9d08c4a6de754cf9c41279172dd04e$8a411a1c5a21a5b30c450bf0602ab20887c2bbf27604bc15d838641cef713950d6096bc4d5d4f353bf75866b53440753b2797f16b39a2651ad77fe34da89f5d5",
  admin:
    "scrypt$32768$8$3$ee68b8d95b8a289b0e1bdfaf9a85d991$0397fb49a0ea2dcd502a8c0d9d5ed8a75382a852045071281f2c00c84f3d4f1688549f2fc500fa78d45334da420da24017184450e6a993005549275ed68bf89b",
};

export const SEED = {
  defaultOrg: "ZX-ORG-4B8T-9M2K-7Y4X",
  secondOrg: "ZX-ORG-9Z8Y-7X6W-5V4U",
  consumerZxId: "ZX-8K9M-4P2W-7Y3X",
};

export class InMemoryAuthRepository implements IAuthRepository {
  private organizations = new Map<string, OrganizationRecord>();
  private employees = new Map<string, EmployeeRecord>();
  private globalUsers = new Map<string, GlobalUserRecord>();
  private otps = new Map<string, OtpRecord>();
  private admins = new Map<string, PlatformAdminRecord>();
  private revocations: { target: string; type: RevocationType; at: number }[] = [];
  private kycDocuments = new Map<string, KycDocumentRecord>();

  constructor() {
    this.seed();
  }

  private seed() {
    for (const [id, zx, name] of [
      ["org_uuid_default", SEED.defaultOrg, "Zolexora Logistics Ltd"],
      ["org_uuid_second", SEED.secondOrg, "Zolexora Express Cargo"],
    ]) {
      this.organizations.set(zx, { id, zolexora_org_id: zx, name, status: "active" });
    }

    this.admins.set("superadmin@zolexora.com", {
      id: "adm_101",
      zolexora_id: "ZX-0001-ADMIN-ROOT",
      username: "superadmin",
      email: "superadmin@zolexora.com",
      password_hash: HASHES.admin,
      role: "superadmin",
      permissions: ["*"],
      is_platform_admin: true,
      status: "active",
    });

    this.employees.set(`${SEED.defaultOrg}:dispatcher@zolexora.com`, {
      id: "emp_982348",
      organization_id: "org_uuid_default",
      zolexora_org_id: SEED.defaultOrg,
      zolexora_id: "ZX-7K2M-9P4W-1Y8X",
      email: "dispatcher@zolexora.com",
      password_hash: HASHES.standard,
      role: "manager",
      product: "zolexora-tms",
      permissions: ["dispatch:read", "dispatch:write"],
      status: "active",
    });

    for (const [id, zx, email, phone] of [
      ["usr_9981", SEED.consumerZxId, "consumer@clarityfi.app", "+919876543210"],
      ["usr_9982", "ZX-9K3M-5P1W-2Y7X", "logistics.manager@globalfreight.com", "+919876543211"],
    ]) {
      this.globalUsers.set(email, {
        id, zolexora_id: zx, email, phone_number: phone, password_hash: HASHES.standard,
        status: "active", email_verified: true, phone_verified: true,
      });
    }
  }

  /** Test helper: add or replace an employee directly. */
  public putEmployee(emp: EmployeeRecord) {
    this.employees.set(`${emp.zolexora_org_id}:${emp.email}`, emp);
  }

  /** Test helper: add or replace a global user directly. */
  public putGlobalUser(user: GlobalUserRecord) {
    this.globalUsers.set(user.email, user);
  }

  public async isHealthy() { return true; }
  public async close() {}

  public async saveOtp(otp: OtpRecord) { this.otps.set(`${otp.purpose}:${otp.email}`, { ...otp, attempts: 0 }); }
  public async getOtp(email: string, purpose: OtpPurpose) { return this.otps.get(`${purpose}:${email}`) ?? null; }
  public async incrementOtpAttempts(email: string, purpose: OtpPurpose) {
    const otp = this.otps.get(`${purpose}:${email}`);
    if (otp) otp.attempts++;
  }
  public async deleteOtp(email: string, purpose: OtpPurpose) { this.otps.delete(`${purpose}:${email}`); }

  public async getGlobalUserByEmail(email: string) { return this.globalUsers.get(email.toLowerCase().trim()) ?? null; }

  public async getGlobalUserByPhone(phone: string) {
    return [...this.globalUsers.values()].find((u) => u.phone_number === phone) ?? null;
  }

  public async getGlobalUserByFirebaseUid(uid: string) {
    return [...this.globalUsers.values()].find((u) => u.firebase_uid === uid) ?? null;
  }

  public async linkFirebaseUid(userId: string, uid: string) {
    const user = [...this.globalUsers.values()].find((u) => u.id === userId);
    if (user && !user.firebase_uid) user.firebase_uid = uid;
  }

  public async createGlobalUser(data: NewGlobalUser) {
    const email = data.email.toLowerCase().trim();
    if (this.globalUsers.has(email)) return null;
    if (data.phone_number && (await this.getGlobalUserByPhone(data.phone_number))) return null;
    if (data.firebase_uid && (await this.getGlobalUserByFirebaseUid(data.firebase_uid))) return null;
    const user: GlobalUserRecord = {
      id: `usr_${randomUUID()}`, zolexora_id: data.zolexora_id, email, phone_number: data.phone_number ?? null,
      display_name: data.display_name, firebase_uid: data.firebase_uid ?? null, password_hash: data.password_hash,
      status: "active", email_verified: true, phone_verified: Boolean(data.phone_number),
    };
    this.globalUsers.set(email, user);
    return user;
  }

  public async updateGlobalUserPassword(email: string, passwordHash: string) {
    const user = this.globalUsers.get(email.toLowerCase().trim());
    if (!user) return null;
    user.password_hash = passwordHash;
    return user;
  }

  public async getOrganizationByOrgId(orgId: string) {
    return this.organizations.get(normalizeZolexoraOrgId(orgId)) ?? null;
  }

  public async getEmployeeByOrgAndIdentifier(orgId: string, identifier: string) {
    const org = normalizeZolexoraOrgId(orgId);
    const id = identifier.toLowerCase().trim();
    for (const emp of this.employees.values()) {
      if (emp.zolexora_org_id === org && (emp.email === id || emp.zolexora_id.toLowerCase() === id)) return emp;
    }
    return null;
  }

  public async createEmployee(data: NewEmployee) {
    const org = await this.getOrganizationByOrgId(data.zolexora_org_id);
    if (!org) return null;
    const email = data.email.toLowerCase().trim();
    const key = `${org.zolexora_org_id}:${email}`;
    if (this.employees.has(key)) return null;
    const emp: EmployeeRecord = {
      id: `emp_${Date.now()}`, organization_id: org.id, zolexora_org_id: org.zolexora_org_id,
      zolexora_id: generateZolexoraId(), email, password_hash: data.password_hash, role: data.role,
      product: data.product, permissions: data.permissions, status: "active",
    };
    this.employees.set(key, emp);
    return emp;
  }

  public async getAdminByIdentifier(identifier: string) {
    const id = identifier.toLowerCase().trim();
    return [...this.admins.values()].find((a) => a.email === id || a.username === id) ?? null;
  }

  public async revokeToken(targetId: string, revocationType: RevocationType, _reason: string, _actorId: string) {
    const at = Date.now();
    this.revocations.push({ target: targetId, type: revocationType, at });
    return { target_id: targetId, revoked_at: at };
  }

  public async isTokenRevoked(uid: string, jti: string, issuedAtSeconds: number) {
    return this.revocations.some((r) =>
      r.type === "single_token" ? r.target === jti : r.target === uid && issuedAtSeconds <= Math.floor(r.at / 1000),
    );
  }

  public async saveKycDocument(doc: KycDocumentRecord) {
    this.kycDocuments.set(doc.document_id, doc);
    return doc;
  }

  public async getKycDocument(documentId: string) { return this.kycDocuments.get(documentId) ?? null; }
}
