import pg from "pg";
import { normalizeZolexoraOrgId, generateZolexoraId } from "@zolexora/utils";
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
} from "./types.js";

const { Pool } = pg;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const isUniqueViolation = (err: any) => err?.code === "23505";

const USER_COLUMNS = `id, zolexora_id, email, phone_number, display_name, firebase_uid, password_hash, status,
  (email_verified_at IS NOT NULL) AS email_verified, (phone_verified_at IS NOT NULL) AS phone_verified`;
const KYC_COLUMNS = "document_id, user_id, owner_id, org_id, document_type, storage_key, file_size, mime_type, created_at";

function toUser(row: any): GlobalUserRecord {
  return {
    id: row.id,
    zolexora_id: row.zolexora_id,
    email: row.email,
    phone_number: row.phone_number,
    display_name: row.display_name,
    firebase_uid: row.firebase_uid,
    password_hash: row.password_hash,
    status: row.status,
    email_verified: Boolean(row.email_verified),
    phone_verified: Boolean(row.phone_verified),
  };
}

function toKyc(row: any): KycDocumentRecord {
  return {
    document_id: row.document_id,
    user_id: row.user_id,
    owner_id: row.owner_id,
    org_id: row.org_id || undefined,
    document_type: row.document_type,
    storage_key: row.storage_key,
    file_size: Number(row.file_size),
    mime_type: row.mime_type,
    created_at: iso(row.created_at),
  };
}

/** PostgreSQL is the only store. Errors propagate; there is no in-memory fallback. */
export class PostgresAuthRepository implements IAuthRepository {
  private authPool: pg.Pool;
  private adminPool: pg.Pool;

  constructor(authDbUrl: string, adminDbUrl: string) {
    const opts = { idleTimeoutMillis: 10_000, connectionTimeoutMillis: 2_000 };
    this.authPool = new Pool({ connectionString: authDbUrl, max: 10, ...opts });
    this.adminPool = new Pool({ connectionString: adminDbUrl, max: 5, ...opts });
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await Promise.all([this.authPool.query("SELECT 1"), this.adminPool.query("SELECT 1")]);
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    await Promise.allSettled([this.authPool.end(), this.adminPool.end()]);
  }

  // One-time codes
  public async saveOtp(otp: OtpRecord): Promise<void> {
    await this.authPool.query(
      `INSERT INTO zolexora_auth_otps (email, purpose, code_hash, payload, attempts, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, 0, to_timestamp($5 / 1000.0))
       ON CONFLICT (email, purpose) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, payload = EXCLUDED.payload, attempts = 0,
             expires_at = EXCLUDED.expires_at, created_at = now()`,
      [otp.email, otp.purpose, otp.code_hash, JSON.stringify(otp.payload), otp.expires_at],
    );
  }

  public async getOtp(email: string, purpose: OtpPurpose): Promise<OtpRecord | null> {
    const res = await this.authPool.query(
      `SELECT email, purpose, code_hash, payload, attempts, extract(epoch from expires_at) * 1000 AS expires_at
       FROM zolexora_auth_otps WHERE email = $1 AND purpose = $2`,
      [email, purpose],
    );
    const row = res.rows[0];
    return row ? { ...row, attempts: Number(row.attempts), expires_at: Number(row.expires_at) } : null;
  }

  public async incrementOtpAttempts(email: string, purpose: OtpPurpose): Promise<void> {
    await this.authPool.query(
      "UPDATE zolexora_auth_otps SET attempts = attempts + 1 WHERE email = $1 AND purpose = $2",
      [email, purpose],
    );
  }

  public async deleteOtp(email: string, purpose: OtpPurpose): Promise<void> {
    await this.authPool.query("DELETE FROM zolexora_auth_otps WHERE email = $1 AND purpose = $2", [email, purpose]);
  }

  // Track 1
  public async getGlobalUserByEmail(email: string): Promise<GlobalUserRecord | null> {
    const res = await this.authPool.query(`SELECT ${USER_COLUMNS} FROM zolexora_auth_users WHERE email = $1`, [
      email.toLowerCase().trim(),
    ]);
    return res.rows[0] ? toUser(res.rows[0]) : null;
  }

  public async getGlobalUserByPhone(phoneNumber: string): Promise<GlobalUserRecord | null> {
    const res = await this.authPool.query(`SELECT ${USER_COLUMNS} FROM zolexora_auth_users WHERE phone_number = $1`, [phoneNumber]);
    return res.rows[0] ? toUser(res.rows[0]) : null;
  }

  public async getGlobalUserByFirebaseUid(firebaseUid: string): Promise<GlobalUserRecord | null> {
    const res = await this.authPool.query(`SELECT ${USER_COLUMNS} FROM zolexora_auth_users WHERE firebase_uid = $1`, [firebaseUid]);
    return res.rows[0] ? toUser(res.rows[0]) : null;
  }

  public async linkFirebaseUid(userId: string, firebaseUid: string): Promise<void> {
    await this.authPool.query("UPDATE zolexora_auth_users SET firebase_uid = $2 WHERE id = $1 AND firebase_uid IS NULL", [
      userId,
      firebaseUid,
    ]);
  }

  public async createGlobalUser(data: NewGlobalUser): Promise<GlobalUserRecord | null> {
    try {
      const res = await this.authPool.query(
        `INSERT INTO zolexora_auth_users
           (zolexora_id, email, phone_number, display_name, firebase_uid, password_hash, email_verified_at, phone_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), CASE WHEN $3::text IS NULL THEN NULL ELSE now() END)
         RETURNING ${USER_COLUMNS}`,
        [data.zolexora_id, data.email.toLowerCase().trim(), data.phone_number ?? null, data.display_name,
         data.firebase_uid ?? null, data.password_hash],
      );
      return toUser(res.rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  public async updateGlobalUserPassword(email: string, passwordHash: string): Promise<GlobalUserRecord | null> {
    const res = await this.authPool.query(
      `UPDATE zolexora_auth_users SET password_hash = $2 WHERE email = $1 RETURNING ${USER_COLUMNS}`,
      [email.toLowerCase().trim(), passwordHash],
    );
    return res.rows[0] ? toUser(res.rows[0]) : null;
  }

  // Track 2
  public async getOrganizationByOrgId(orgId: string): Promise<OrganizationRecord | null> {
    const res = await this.authPool.query(
      "SELECT id, zolexora_org_id, name, slug, status FROM zolexora_organizations WHERE zolexora_org_id = $1",
      [normalizeZolexoraOrgId(orgId)],
    );
    return res.rows[0] ?? null;
  }

  public async getEmployeeByOrgAndIdentifier(orgId: string, identifier: string): Promise<EmployeeRecord | null> {
    const res = await this.authPool.query(
      `SELECT m.id, m.organization_id, o.zolexora_org_id, m.zolexora_id, m.email,
              m.password_hash, m.role, m.permissions, m.status
       FROM zolexora_organization_memberships m
       JOIN zolexora_organizations o ON m.organization_id = o.id
       WHERE o.zolexora_org_id = $1 AND (m.email = $2 OR lower(m.zolexora_id) = $2)
       LIMIT 1`,
      [normalizeZolexoraOrgId(orgId), identifier.toLowerCase().trim()],
    );
    const row = res.rows[0];
    return row ? { ...row, permissions: Array.isArray(row.permissions) ? row.permissions : [] } : null;
  }

  public async createEmployee(data: NewEmployee): Promise<EmployeeRecord | null> {
    const org = await this.getOrganizationByOrgId(data.zolexora_org_id);
    if (!org) return null;
    try {
      const res = await this.authPool.query(
        `INSERT INTO zolexora_organization_memberships
           (organization_id, zolexora_id, email, password_hash, role, permissions, status)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'active')
         RETURNING id, organization_id, zolexora_id, email, password_hash, role, permissions, status`,
        [org.id, generateZolexoraId(), data.email.toLowerCase().trim(), data.password_hash, data.role,
          JSON.stringify(data.permissions)],
      );
      return { ...res.rows[0], zolexora_org_id: org.zolexora_org_id, product: data.product };
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  // Track 3
  public async getAdminByIdentifier(identifier: string): Promise<PlatformAdminRecord | null> {
    const res = await this.adminPool.query(
      `SELECT id, zolexora_id, username, email, password_hash, role, permissions, is_platform_admin, status
       FROM platform_admin_users WHERE email = $1 OR username = $1 LIMIT 1`,
      [identifier.toLowerCase().trim()],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      ...row,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      is_platform_admin: Boolean(row.is_platform_admin),
    };
  }

  // Revocation
  public async revokeToken(targetId: string, revocationType: RevocationType, reason: string, actorId: string) {
    const client = await this.authPool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        `INSERT INTO auth_revocations (target_id, revocation_type, reason, actor_id)
         VALUES ($1, $2, $3, $4)
         RETURNING extract(epoch from revoked_at) * 1000 AS revoked_at_ms`,
        [targetId, revocationType, reason, actorId],
      );
      await client.query(
        `INSERT INTO zolexora_auth_audit_logs (actor_id, action, target_id, details)
         VALUES ($1, 'TOKEN_REVOCATION', $2, $3::jsonb)`,
        [actorId, targetId, JSON.stringify({ reason, revocation_type: revocationType })],
      );
      await client.query("COMMIT");
      return { target_id: targetId, revoked_at: Number(res.rows[0].revoked_at_ms) };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  public async isTokenRevoked(uid: string, jti: string, issuedAtSeconds: number): Promise<boolean> {
    const res = await this.authPool.query(
      `SELECT 1 FROM auth_revocations
       WHERE (revocation_type = 'single_token' AND target_id = $2)
          OR (revocation_type = 'user_all_tokens' AND target_id = $1 AND floor(extract(epoch from revoked_at)) >= $3)
       LIMIT 1`,
      [uid, jti, issuedAtSeconds],
    );
    return res.rows.length > 0;
  }

  // KYC
  public async saveKycDocument(doc: KycDocumentRecord): Promise<KycDocumentRecord> {
    const res = await this.authPool.query(
      `INSERT INTO zolexora_kyc_documents (${KYC_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${KYC_COLUMNS}`,
      [doc.document_id, doc.user_id, doc.owner_id, doc.org_id ?? null, doc.document_type ?? "id_document",
        doc.storage_key, doc.file_size, doc.mime_type, doc.created_at],
    );
    return toKyc(res.rows[0]);
  }

  public async getKycDocument(documentId: string): Promise<KycDocumentRecord | null> {
    const res = await this.authPool.query(`SELECT ${KYC_COLUMNS} FROM zolexora_kyc_documents WHERE document_id = $1`, [
      documentId,
    ]);
    return res.rows[0] ? toKyc(res.rows[0]) : null;
  }
}
