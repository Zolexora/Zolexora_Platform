import { generateZolexoraOrgId, normalizeZolexoraOrgId } from "@zolexora/utils";
import { Db } from "../db.js";
import { AccessInput, RoleRow } from "../rbac/engine.js";

export type Address = Record<string, string | null>;

export interface OrgRow {
  id: string;
  zolexora_org_id: string;
  name: string;
  status: "active" | "suspended" | "deactivated" | "pending";
  legal_name: string | null;
  trade_name: string | null;
  pan_holder_type: string | null;
  business_kind: string | null;
  pan_encrypted: string | null;
  pan_last4: string | null;
  pan_hash: string | null;
  email: string | null;
  phone: string | null;
  address: Address | null;
  logo_url: string | null;
  activity_primary: string | null;
  activity_others: string[];
  official_activities: string[];
  mfa_policy: "off" | "optional" | "required";
  created_at: Date;
}

export interface MemberRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  employee_id: string | null;
  status: "active" | "suspended";
}

export interface MemberListItem extends MemberRow {
  kind: "person" | "employee";
  zolexora_id: string;
  email: string | null;
  phone_number: string | null;
  display_name: string | null;
  roles: { scope: string; role_id: string; key: string; name: string; built_in: boolean }[];
  overrides: { permission_key: string; effect: "grant" | "block" }[];
}

export interface InviteRow {
  id: string;
  organization_id: string;
  kind: "person" | "employee";
  email: string | null;
  phone_number: string | null;
  org_role_id: string;
  product_roles: Record<string, string>;
  invited_by: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  reset_member_id: string | null;
  created_at: Date;
}

const ORG_COLS = `id, zolexora_org_id, name, status, legal_name, trade_name, pan_holder_type, business_kind, pan_encrypted,
  pan_last4, pan_hash, email, phone, address, logo_url, activity_primary, activity_others, official_activities, mfa_policy, created_at`;
const ROLE_SELECT = `r.id, r.scope, r.key, r.name, r.built_in, r.disabled,
  COALESCE((SELECT json_agg(json_build_object('permission_key', rp.permission_key, 'effect', rp.effect) ORDER BY rp.permission_key)
            FROM zolexora_role_permissions rp WHERE rp.role_id = r.id), '[]'::json) AS rules`;
const INVITE_COLS = `id, organization_id, kind, email, phone_number, org_role_id, product_roles, invited_by, expires_at,
  accepted_at, revoked_at, reset_member_id, created_at`;

export type NewOrg = Pick<OrgRow, "legal_name" | "trade_name" | "pan_holder_type" | "business_kind" | "pan_encrypted" | "pan_last4"
  | "pan_hash" | "email" | "phone" | "address" | "logo_url" | "activity_primary" | "activity_others">;

export const ORG_EDITABLE = ["legal_name", "trade_name", "email", "phone", "address", "logo_url", "activity_primary", "activity_others"] as const;
export type OrgPatch = Partial<Pick<OrgRow, (typeof ORG_EDITABLE)[number] | "official_activities" | "mfa_policy" | "status">>;

const JSON_COLS = new Set(["address", "activity_others", "official_activities"]);
const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));

export class TeamStore {
  constructor(private readonly db: Db) {}

  /** The same store bound to an open transaction. */
  with(tx: Db): TeamStore {
    return new TeamStore(tx);
  }

  // ── Businesses ────────────────────────────────────────────────────────────
  /** Creates the business, its built-in roles (trigger) and the creator as owner, in one transaction. */
  async createOrg(data: NewOrg, ownerUserId: string): Promise<{ org: OrgRow; member: MemberRow }> {
    return this.db.tx(async (tx) => {
      const org = (await tx.query<OrgRow>(
        `INSERT INTO zolexora_organizations
           (zolexora_org_id, name, status, legal_name, trade_name, pan_holder_type, business_kind, pan_encrypted, pan_last4,
            pan_hash, email, phone, address, logo_url, activity_primary, activity_others, created_by)
         VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15::jsonb, $16)
         RETURNING ${ORG_COLS}`,
        [generateZolexoraOrgId(), data.trade_name || data.legal_name, data.legal_name, data.trade_name, data.pan_holder_type,
          data.business_kind, data.pan_encrypted, data.pan_last4, data.pan_hash, data.email, data.phone, json(data.address),
          data.logo_url, data.activity_primary, json(data.activity_others ?? []), ownerUserId],
      )).rows[0];
      const member = (await tx.query<MemberRow>(
        `INSERT INTO zolexora_org_members (organization_id, user_id) VALUES ($1, $2)
         RETURNING id, organization_id, user_id, employee_id, status`,
        [org.id, ownerUserId],
      )).rows[0];
      await tx.query(
        `INSERT INTO zolexora_member_roles (member_id, scope, role_id)
         SELECT $1, 'org', id FROM zolexora_roles WHERE organization_id = $2 AND scope = 'org' AND key = 'owner'`,
        [member.id, org.id],
      );
      return { org, member };
    });
  }

  async getOrg(zxOrgId: string): Promise<OrgRow | null> {
    let id: string;
    try {
      id = normalizeZolexoraOrgId(zxOrgId);
    } catch {
      return null;
    }
    return (await this.db.query<OrgRow>(`SELECT ${ORG_COLS} FROM zolexora_organizations WHERE zolexora_org_id = $1`, [id])).rows[0] ?? null;
  }

  async getOrgById(id: string): Promise<OrgRow | null> {
    return (await this.db.query<OrgRow>(`SELECT ${ORG_COLS} FROM zolexora_organizations WHERE id = $1`, [id])).rows[0] ?? null;
  }

  async countOrgsWithPan(panHash: string, excludeOrgId?: string): Promise<number> {
    const r = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM zolexora_organizations WHERE pan_hash = $1 AND status <> 'deactivated' AND ($2::uuid IS NULL OR id <> $2)`,
      [panHash, excludeOrgId ?? null],
    );
    return r.rows[0].n;
  }

  async updateOrg(orgId: string, patch: OrgPatch): Promise<OrgRow> {
    const sets: string[] = [];
    const vals: unknown[] = [orgId];
    const ref: Record<string, string> = { legal_name: "legal_name", trade_name: "trade_name" };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      vals.push(JSON_COLS.has(k) ? json(v) : v);
      ref[k] = `$${vals.length}${JSON_COLS.has(k) ? "::jsonb" : ""}`;
      sets.push(`${k} = ${ref[k]}`);
    }
    if (!sets.length) return (await this.getOrgById(orgId))!;
    // The display name follows the trade name, then the legal name (SET sees old values, so use the new params).
    sets.push(`name = COALESCE(NULLIF(${ref.trade_name}::text, ''), NULLIF(${ref.legal_name}::text, ''), name)`);
    return (await this.db.query<OrgRow>(
      `UPDATE zolexora_organizations SET ${sets.join(", ")} WHERE id = $1 RETURNING ${ORG_COLS}`, vals,
    )).rows[0];
  }

  /** Businesses a person belongs to, with their business role. */
  async listOrgsForUser(userId: string) {
    return (await this.db.query<OrgRow & { member_id: string; member_status: string; org_role: string | null; org_role_name: string | null }>(
      `SELECT ${ORG_COLS.split(", ").map((c) => `o.${c.trim()}`).join(", ")}, m.id AS member_id, m.status AS member_status,
              r.key AS org_role, r.name AS org_role_name
       FROM zolexora_org_members m
       JOIN zolexora_organizations o ON o.id = m.organization_id
       LEFT JOIN zolexora_member_roles mr ON mr.member_id = m.id AND mr.scope = 'org'
       LEFT JOIN zolexora_roles r ON r.id = mr.role_id
       WHERE m.user_id = $1 AND o.status <> 'deactivated'
       ORDER BY o.created_at`,
      [userId],
    )).rows;
  }

  async listActivityGroups(includeHidden = false) {
    return (await this.db.query<{ key: string; label: string; hidden: boolean; sort_order: number }>(
      `SELECT key, label, hidden, sort_order FROM zolexora_activity_groups WHERE $1 OR NOT hidden ORDER BY sort_order, key`,
      [includeHidden],
    )).rows;
  }

  async saveActivityGroup(g: { key: string; label: string; hidden: boolean; sort_order: number }) {
    return (await this.db.query(
      `INSERT INTO zolexora_activity_groups (key, label, hidden, sort_order) VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, hidden = EXCLUDED.hidden, sort_order = EXCLUDED.sort_order
       RETURNING key, label, hidden, sort_order`,
      [g.key, g.label, g.hidden, g.sort_order],
    )).rows[0];
  }

  // ── Members ───────────────────────────────────────────────────────────────
  async getMember(memberId: string): Promise<MemberRow | null> {
    return (await this.db.query<MemberRow>(
      "SELECT id, organization_id, user_id, employee_id, status FROM zolexora_org_members WHERE id::text = $1", [memberId],
    )).rows[0] ?? null;
  }

  async getMemberForUser(orgId: string, userId: string): Promise<MemberRow | null> {
    return (await this.db.query<MemberRow>(
      "SELECT id, organization_id, user_id, employee_id, status FROM zolexora_org_members WHERE organization_id = $1 AND user_id = $2",
      [orgId, userId],
    )).rows[0] ?? null;
  }

  async getMemberForEmployee(employeeId: string): Promise<MemberRow | null> {
    return (await this.db.query<MemberRow>(
      "SELECT id, organization_id, user_id, employee_id, status FROM zolexora_org_members WHERE employee_id::text = $1", [employeeId],
    )).rows[0] ?? null;
  }

  /** Who a member is: the person's or the employee's id, email and phone. */
  async getMemberIdentity(memberId: string) {
    return (await this.db.query<MemberRow & { zolexora_id: string; email: string | null; phone_number: string | null; display_name: string | null }>(
      `SELECT m.id, m.organization_id, m.user_id, m.employee_id, m.status,
              COALESCE(u.zolexora_id, e.zolexora_id) AS zolexora_id, COALESCE(u.email, e.email) AS email,
              COALESCE(u.phone_number, e.phone_number) AS phone_number, u.display_name
       FROM zolexora_org_members m
       LEFT JOIN zolexora_auth_users u ON u.id = m.user_id
       LEFT JOIN zolexora_organization_memberships e ON e.id = m.employee_id
       WHERE m.id::text = $1`,
      [memberId],
    )).rows[0] ?? null;
  }

  async listMembers(orgId: string): Promise<MemberListItem[]> {
    return (await this.db.query<MemberListItem>(
      `SELECT m.id, m.organization_id, m.user_id, m.employee_id, m.status,
              CASE WHEN m.user_id IS NULL THEN 'employee' ELSE 'person' END AS kind,
              COALESCE(u.zolexora_id, e.zolexora_id) AS zolexora_id, COALESCE(u.email, e.email) AS email,
              COALESCE(u.phone_number, e.phone_number) AS phone_number, u.display_name,
              COALESCE((SELECT json_agg(json_build_object('scope', mr.scope, 'role_id', r.id, 'key', r.key, 'name', r.name, 'built_in', r.built_in))
                        FROM zolexora_member_roles mr JOIN zolexora_roles r ON r.id = mr.role_id WHERE mr.member_id = m.id), '[]'::json) AS roles,
              COALESCE((SELECT json_agg(json_build_object('permission_key', o.permission_key, 'effect', o.effect))
                        FROM zolexora_member_overrides o WHERE o.member_id = m.id), '[]'::json) AS overrides
       FROM zolexora_org_members m
       LEFT JOIN zolexora_auth_users u ON u.id = m.user_id
       LEFT JOIN zolexora_organization_memberships e ON e.id = m.employee_id
       WHERE m.organization_id = $1
       ORDER BY m.created_at`,
      [orgId],
    )).rows;
  }

  /** Everything the engine needs to compute one member's access. */
  async loadAccessInput(memberId: string, catalog: Set<string>): Promise<{ input: AccessInput; member: MemberRow; org: OrgRow } | null> {
    const member = await this.getMember(memberId);
    if (!member) return null;
    const org = (await this.getOrgById(member.organization_id))!;
    const roles = (await this.db.query<RoleRow & { member_scope: string }>(
      `SELECT mr.scope AS member_scope, ${ROLE_SELECT}
       FROM zolexora_member_roles mr JOIN zolexora_roles r ON r.id = mr.role_id WHERE mr.member_id = $1`,
      [memberId],
    )).rows;
    const overrides = (await this.db.query<{ permission_key: string; effect: "grant" | "block" }>(
      "SELECT permission_key, effect FROM zolexora_member_overrides WHERE member_id = $1", [memberId],
    )).rows;
    const mfa = await this.db.query(
      `SELECT 1 FROM zolexora_mfa_factors WHERE confirmed_at IS NOT NULL AND (user_id = $1 OR employee_id = $2)`,
      [member.user_id, member.employee_id],
    );
    return {
      member,
      org,
      input: {
        memberActive: member.status === "active",
        orgActive: org.status === "active",
        orgRole: roles.find((r) => r.member_scope === "org") ?? null,
        productRoles: roles.filter((r) => r.member_scope !== "org"),
        overrides,
        catalog,
        mfaPolicy: org.mfa_policy,
        mfaEnrolled: mfa.rows.length > 0,
      },
    };
  }

  async getMemberRole(memberId: string, scope: string): Promise<RoleRow | null> {
    return (await this.db.query<RoleRow>(
      `SELECT ${ROLE_SELECT} FROM zolexora_member_roles mr JOIN zolexora_roles r ON r.id = mr.role_id
       WHERE mr.member_id = $1 AND mr.scope = $2`,
      [memberId, scope],
    )).rows[0] ?? null;
  }

  async setMemberRole(memberId: string, scope: string, roleId: string | null, db: Db = this.db): Promise<void> {
    if (roleId === null) {
      await db.query("DELETE FROM zolexora_member_roles WHERE member_id = $1 AND scope = $2", [memberId, scope]);
      return;
    }
    await db.query(
      `INSERT INTO zolexora_member_roles (member_id, scope, role_id) VALUES ($1, $2, $3)
       ON CONFLICT (member_id, scope) DO UPDATE SET role_id = EXCLUDED.role_id`,
      [memberId, scope, roleId],
    );
  }

  async setMemberStatus(member: MemberRow, status: "active" | "suspended"): Promise<void> {
    await this.db.tx(async (tx) => {
      await tx.query("UPDATE zolexora_org_members SET status = $2 WHERE id = $1", [member.id, status]);
      if (member.employee_id) {
        await tx.query("UPDATE zolexora_organization_memberships SET status = $2 WHERE id = $1", [member.employee_id, status]);
      }
    });
  }

  /** People leave; employees' logins are deleted with them. */
  async deleteMember(member: MemberRow): Promise<void> {
    if (member.employee_id) await this.db.query("DELETE FROM zolexora_organization_memberships WHERE id = $1", [member.employee_id]);
    else await this.db.query("DELETE FROM zolexora_org_members WHERE id = $1", [member.id]);
  }

  async countActiveOwners(orgId: string): Promise<number> {
    return (await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM zolexora_org_members m
       JOIN zolexora_member_roles mr ON mr.member_id = m.id AND mr.scope = 'org'
       JOIN zolexora_roles r ON r.id = mr.role_id AND r.key = 'owner' AND r.built_in
       WHERE m.organization_id = $1 AND m.status = 'active'`,
      [orgId],
    )).rows[0].n;
  }

  async setOverride(memberId: string, permissionKey: string, effect: "grant" | "block" | null, by: string | null): Promise<void> {
    if (effect === null) {
      await this.db.query("DELETE FROM zolexora_member_overrides WHERE member_id = $1 AND permission_key = $2", [memberId, permissionKey]);
      return;
    }
    await this.db.query(
      `INSERT INTO zolexora_member_overrides (member_id, permission_key, effect, granted_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (member_id, permission_key) DO UPDATE SET effect = EXCLUDED.effect, granted_by = EXCLUDED.granted_by, created_at = now()`,
      [memberId, permissionKey, effect, by],
    );
  }

  // ── Roles ─────────────────────────────────────────────────────────────────
  async listRoles(orgId: string) {
    return (await this.db.query<RoleRow & { members: number }>(
      `SELECT ${ROLE_SELECT}, (SELECT count(*)::int FROM zolexora_member_roles mr WHERE mr.role_id = r.id) AS members
       FROM zolexora_roles r WHERE r.organization_id = $1
       ORDER BY r.scope <> 'org', r.scope, r.built_in DESC, r.name`,
      [orgId],
    )).rows;
  }

  async getRole(orgId: string, roleId: string): Promise<RoleRow | null> {
    return (await this.db.query<RoleRow>(
      `SELECT ${ROLE_SELECT} FROM zolexora_roles r WHERE r.organization_id = $1 AND r.id::text = $2`, [orgId, roleId],
    )).rows[0] ?? null;
  }

  async getBuiltInRole(orgId: string, key: string): Promise<RoleRow> {
    return (await this.db.query<RoleRow>(
      `SELECT ${ROLE_SELECT} FROM zolexora_roles r WHERE r.organization_id = $1 AND r.scope = 'org' AND r.key = $2 AND r.built_in`,
      [orgId, key],
    )).rows[0];
  }

  async createRole(orgId: string, scope: string, key: string, name: string, grants: string[], by: string | null): Promise<RoleRow> {
    return this.db.tx(async (tx) => {
      const role = (await tx.query<{ id: string }>(
        `INSERT INTO zolexora_roles (organization_id, scope, key, name, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [orgId, scope, key, name, by],
      )).rows[0];
      await this.replaceRules(tx, role.id, grants, "grant");
      return (await this.getRoleTx(tx, orgId, role.id))!;
    });
  }

  /** Custom roles: the grants. Built-in business roles: the business's blocks. */
  async updateRole(orgId: string, roleId: string, patch: { name?: string; rules?: string[]; effect: "grant" | "block"; disabled?: boolean }) {
    return this.db.tx(async (tx) => {
      if (patch.name !== undefined || patch.disabled !== undefined) {
        await tx.query(
          "UPDATE zolexora_roles SET name = COALESCE($3, name), disabled = COALESCE($4, disabled) WHERE organization_id = $1 AND id = $2",
          [orgId, roleId, patch.name ?? null, patch.disabled ?? null],
        );
      }
      if (patch.rules) await this.replaceRules(tx, roleId, patch.rules, patch.effect);
      return (await this.getRoleTx(tx, orgId, roleId))!;
    });
  }

  /** Moves everyone with `fromRoleId` to `toRoleId` (or removes the product role when null). */
  async moveRoleMembers(fromRoleId: string, toRoleId: string | null, db: Db = this.db): Promise<number> {
    const r = toRoleId
      ? await db.query("UPDATE zolexora_member_roles SET role_id = $2 WHERE role_id = $1", [fromRoleId, toRoleId])
      : await db.query("DELETE FROM zolexora_member_roles WHERE role_id = $1", [fromRoleId]);
    return r.rowCount;
  }

  async deleteRole(orgId: string, roleId: string, moveTo: string | null): Promise<void> {
    await this.db.tx(async (tx) => {
      await this.moveRoleMembers(roleId, moveTo, tx);
      await tx.query("UPDATE zolexora_org_invites SET revoked_at = now() WHERE org_role_id = $1 AND accepted_at IS NULL", [roleId]);
      await tx.query("DELETE FROM zolexora_roles WHERE organization_id = $1 AND id = $2 AND NOT built_in", [orgId, roleId]);
    });
  }

  private async replaceRules(tx: Db, roleId: string, keys: string[], effect: "grant" | "block") {
    await tx.query("DELETE FROM zolexora_role_permissions WHERE role_id = $1", [roleId]);
    for (const k of new Set(keys)) {
      await tx.query("INSERT INTO zolexora_role_permissions (role_id, permission_key, effect) VALUES ($1, $2, $3)", [roleId, k, effect]);
    }
  }

  private async getRoleTx(tx: Db, orgId: string, roleId: string) {
    return (await tx.query<RoleRow>(`SELECT ${ROLE_SELECT} FROM zolexora_roles r WHERE r.organization_id = $1 AND r.id = $2`, [orgId, roleId])).rows[0];
  }

  // ── Invites ───────────────────────────────────────────────────────────────
  async createInvite(i: Omit<InviteRow, "id" | "accepted_at" | "revoked_at" | "created_at"> & { token_hash: string }): Promise<InviteRow> {
    return (await this.db.query<InviteRow>(
      `INSERT INTO zolexora_org_invites
         (organization_id, kind, email, phone_number, org_role_id, product_roles, token_hash, invited_by, expires_at, reset_member_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10) RETURNING ${INVITE_COLS}`,
      [i.organization_id, i.kind, i.email, i.phone_number, i.org_role_id, JSON.stringify(i.product_roles), i.token_hash,
        i.invited_by, i.expires_at, i.reset_member_id],
    )).rows[0];
  }

  async getInviteByHash(hash: string): Promise<InviteRow | null> {
    return (await this.db.query<InviteRow>(`SELECT ${INVITE_COLS} FROM zolexora_org_invites WHERE token_hash = $1`, [hash])).rows[0] ?? null;
  }

  async listInvites(orgId: string): Promise<InviteRow[]> {
    return (await this.db.query<InviteRow>(
      `SELECT ${INVITE_COLS} FROM zolexora_org_invites
       WHERE organization_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC`,
      [orgId],
    )).rows;
  }

  async revokeInvite(orgId: string, inviteId: string): Promise<boolean> {
    return (await this.db.query(
      "UPDATE zolexora_org_invites SET revoked_at = now() WHERE organization_id = $1 AND id::text = $2 AND accepted_at IS NULL AND revoked_at IS NULL",
      [orgId, inviteId],
    )).rowCount > 0;
  }

  /** Marks the invite used; false when it was already used, revoked or expired (single use, race-safe). */
  async consumeInvite(tx: Db, inviteId: string, memberId: string): Promise<boolean> {
    return (await tx.query(
      `UPDATE zolexora_org_invites SET accepted_at = now(), accepted_member_id = $2
       WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
      [inviteId, memberId],
    )).rowCount > 0;
  }

  get database(): Db {
    return this.db;
  }
}
