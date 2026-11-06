import { Db } from "../db.js";

export interface SessionRow {
  id: string;
  member_id: string;
  product: string | null;
  refresh_hash: string;
  prev_refresh_hash: string | null;
  mfa_at: Date | null;
  user_agent: string | null;
  ip: string | null;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
}

export interface MfaFactorRow {
  id: string;
  secret_encrypted: string;
  confirmed_at: Date | null;
  last_used_step: string | null; // BIGINT comes back as text
}

export type MfaOwner = { user_id: string | null; employee_id: string | null };

const SESSION_COLS = `id, member_id, product, refresh_hash, prev_refresh_hash, mfa_at, user_agent, ip, created_at, last_used_at,
  expires_at, revoked_at, revoked_reason`;
const owner = (o: MfaOwner) => (o.user_id ? ["user_id", o.user_id] : ["employee_id", o.employee_id]) as [string, string];

/** Business sessions (refresh rotation), MFA factors and the login lockout counter (ADR 0005 §6). */
export class SecurityStore {
  constructor(private readonly db: Db) {}

  // ── Sessions ──────────────────────────────────────────────────────────────
  async createSession(s: { member_id: string; product: string | null; refresh_hash: string; mfa_at: Date | null;
    user_agent: string | null; ip: string | null; expires_at: Date }): Promise<SessionRow> {
    return (await this.db.query<SessionRow>(
      `INSERT INTO zolexora_sessions (member_id, product, refresh_hash, mfa_at, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${SESSION_COLS}`,
      [s.member_id, s.product, s.refresh_hash, s.mfa_at, s.user_agent?.slice(0, 300) ?? null, s.ip, s.expires_at],
    )).rows[0];
  }

  async getSession(id: string): Promise<SessionRow | null> {
    return (await this.db.query<SessionRow>(`SELECT ${SESSION_COLS} FROM zolexora_sessions WHERE id::text = $1`, [id])).rows[0] ?? null;
  }

  async isSessionActive(id: string): Promise<boolean> {
    return (await this.db.query(
      "SELECT 1 FROM zolexora_sessions WHERE id::text = $1 AND revoked_at IS NULL AND expires_at > now()", [id],
    )).rows.length > 0;
  }

  /**
   * Swaps the refresh token. Returns the session when `hash` is the current token,
   * or `{ reused }` when it is the previous one (a stolen copy): the caller revokes the session.
   */
  async rotate(hash: string, nextHash: string): Promise<{ session: SessionRow } | { reused: SessionRow } | null> {
    const r = await this.db.query<SessionRow>(
      `UPDATE zolexora_sessions SET prev_refresh_hash = refresh_hash, refresh_hash = $2, last_used_at = now()
       WHERE refresh_hash = $1 AND revoked_at IS NULL AND expires_at > now() RETURNING ${SESSION_COLS}`,
      [hash, nextHash],
    );
    if (r.rows[0]) return { session: r.rows[0] };
    const old = (await this.db.query<SessionRow>(
      `SELECT ${SESSION_COLS} FROM zolexora_sessions WHERE prev_refresh_hash = $1`, [hash],
    )).rows[0];
    return old ? { reused: old } : null;
  }

  async markMfa(sessionId: string): Promise<void> {
    await this.db.query("UPDATE zolexora_sessions SET mfa_at = now() WHERE id = $1", [sessionId]);
  }

  async revokeSession(id: string, reason: string, memberId?: string): Promise<boolean> {
    return (await this.db.query(
      `UPDATE zolexora_sessions SET revoked_at = now(), revoked_reason = $2
       WHERE id::text = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR member_id = $3)`,
      [id, reason, memberId ?? null],
    )).rowCount > 0;
  }

  /** Every session of a member (suspension, removal, password reset), optionally keeping one. */
  async revokeMemberSessions(memberId: string, reason: string, keepId?: string): Promise<number> {
    return (await this.db.query(
      `UPDATE zolexora_sessions SET revoked_at = now(), revoked_reason = $2
       WHERE member_id = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
      [memberId, reason, keepId ?? null],
    )).rowCount;
  }

  /** All sessions of the people/employees behind these members (a person's sessions across businesses). */
  async revokeSessionsForUser(o: MfaOwner, reason: string): Promise<number> {
    const [col, id] = owner(o);
    return (await this.db.query(
      `UPDATE zolexora_sessions s SET revoked_at = now(), revoked_reason = $2
       FROM zolexora_org_members m WHERE m.id = s.member_id AND m.${col} = $1 AND s.revoked_at IS NULL`,
      [id, reason],
    )).rowCount;
  }

  async listSessions(memberId: string): Promise<SessionRow[]> {
    return (await this.db.query<SessionRow>(
      `SELECT ${SESSION_COLS} FROM zolexora_sessions
       WHERE member_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_used_at DESC`,
      [memberId],
    )).rows;
  }

  // ── Login lockout (shared across replicas) ────────────────────────────────
  async failuresSince(key: string, since: Date): Promise<{ count: number; last: Date | null }> {
    const r = await this.db.query<{ count: number; last: Date | null }>(
      `SELECT count(*)::int AS count, max(at) AS last FROM zolexora_login_attempts
       WHERE key = $1 AND NOT success AND at > $2
         AND at > COALESCE((SELECT max(at) FROM zolexora_login_attempts WHERE key = $1 AND success), '-infinity')`,
      [key, since],
    );
    return r.rows[0];
  }

  async recordAttempt(keys: string[], success: boolean, ip: string | null): Promise<void> {
    for (const key of keys) {
      await this.db.query("INSERT INTO zolexora_login_attempts (key, success, ip) VALUES ($1, $2, $3)", [key, success, ip]);
    }
  }

  /** Recent sign-ins of one member (keys are `member:<id>`). */
  async loginHistory(memberId: string, limit = 20) {
    return (await this.db.query<{ success: boolean; ip: string | null; at: Date }>(
      "SELECT success, ip, at FROM zolexora_login_attempts WHERE key = $1 ORDER BY at DESC LIMIT $2", [`member:${memberId}`, limit],
    )).rows;
  }

  async pruneAttempts(olderThan: Date): Promise<void> {
    await this.db.query("DELETE FROM zolexora_login_attempts WHERE at < $1", [olderThan]);
  }

  // ── MFA ───────────────────────────────────────────────────────────────────
  async getFactor(o: MfaOwner): Promise<MfaFactorRow | null> {
    const [col, id] = owner(o);
    return (await this.db.query<MfaFactorRow>(
      `SELECT id, secret_encrypted, confirmed_at, last_used_step::text FROM zolexora_mfa_factors WHERE ${col} = $1`, [id],
    )).rows[0] ?? null;
  }

  /** New unconfirmed secret; replaces an earlier unconfirmed one. */
  async startFactor(o: MfaOwner, secretEncrypted: string): Promise<void> {
    const [col, id] = owner(o);
    await this.db.query(
      `INSERT INTO zolexora_mfa_factors (${col}, secret_encrypted) VALUES ($1, $2)
       ON CONFLICT (${col}) DO UPDATE SET secret_encrypted = EXCLUDED.secret_encrypted, confirmed_at = NULL, last_used_step = NULL
       WHERE zolexora_mfa_factors.confirmed_at IS NULL`,
      [id, secretEncrypted],
    );
  }

  /** Records a used time step; false if that step (or a later one) was already used — a code works once. */
  async useStep(factorId: string, step: number, confirm: boolean): Promise<boolean> {
    return (await this.db.query(
      `UPDATE zolexora_mfa_factors SET last_used_step = $2, confirmed_at = CASE WHEN $3 THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END
       WHERE id = $1 AND (last_used_step IS NULL OR last_used_step < $2)`,
      [factorId, step, confirm],
    )).rowCount > 0;
  }

  async deleteFactor(o: MfaOwner): Promise<boolean> {
    const [col, id] = owner(o);
    return (await this.db.query(`DELETE FROM zolexora_mfa_factors WHERE ${col} = $1`, [id])).rowCount > 0;
  }
}
