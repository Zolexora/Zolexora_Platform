import pg from "pg";
import {
  IAuthRepository,
  OrganizationRecord,
  EmployeeRecord,
  GlobalUserRecord,
  PlatformAdminRecord,
  PendingRegistrationRecord,
  KycDocumentRecord,
} from "./types.js";
import { InMemoryAuthRepository } from "./in-memory-auth.repository.js";
import { normalizeZolexoraOrgId, generateZolexoraId } from "@zolexora/utils";

const { Pool } = pg;

export class PostgresAuthRepository implements IAuthRepository {
  private authPool: pg.Pool;
  private adminPool: pg.Pool;
  private fallback: InMemoryAuthRepository;
  private connected = false;

  constructor(authDbUrl: string, adminDbUrl: string) {
    this.fallback = new InMemoryAuthRepository();
    this.authPool = new Pool({
      connectionString: authDbUrl,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,
    });
    this.adminPool = new Pool({
      connectionString: adminDbUrl,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,
    });
  }

  public async isHealthy(): Promise<boolean> {
    try {
      const client = await this.authPool.connect();
      await client.query("SELECT 1");
      client.release();
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  public async close(): Promise<void> {
    await Promise.allSettled([this.authPool.end(), this.adminPool.end()]);
    await this.fallback.close();
  }

  public async reset(): Promise<void> {
    await this.fallback.reset();
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
    return this.fallback.createPendingRegistration(data);
  }

  public async getPendingRegistrationByEmail(email: string): Promise<PendingRegistrationRecord | null> {
    return this.fallback.getPendingRegistrationByEmail(email);
  }

  public async verifyPendingEmailOtp(email: string, otp: string): Promise<boolean> {
    const verified = await this.fallback.verifyPendingEmailOtp(email, otp);
    if (verified && this.connected) {
      try {
        const pending = await this.fallback.getPendingRegistrationByEmail(email);
        if (pending) {
          await this.createGlobalUser({
            zolexora_id: pending.zolexora_id,
            email: pending.email,
            phone_number: pending.phone_number,
            display_name: pending.display_name,
            password_hash: pending.password_hash,
          });
        }
      } catch {
        // Fallback maintained state
      }
    }
    return verified;
  }

  public async getGlobalUserByEmail(email: string): Promise<GlobalUserRecord | null> {
    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `SELECT id, zolexora_id, email, phone_number, password_hash, status,
                  (email_verified_at IS NOT NULL) AS email_verified,
                  (phone_verified_at IS NOT NULL) AS phone_verified
           FROM zolexora_auth_users
           WHERE email = $1 LIMIT 1`,
          [email.toLowerCase().trim()]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            zolexora_id: row.zolexora_id,
            email: row.email,
            phone_number: row.phone_number,
            password_hash: row.password_hash,
            status: row.status,
            email_verified: Boolean(row.email_verified),
            phone_verified: Boolean(row.phone_verified),
          };
        }
      } catch {
        // Fall through to memory
      }
    }
    return this.fallback.getGlobalUserByEmail(email);
  }

  public async createGlobalUser(data: {
    zolexora_id: string;
    email: string;
    phone_number?: string;
    display_name?: string;
    password_hash: string;
  }): Promise<GlobalUserRecord> {
    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `INSERT INTO zolexora_auth_users (zolexora_id, email, phone_number, password_hash, email_verified_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
           RETURNING id, zolexora_id, email, phone_number, password_hash, status`,
          [data.zolexora_id, data.email.toLowerCase().trim(), data.phone_number, data.password_hash]
        );
        const row = res.rows[0];
        return {
          id: row.id,
          zolexora_id: row.zolexora_id,
          email: row.email,
          phone_number: row.phone_number,
          display_name: data.display_name,
          password_hash: row.password_hash,
          status: row.status,
          email_verified: true,
          phone_verified: false,
        };
      } catch {
        // Fall through
      }
    }
    return this.fallback.createGlobalUser(data);
  }

  // Track 2
  public async getOrganizationByOrgId(orgId: string): Promise<OrganizationRecord | null> {
    const canonical = normalizeZolexoraOrgId(orgId);
    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `SELECT id, zolexora_org_id, name, slug, status
           FROM zolexora_organizations
           WHERE zolexora_org_id = $1 LIMIT 1`,
          [canonical]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            zolexora_org_id: row.zolexora_org_id,
            name: row.name,
            slug: row.slug,
            status: row.status,
          };
        }
      } catch {
        // Fall through
      }
    }
    return this.fallback.getOrganizationByOrgId(canonical);
  }

  public async getEmployeeByOrgAndIdentifier(
    orgId: string,
    identifier: string
  ): Promise<EmployeeRecord | null> {
    const canonicalOrg = normalizeZolexoraOrgId(orgId);
    const cleanId = identifier.toLowerCase().trim();

    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `SELECT m.id, m.organization_id, o.zolexora_org_id, m.zolexora_id, m.email,
                  m.password_hash, m.role, m.permissions, m.status
           FROM zolexora_organization_memberships m
           JOIN zolexora_organizations o ON m.organization_id = o.id
           WHERE o.zolexora_org_id = $1 AND (m.email = $2 OR m.zolexora_id = $2)
           LIMIT 1`,
          [canonicalOrg, cleanId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            organization_id: row.organization_id,
            zolexora_org_id: row.zolexora_org_id,
            zolexora_id: row.zolexora_id,
            email: row.email,
            password_hash: row.password_hash,
            role: row.role,
            product: "zolexora-tms",
            permissions: Array.isArray(row.permissions) ? row.permissions : [],
            status: row.status,
          };
        }
      } catch {
        // Fall through
      }
    }
    return this.fallback.getEmployeeByOrgAndIdentifier(canonicalOrg, cleanId);
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

    if (this.connected) {
      try {
        const orgRes = await this.authPool.query(
          `SELECT id FROM zolexora_organizations WHERE zolexora_org_id = $1 LIMIT 1`,
          [canonicalOrg]
        );
        let orgUuid: string;
        if (orgRes.rows.length === 0) {
          const insertOrg = await this.authPool.query(
            `INSERT INTO zolexora_organizations (zolexora_org_id, name)
             VALUES ($1, $2) RETURNING id`,
            [canonicalOrg, `Org ${canonicalOrg}`]
          );
          orgUuid = insertOrg.rows[0].id;
        } else {
          orgUuid = orgRes.rows[0].id;
        }

        const zxId = generateZolexoraId();
        const role = data.role || "member";
        const perms = JSON.stringify(data.permissions || ["trips:read"]);

        const res = await this.authPool.query(
          `INSERT INTO zolexora_organization_memberships
             (organization_id, zolexora_id, email, password_hash, role, permissions, status)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'active')
           ON CONFLICT (organization_id, email) DO UPDATE
             SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, permissions = EXCLUDED.permissions
           RETURNING id, organization_id, zolexora_id, email, role, status`,
          [orgUuid, zxId, cleanEmail, data.password_hash, role, perms]
        );

        const row = res.rows[0];
        const record: EmployeeRecord = {
          id: row.id,
          organization_id: row.organization_id,
          zolexora_org_id: canonicalOrg,
          zolexora_id: row.zolexora_id,
          email: row.email,
          password_hash: data.password_hash,
          role: row.role,
          product: data.product || "zolexora-tms",
          permissions: data.permissions || ["trips:read"],
          status: row.status,
        };
        // Also keep memory updated
        await this.fallback.createEmployee(data);
        return record;
      } catch {
        // Fall through
      }
    }
    return this.fallback.createEmployee(data);
  }

  // Track 3
  public async getAdminByIdentifier(identifier: string): Promise<PlatformAdminRecord | null> {
    const cleanId = identifier.toLowerCase().trim();
    if (this.connected) {
      try {
        const res = await this.adminPool.query(
          `SELECT id, zolexora_id, username, email, password_hash, role,
                  permissions, is_platform_admin, status
           FROM platform_admin_users
           WHERE email = $1 OR username = $1
           LIMIT 1`,
          [cleanId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            zolexora_id: row.zolexora_id,
            username: row.username,
            email: row.email,
            password_hash: row.password_hash,
            role: row.role,
            permissions: Array.isArray(row.permissions) ? row.permissions : ["*"],
            is_platform_admin: Boolean(row.is_platform_admin),
            status: row.status,
          };
        }
      } catch {
        // Fall through
      }
    }
    return this.fallback.getAdminByIdentifier(cleanId);
  }

  // Revocation
  public async revokeToken(
    uid: string,
    reason?: string,
    actorId?: string,
    revocationType: "user_all_tokens" | "single_token" = "user_all_tokens"
  ): Promise<{ uid: string; revoked_at: number }> {
    const nowMs = Date.now();
    // Maintain local in-memory state
    await this.fallback.revokeToken(uid, reason, actorId, revocationType);

    if (this.connected) {
      try {
        // 1. Insert into auth_revocations
        const res = await this.authPool.query(
          `INSERT INTO auth_revocations (target_id, revocation_type, revoked_at, reason, actor_id)
           VALUES ($1, $2, to_timestamp($3 / 1000.0), $4, $5)
           RETURNING extract(epoch from revoked_at) * 1000 AS revoked_at_ms`,
          [uid, revocationType, nowMs, reason || "Session revocation", actorId || uid]
        );

        // 2. Insert into zolexora_auth_audit_logs
        await this.authPool.query(
          `INSERT INTO zolexora_auth_audit_logs (actor_id, action, target_id, details)
           VALUES ($1, 'TOKEN_REVOCATION', $2, $3::jsonb)`,
          [
            actorId || uid,
            "TOKEN_REVOCATION",
            uid,
            JSON.stringify({ reason: reason || "Session revocation", revocation_type: revocationType, timestamp: nowMs }),
          ]
        );

        const returnedMs = Number(res.rows[0]?.revoked_at_ms) || nowMs;
        return { uid, revoked_at: returnedMs };
      } catch (err) {
        console.error("[PostgresAuthRepository] Error persisting revocation:", err);
      }
    }

    return { uid, revoked_at: nowMs };
  }

  public async isTokenRevoked(tokenOrUid: string, issuedAtSeconds?: number): Promise<boolean> {
    // 1. Check in-memory fallback first for high-speed hit
    const fallbackRevoked = await this.fallback.isTokenRevoked(tokenOrUid, issuedAtSeconds);
    if (fallbackRevoked) return true;

    // 2. Query PostgreSQL auth_revocations if connected
    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `SELECT revocation_type, extract(epoch from revoked_at) AS revoked_at_sec
           FROM auth_revocations
           WHERE target_id = $1
           ORDER BY revoked_at DESC
           LIMIT 1`,
          [tokenOrUid]
        );

        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (row.revocation_type === "single_token") {
            return true;
          }
          const revokedAtSec = Math.floor(Number(row.revoked_at_sec));
          if (issuedAtSeconds !== undefined) {
            return issuedAtSeconds <= revokedAtSec;
          }
          return true;
        }
      } catch (err) {
        console.error("[PostgresAuthRepository] Error querying revocation status:", err);
      }
    }

    return false;
  }

  public async getLatestRevocationTime(targetId: string): Promise<number | null> {
    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `SELECT extract(epoch from revoked_at) AS revoked_at_sec
           FROM auth_revocations
           WHERE target_id = $1
           ORDER BY revoked_at DESC
           LIMIT 1`,
          [targetId]
        );
        if (res.rows.length > 0) {
          return Math.floor(Number(res.rows[0].revoked_at_sec));
        }
      } catch (err) {
        console.error("[PostgresAuthRepository] Error querying latest revocation time:", err);
      }
    }
    return this.fallback.getLatestRevocationTime ? this.fallback.getLatestRevocationTime(targetId) : null;
  }

  // KYC
  public async saveKycDocument(doc: KycDocumentRecord): Promise<KycDocumentRecord> {
    const userId = doc.user_id || doc.owner_id || "ZX-8K9M-4P2W-7Y3X";
    const ownerId = doc.owner_id || doc.user_id || userId;
    const documentType = doc.document_type || "id_document";

    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `INSERT INTO zolexora_kyc_documents 
            (document_id, user_id, owner_id, org_id, document_type, storage_key, file_size, mime_type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (document_id) DO UPDATE SET
             org_id = EXCLUDED.org_id,
             storage_key = EXCLUDED.storage_key,
             file_size = EXCLUDED.file_size,
             mime_type = EXCLUDED.mime_type,
             updated_at = now()
           RETURNING document_id, user_id, owner_id, org_id, document_type, storage_key, file_size, mime_type, created_at`,
          [
            doc.document_id,
            userId,
            ownerId,
            doc.org_id || null,
            documentType,
            doc.storage_key,
            doc.file_size,
            doc.mime_type,
            doc.created_at || new Date().toISOString(),
          ]
        );
        const row = res.rows[0];
        const record: KycDocumentRecord = {
          document_id: row.document_id,
          user_id: row.user_id,
          owner_id: row.owner_id,
          org_id: row.org_id || undefined,
          document_type: row.document_type,
          storage_key: row.storage_key,
          file_size: Number(row.file_size),
          mime_type: row.mime_type,
          created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        };
        await this.fallback.saveKycDocument(record);
        return record;
      } catch {
        // Fall through to fallback
      }
    }
    return this.fallback.saveKycDocument({
      ...doc,
      user_id: userId,
      owner_id: ownerId,
    });
  }

  public async getKycDocument(documentId: string): Promise<KycDocumentRecord | null> {
    if (this.connected) {
      try {
        const res = await this.authPool.query(
          `SELECT document_id, user_id, owner_id, org_id, document_type, storage_key, file_size, mime_type, created_at
           FROM zolexora_kyc_documents
           WHERE document_id = $1`,
          [documentId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            document_id: row.document_id,
            user_id: row.user_id,
            owner_id: row.owner_id,
            org_id: row.org_id || undefined,
            document_type: row.document_type,
            storage_key: row.storage_key,
            file_size: Number(row.file_size),
            mime_type: row.mime_type,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
          };
        }
      } catch {
        // Fall through
      }
    }
    return this.fallback.getKycDocument(documentId);
  }
}

