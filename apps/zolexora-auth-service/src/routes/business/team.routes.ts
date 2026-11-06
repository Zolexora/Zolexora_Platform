import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { generateZolexoraId, isPublicWebmailDomain, isValidZolexoraOrgId, normalizeZolexoraOrgId } from "@zolexora/utils";
import { AppError } from "../../plugins/error-handler.js";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { CONSTANTS } from "../../config/constants.js";
import { MFA_GATED, OWNER_ONLY, PRODUCT_KEY_RE, RESERVED_SCOPES, BUILT_IN_GRANTS, BuiltInOrgRole, isCommonPermission, isOrgPermission, isPermissionKey, permissionPrefix } from "../../rbac/permissions.js";
import { RoleRow } from "../../rbac/engine.js";
import { CipherService } from "../../services/cipher.service.js";
import { InviteRow, MemberRow } from "../../stores/team.store.js";
import { getRemoteIp, getTurnstileToken, hashNewPassword } from "../auth/request.js";
import {
  Actor, actorFor, assertHolds, audit, badRequest, BusinessDeps, conflict, denied, need, notFound, parse, requireFreshMfa, rolePermissions,
} from "./context.js";

const id = z.string().uuid();
const productScope = z.string().regex(PRODUCT_KEY_RE).refine((s) => !RESERVED_SCOPES.includes(s), "not a product");
const isOwnerRole = (r: RoleRow | null) => !!r && r.built_in && r.key === "owner";
const isMemberRole = (r: RoleRow | null) => !!r && r.built_in && r.key === "member";
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

export async function teamRoutes(app: FastifyInstance, d: BusinessDeps) {
  const authenticate = createAuthMiddleware({ tokenService: d.tokens, repo: d.repo });
  const pre = { preHandler: [authenticate] };
  type P<T = {}> = { Params: { org: string } & T };

  // ── Helpers enforcing ADR 0005 §4 ─────────────────────────────────────────
  const target = async (actor: Actor, memberId: string): Promise<{ m: MemberRow; orgRole: RoleRow | null }> => {
    const m = memberId === "me" ? actor.member : await d.team.getMember(memberId);
    if (!m || m.organization_id !== actor.org.id) throw notFound("Member not found.");
    return { m, orgRole: await d.team.getMemberRole(m.id, "org") };
  };
  const notSelf = (actor: Actor, m: MemberRow) => {
    if (actor.member?.id === m.id) throw denied("You can't change your own role or permissions.");
  };
  const protectOwner = (actor: Actor, orgRole: RoleRow | null) => {
    if (isOwnerRole(orgRole) && !actor.access.isOwner && !actor.isPlatformAdmin) throw denied("Only an owner can change an owner.");
  };
  /** Without org:team:manage (e.g. a manager), you may act on members only. */
  const membersOnlyUnlessManager = (actor: Actor, orgRole: RoleRow | null) => {
    if (!actor.access.permissions.has("org:team:manage") && !isMemberRole(orgRole)) throw denied("You can do this for members only.");
  };
  const keepAnOwner = async (orgId: string) => {
    if ((await d.team.countActiveOwners(orgId)) <= 1) throw denied("A business must always have an owner. Make someone else an owner first.");
  };
  /** Nobody edits a role they hold themselves (that would change their own access). */
  const notOwnRole = async (actor: Actor, role: RoleRow) => {
    if (actor.member && (await d.team.getMemberRole(actor.member.id, role.scope))?.id === role.id) {
      throw denied("You can't edit a role you hold yourself.");
    }
  };
  const orgRoleOr404 = async (actor: Actor, roleId: string, scope?: string) => {
    const r = await d.team.getRole(actor.org.id, roleId);
    if (!r || (scope && r.scope !== scope)) throw notFound("Role not found.");
    return r;
  };

  /** Checks a role's permission list. Business roles: org/common keys; product roles: that product's keys and common. */
  const validateRoleKeys = async (actor: Actor, scope: string, keys: string[]) => {
    const live = scope === "org" ? null : await d.catalog.liveKeys(scope);
    for (const k of keys) {
      if (!isPermissionKey(k)) throw badRequest(`Not a permission key: ${k}`);
      if (scope === "org") {
        if (!isOrgPermission(k) && !isCommonPermission(k)) throw badRequest(`${k} can't be in a business role.`);
        if (OWNER_ONLY.includes(k)) throw badRequest(`${k} stays with owners only.`);
        if (k === MFA_GATED && actor.org.mfa_policy !== "required") {
          throw badRequest(`${k} can go to a custom role only when the business requires MFA (security settings).`);
        }
      } else if (!isCommonPermission(k) && !(permissionPrefix(k) === scope && live!.has(k))) {
        throw badRequest(`${k} is not a ${scope} permission.`);
      }
    }
    assertHolds(actor, keys);
  };

  // ── Members ───────────────────────────────────────────────────────────────
  app.get<P>("/api/v1/organizations/:org/members", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:team:view");
    return { success: true, members: await d.team.listMembers(actor.org.id) };
  });

  app.get<P<{ member: string }>>("/api/v1/organizations/:org/members/:member/access", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    const { m } = await target(actor, req.params.member);
    if (m.id !== actor.member?.id) need(actor, "org:team:view");
    const a = (await d.sessions.access(m.id))!;
    return {
      success: true,
      member_id: m.id,
      role: a.access.orgRoleKey,
      is_owner: a.access.isOwner,
      permissions: [...a.access.permissions].sort(),
      explain: a.access.explain,
      mfa_setup_required: a.access.mfaSetupRequired,
    };
  });

  app.patch<P<{ member: string }>>("/api/v1/organizations/:org/members/:member", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:team:manage");
    const body = parse(z.object({ org_role_id: id.optional(), status: z.enum(["active", "suspended"]).optional() }).strict(), req.body);
    const { m, orgRole } = await target(actor, req.params.member);
    notSelf(actor, m);
    protectOwner(actor, orgRole);

    if (body.org_role_id && body.org_role_id !== orgRole?.id) {
      const role = await orgRoleOr404(actor, body.org_role_id, "org");
      if (role.disabled) throw badRequest("That role is disabled.");
      if (isOwnerRole(role) && !actor.access.isOwner && !actor.isPlatformAdmin) throw denied("Only an owner can make someone an owner.");
      assertHolds(actor, rolePermissions(role));
      if (isOwnerRole(orgRole)) await keepAnOwner(actor.org.id);
      await d.team.setMemberRole(m.id, "org", role.id);
      await audit(d, req, actor.id, "member.role_changed", m.id, { from: orgRole?.key, to: role.key, role_id: role.id });
    }
    if (body.status && body.status !== m.status) {
      if (body.status === "suspended" && isOwnerRole(orgRole)) await keepAnOwner(actor.org.id);
      await d.team.setMemberStatus(m, body.status);
      if (body.status === "suspended") await d.security.revokeMemberSessions(m.id, "suspended");
      await audit(d, req, actor.id, `member.${body.status === "active" ? "reactivated" : "suspended"}`, m.id);
    }
    return { success: true, member: (await d.team.listMembers(actor.org.id)).find((x) => x.id === m.id) };
  });

  /** Remove someone, or leave (`me`). Employees' logins are deleted with them. */
  app.delete<P<{ member: string }>>("/api/v1/organizations/:org/members/:member", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    const { m, orgRole } = await target(actor, req.params.member);
    const leaving = actor.member?.id === m.id;
    if (!leaving) {
      need(actor, "org:team:manage");
      protectOwner(actor, orgRole);
    }
    if (isOwnerRole(orgRole)) await keepAnOwner(actor.org.id);
    await d.security.revokeMemberSessions(m.id, leaving ? "left" : "removed");
    await d.team.deleteMember(m);
    await audit(d, req, actor.id, leaving ? "member.left" : "member.removed", m.id);
    return { success: true };
  });

  app.put<P<{ member: string; product: string }>>("/api/v1/organizations/:org/members/:member/roles/:product", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:roles:assign");
    const product = parse(productScope, req.params.product);
    const { role_id } = parse(z.object({ role_id: id.nullable() }).strict(), req.body);
    const { m, orgRole } = await target(actor, req.params.member);
    notSelf(actor, m);
    protectOwner(actor, orgRole);
    membersOnlyUnlessManager(actor, orgRole);
    const before = await d.team.getMemberRole(m.id, product);
    if (before) assertHolds(actor, rolePermissions(before)); // taking a role away also needs you to hold it
    if (role_id) {
      const role = await orgRoleOr404(actor, role_id, product);
      if (role.disabled) throw badRequest("That role is disabled.");
      assertHolds(actor, rolePermissions(role));
    }
    await d.team.setMemberRole(m.id, product, role_id);
    await audit(d, req, actor.id, "member.product_role_set", m.id, { product, from: before?.id ?? null, to: role_id });
    return { success: true };
  });

  /** Extra grant or block for one person (`effect: null` clears it). A block always wins. */
  app.put<P<{ member: string }>>("/api/v1/organizations/:org/members/:member/overrides", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:access:override");
    const b = parse(z.object({ permission: z.string(), effect: z.enum(["grant", "block"]).nullable() }).strict(), req.body);
    const { m, orgRole } = await target(actor, req.params.member);
    notSelf(actor, m);
    if (isOwnerRole(orgRole)) throw denied("An owner always has full access; it can't be changed.");
    const k = b.permission;
    const known = isOrgPermission(k) || isCommonPermission(k) || (isPermissionKey(k) && (await d.catalog.liveKeys(permissionPrefix(k))).has(k));
    if (!known) throw badRequest(`Unknown permission: ${k}`);
    if (b.effect === "grant" && (OWNER_ONLY.includes(k) || k === MFA_GATED)) throw badRequest(`${k} can't be given to one person.`);
    assertHolds(actor, [k]);
    await d.team.setOverride(m.id, k, b.effect, actor.member?.id ?? null);
    await audit(d, req, actor.id, "member.override_set", m.id, { permission: k, effect: b.effect });
    return { success: true };
  });

  /** Admin forces a new password: the old one stops working now; the employee sets a new one from a link. */
  app.post<P<{ member: string }>>("/api/v1/organizations/:org/members/:member/reset-password", pre, async (req, reply) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:team:manage");
    const { m, orgRole } = await target(actor, req.params.member);
    if (!m.employee_id) throw badRequest("People reset their own password from their Zolexora account.");
    notSelf(actor, m);
    protectOwner(actor, orgRole);
    const who = (await d.team.getMemberIdentity(m.id))!;
    await d.repo.authDb.query("UPDATE zolexora_organization_memberships SET password_hash = $2 WHERE id = $1", [m.employee_id, `!reset!${CipherService.token()}`]);
    await d.security.revokeMemberSessions(m.id, "password_reset");
    const { invite, link } = await makeInvite(actor, {
      kind: "employee", email: who.email, phone_number: who.phone_number, org_role_id: orgRole!.id, product_roles: {}, reset_member_id: m.id,
    });
    await audit(d, req, actor.id, "member.password_reset_forced", m.id);
    return reply.status(201).send({ success: true, invite: inviteView(invite), ...(who.email ? {} : { link }) });
  });

  app.post<P>("/api/v1/organizations/:org/transfer-ownership", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:ownership:transfer");
    const b = parse(z.object({ member_id: id, mfa_code: z.string().optional() }).strict(), req.body);
    const { m, orgRole } = await target(actor, b.member_id);
    if (m.id === actor.member?.id) throw badRequest("You already own this business.");
    if (!m.user_id) throw badRequest("Ownership can go only to a person with a Zolexora account, not an employee login.");
    if (m.status !== "active") throw badRequest("That person is suspended.");
    await requireFreshMfa(d, actor, b.mfa_code);
    const owner = await d.team.getBuiltInRole(actor.org.id, "owner");
    const admin = await d.team.getBuiltInRole(actor.org.id, "admin");
    await d.repo.authDb.tx(async (tx) => {
      await d.team.setMemberRole(m.id, "org", owner.id, tx);
      if (actor.member) await d.team.setMemberRole(actor.member.id, "org", admin.id, tx);
    });
    await audit(d, req, actor.id, "org.ownership_transferred", actor.org.id, { to: m.id, previous_role: orgRole?.key });
    return { success: true };
  });

  // ── Roles ─────────────────────────────────────────────────────────────────
  app.get<P>("/api/v1/organizations/:org/roles", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    if (!actor.access.permissions.has("org:roles:assign")) need(actor, "org:team:view");
    const roles = await d.team.listRoles(actor.org.id);
    return {
      success: true,
      roles: roles.map((r) => ({ ...r, permissions: rolePermissions(r), blocks: r.built_in ? r.rules.map((x) => x.permission_key) : [] })),
    };
  });

  app.post<P>("/api/v1/organizations/:org/roles", pre, async (req, reply) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:roles:manage");
    const b = parse(z.object({
      scope: z.union([z.literal("org"), productScope]),
      name: z.string().trim().min(2).max(60),
      permissions: z.array(z.string()).max(500),
    }).strict(), req.body);
    const key = slug(b.name);
    if (key.length < 2) throw badRequest("Use letters or digits in the role name.");
    await validateRoleKeys(actor, b.scope, b.permissions);
    try {
      const role = await d.team.createRole(actor.org.id, b.scope, key, b.name, b.permissions, actor.member?.id ?? null);
      await audit(d, req, actor.id, "role.created", role.id, { scope: b.scope, name: b.name, permissions: b.permissions });
      return reply.status(201).send({ success: true, role: { ...role, permissions: rolePermissions(role) } });
    } catch (err: any) {
      if (err?.code === "23505") throw conflict("A role with this name already exists.", "ROLE_EXISTS");
      throw err;
    }
  });

  /**
   * Custom roles: name and permissions. Built-in roles (not owner): this business's blocks.
   * Disabling asks where the role's people move (`move_to`; product roles may use null = no product access).
   */
  app.patch<P<{ role: string }>>("/api/v1/organizations/:org/roles/:role", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:roles:manage");
    const b = parse(z.object({
      name: z.string().trim().min(2).max(60).optional(),
      permissions: z.array(z.string()).max(500).optional(),
      blocks: z.array(z.string()).max(100).optional(),
      disabled: z.boolean().optional(),
      move_to: id.nullable().optional(),
    }).strict(), req.body);
    const role = await orgRoleOr404(actor, req.params.role);
    if (isOwnerRole(role)) throw denied("The owner role can't be changed.");
    await notOwnRole(actor, role);

    if (role.built_in) {
      if (b.permissions || b.name) throw badRequest("Built-in roles keep their name and permissions; use blocks to take some away.");
      assertHolds(actor, BUILT_IN_GRANTS[role.key as BuiltInOrgRole]);
      if (b.blocks) {
        const base = new Set(BUILT_IN_GRANTS[role.key as BuiltInOrgRole]);
        const bad = b.blocks.filter((k) => !base.has(k));
        if (bad.length) throw badRequest(`Not in the ${role.name} role: ${bad.join(", ")}`);
      }
    } else {
      if (b.blocks) throw badRequest("Custom roles: change their permissions instead of blocking.");
      assertHolds(actor, rolePermissions(role));
      if (b.permissions) await validateRoleKeys(actor, role.scope, b.permissions);
    }

    if (b.disabled === true && !role.disabled) await moveMembers(actor, role, b.move_to);
    const updated = await d.team.updateRole(actor.org.id, role.id, {
      name: b.name,
      rules: role.built_in ? b.blocks : b.permissions,
      effect: role.built_in ? "block" : "grant",
      disabled: b.disabled,
    });
    await audit(d, req, actor.id, "role.updated", role.id, b);
    return { success: true, role: { ...updated, permissions: rolePermissions(updated) } };
  });

  app.delete<P<{ role: string }>>("/api/v1/organizations/:org/roles/:role", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:roles:manage");
    const { move_to } = parse(z.object({ move_to: id.optional() }), req.query);
    const role = await orgRoleOr404(actor, req.params.role);
    if (role.built_in) throw badRequest("Built-in roles can be disabled, not deleted.");
    await notOwnRole(actor, role);
    assertHolds(actor, rolePermissions(role));
    const moveTo = await checkMoveTarget(actor, role, move_to ?? null);
    await d.team.deleteRole(actor.org.id, role.id, moveTo);
    await audit(d, req, actor.id, "role.deleted", role.id, { move_to: moveTo });
    return { success: true };
  });

  /** Where people of a disabled/deleted role go. Business roles need a target; product roles may drop to none. */
  async function checkMoveTarget(actor: Actor, role: RoleRow, moveTo: string | null): Promise<string | null> {
    const holders = (await d.team.listRoles(actor.org.id)).find((r) => r.id === role.id)?.members ?? 0;
    if (!holders) return moveTo;
    if (!moveTo) {
      if (role.scope === "org") throw badRequest("Choose the role its people move to (move_to).", "ROLE_MOVE_REQUIRED");
      return null;
    }
    const to = await orgRoleOr404(actor, moveTo, role.scope);
    if (to.id === role.id || to.disabled) throw badRequest("Move people to a different, enabled role.");
    if (isOwnerRole(to)) throw denied("People can't be moved into the owner role this way.");
    assertHolds(actor, rolePermissions(to));
    return to.id;
  }
  async function moveMembers(actor: Actor, role: RoleRow, moveTo: string | null | undefined) {
    const to = await checkMoveTarget(actor, role, moveTo ?? null);
    await d.team.moveRoleMembers(role.id, to);
  }

  // ── Invites (ADR 0004 §3) ─────────────────────────────────────────────────
  const inviteView = (i: InviteRow) => ({
    id: i.id, kind: i.kind, email: i.email, phone_number: i.phone_number, org_role_id: i.org_role_id,
    product_roles: i.product_roles, expires_at: i.expires_at, reset: !!i.reset_member_id, created_at: i.created_at,
  });

  async function makeInvite(actor: Actor, i: Pick<InviteRow, "kind" | "email" | "phone_number" | "org_role_id" | "product_roles" | "reset_member_id">) {
    const token = CipherService.token();
    const invite = await d.team.createInvite({
      ...i,
      organization_id: actor.org.id,
      token_hash: d.cipher.hash(`invite:${token}`),
      invited_by: actor.member?.id ?? null,
      expires_at: new Date(Date.now() + CONSTANTS.BUSINESS.INVITE_TTL_SECONDS * 1000),
    });
    const link = `${d.inviteUrl}?token=${encodeURIComponent(token)}`;
    if (i.email) {
      const subject = i.reset_member_id ? `Set a new password for ${actor.org.name}` : `You're invited to ${actor.org.name} on Zolexora`;
      const text = i.reset_member_id
        ? `An admin of ${actor.org.name} asked you to set a new password. Open this link within 7 days:\n\n${link}\n\nIf you didn't expect this, ignore this email.`
        : `You have been invited to join ${actor.org.name} on Zolexora. Open this link within 7 days to accept:\n\n${link}\n\nIf you didn't expect this, ignore this email.`;
      await d.mail.send(i.email, subject, text);
    }
    return { invite, link };
  }

  /** The roles someone is given on joining: the giver must hold them; only an owner hands out owner. */
  async function checkGrantable(actor: Actor, orgRole: RoleRow, productRoles: Record<string, string> | undefined) {
    if (orgRole.disabled) throw badRequest("That role is disabled.");
    if (isOwnerRole(orgRole) && !actor.access.isOwner) throw denied("Only an owner can invite another owner.");
    membersOnlyUnlessManager(actor, orgRole);
    assertHolds(actor, rolePermissions(orgRole));
    for (const [product, roleId] of Object.entries(productRoles ?? {})) {
      const r = await orgRoleOr404(actor, roleId, product);
      if (r.disabled) throw badRequest(`Role ${r.name} is disabled.`);
      assertHolds(actor, rolePermissions(r));
    }
  }
  async function notInTeam(actor: Actor, email: string | null, phone: string | null) {
    const exists = await d.repo.authDb.query(
      `SELECT 1 FROM zolexora_org_members m
       LEFT JOIN zolexora_auth_users u ON u.id = m.user_id
       LEFT JOIN zolexora_organization_memberships e ON e.id = m.employee_id
       WHERE m.organization_id = $1 AND (($2::text IS NOT NULL AND COALESCE(u.email, e.email) = $2)
         OR ($3::text IS NOT NULL AND m.employee_id IS NOT NULL AND e.phone_number = $3))`,
      [actor.org.id, email, phone],
    );
    if (exists.rows.length) throw conflict("This person is already in the team.", "AUTH_EMPLOYEE_EXISTS");
  }

  /**
   * Direct create (kept from before invites): an admin sets the employee's first password.
   * Never an owner: owners are people with their own Zolexora account, added by invite.
   */
  app.post("/api/v1/auth/employee/create", pre, async (req, reply) => {
    const b = parse(z.object({
      org_id: z.string(),
      email: z.string().trim().toLowerCase().email().max(254).optional(),
      phone_number: z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/, "E.164, e.g. +919876543210").optional(),
      password: z.unknown(),
      role: z.enum(["owner", "admin", "manager", "member"]).optional(),
      org_role_id: id.optional(),
      product_roles: z.record(productScope, id).optional(),
      permissions: z.array(z.string()).max(0, "Give access with roles (role, org_role_id, product_roles), not a permissions list.").optional(),
    }).strict(), req.body);
    if (!isValidZolexoraOrgId(b.org_id)) {
      throw badRequest(`Invalid Zolexora Org ID format: "${b.org_id}". Expected ZX-ORG-XXXX-XXXX-XXXX`, "AUTH_INVALID_ORG_ID_FORMAT");
    }
    const actor = await actorFor(req, d, normalizeZolexoraOrgId(b.org_id));
    need(actor, "org:team:invite");
    if (!b.email && !b.phone_number) throw badRequest("Give an email or a phone number.");
    if (b.email && isPublicWebmailDomain(b.email)) {
      throw badRequest("Public email domains like gmail.com are not permitted for corporate employees.", "AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
    }
    const orgRole = b.org_role_id ? await orgRoleOr404(actor, b.org_role_id, "org") : await d.team.getBuiltInRole(actor.org.id, b.role ?? "member");
    if (isOwnerRole(orgRole)) {
      throw badRequest("Owners can't be created. Invite them as a person by email; they use their own Zolexora account.", "AUTH_OWNER_NEEDS_ZOLEXORA_ACCOUNT");
    }
    await checkGrantable(actor, orgRole, b.product_roles);
    await notInTeam(actor, b.email ?? null, b.phone_number ?? null);
    const hash = await hashNewPassword(b.password);
    if (await d.pwned.isPwned(b.password as string)) {
      throw badRequest("This password has appeared in a data breach. Choose a different one.", "AUTH_PASSWORD_PWNED");
    }
    const created = await d.repo.authDb.tx((tx) => addEmployee(tx, actor.org, {
      email: b.email ?? null, phone_number: b.phone_number ?? null, hash, invited_by: actor.member?.id ?? null,
      organization_id: actor.org.id, org_role_id: orgRole.id, product_roles: b.product_roles ?? {},
    }, orgRole));
    await audit(d, req, actor.id, "member.created", created.memberId, { org_role: orgRole.key });
    return reply.status(201).send({
      success: true,
      employee: { zolexora_id: created.zolexora_id, email: b.email ?? null, phone_number: b.phone_number ?? null, org_id: actor.org.zolexora_org_id, status: "active" },
      member_id: created.memberId,
    });
  });

  app.post<P>("/api/v1/organizations/:org/invites", pre, async (req, reply) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:team:invite");
    const b = parse(z.object({
      kind: z.enum(["person", "employee"]),
      email: z.string().trim().toLowerCase().email().max(254).optional(),
      phone_number: z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/, "E.164, e.g. +919876543210").optional(),
      org_role_id: id.optional(),
      product_roles: z.record(productScope, id).optional(),
    }).strict(), req.body);
    if (b.kind === "person" && !b.email) throw badRequest("A person is invited by email.");
    if (b.kind === "employee" && !b.email && !b.phone_number) throw badRequest("Give an email or a phone number.");
    if (b.kind === "person" && b.phone_number) throw badRequest("A person is invited by email only.");
    if (b.kind === "employee" && b.email && isPublicWebmailDomain(b.email)) {
      throw badRequest("Public email domains like gmail.com are not permitted for corporate employees.", "AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
    }

    const orgRole = b.org_role_id ? await orgRoleOr404(actor, b.org_role_id, "org") : await d.team.getBuiltInRole(actor.org.id, "member");
    if (isOwnerRole(orgRole) && b.kind === "employee") {
      throw badRequest("An owner must have a Zolexora account. Invite them as a person by email; they sign in or sign up before accepting.", "AUTH_OWNER_NEEDS_ZOLEXORA_ACCOUNT");
    }
    await checkGrantable(actor, orgRole, b.product_roles);
    await notInTeam(actor, b.email ?? null, b.kind === "employee" ? b.phone_number ?? null : null);

    const { invite, link } = await makeInvite(actor, {
      kind: b.kind, email: b.email ?? null, phone_number: b.phone_number ?? null, org_role_id: orgRole.id,
      product_roles: b.product_roles ?? {}, reset_member_id: null,
    });
    await audit(d, req, actor.id, "invite.created", invite.id, { kind: b.kind, org_role: orgRole.key });
    // Email invites go by email only; phone invites return the link for the inviter to share.
    return reply.status(201).send({ success: true, invite: inviteView(invite), ...(b.email ? {} : { link }) });
  });

  app.get<P>("/api/v1/organizations/:org/invites", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:team:invite");
    return { success: true, invites: (await d.team.listInvites(actor.org.id)).map(inviteView) };
  });

  app.delete<P<{ invite: string }>>("/api/v1/organizations/:org/invites/:invite", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:team:invite");
    if (!(await d.team.revokeInvite(actor.org.id, req.params.invite))) throw notFound("Invite not found or already used.");
    await audit(d, req, actor.id, "invite.revoked", req.params.invite);
    return { success: true };
  });

  // ── Opening an invite link (no business token needed) ─────────────────────
  const openInvite = async (token: string) => {
    if (typeof token !== "string" || token.length < 20 || token.length > 200) throw notFound("This invite link is not valid.");
    const i = await d.team.getInviteByHash(d.cipher.hash(`invite:${token}`));
    if (!i || i.accepted_at || i.revoked_at || new Date(i.expires_at) <= new Date()) {
      throw notFound("This invite link is not valid any more. Ask for a new one.");
    }
    const org = (await d.team.getOrgById(i.organization_id))!;
    if (org.status !== "active") throw notFound("This invite link is not valid any more.");
    return { i, org };
  };
  const mask = (email: string | null) => email?.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c) ?? null;

  app.get<{ Params: { token: string } }>("/api/v1/invites/:token", async (req) => {
    const { i, org } = await openInvite(req.params.token);
    const role = await d.team.getRole(org.id, i.org_role_id);
    return {
      success: true,
      invite: {
        kind: i.kind, reset: !!i.reset_member_id, organization: { zolexora_org_id: org.zolexora_org_id, name: org.name },
        role: role?.name ?? null, needs_zolexora_account: i.kind === "person", email: mask(i.email), phone_number: i.phone_number ? `••••${i.phone_number.slice(-4)}` : null,
        expires_at: i.expires_at,
      },
    };
  });

  app.post<{ Params: { token: string } }>("/api/v1/invites/:token/accept", async (req, reply) => {
    const { i, org } = await openInvite(req.params.token);
    return i.kind === "person" ? acceptAsPerson(req, reply, i, org.id) : acceptAsEmployee(req, reply, i, org);
  });

  /** Roles from the invite; a role deleted or disabled since then falls back to member / no product role. */
  async function addRoles(tx: typeof d.repo.authDb, memberId: string, i: Pick<InviteRow, "organization_id" | "org_role_id" | "product_roles">) {
    const t = d.team.with(tx);
    const orgRole = await t.getRole(i.organization_id, i.org_role_id);
    const fallback = await t.getBuiltInRole(i.organization_id, "member");
    await t.setMemberRole(memberId, "org", orgRole && !orgRole.disabled ? orgRole.id : fallback.id);
    for (const [product, roleId] of Object.entries(i.product_roles ?? {})) {
      const r = await t.getRole(i.organization_id, roleId);
      if (r && !r.disabled && r.scope === product) await t.setMemberRole(memberId, product, r.id);
    }
  }

  /** A new employee login plus its team membership and roles, inside the caller's transaction. */
  async function addEmployee(
    tx: typeof d.repo.authDb, org: { id: string },
    e: Pick<InviteRow, "email" | "phone_number" | "invited_by" | "organization_id" | "org_role_id" | "product_roles"> & { hash: string },
    orgRole: RoleRow | null,
  ) {
    let row;
    try {
      row = (await tx.query<{ id: string; zolexora_id: string }>(
        `INSERT INTO zolexora_organization_memberships (organization_id, zolexora_id, email, phone_number, password_hash, role, permissions, status)
         VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, 'active') RETURNING id, zolexora_id`,
        [org.id, generateZolexoraId(), e.email, e.phone_number, e.hash, orgRole?.built_in ? orgRole.key : "member"],
      )).rows[0];
    } catch (err: any) {
      if (err?.code === "23505") throw conflict("This person is already in the team.", "AUTH_EMPLOYEE_EXISTS");
      throw err;
    }
    const m = (await tx.query<{ id: string }>(
      "INSERT INTO zolexora_org_members (organization_id, employee_id, invited_by) VALUES ($1, $2, $3) RETURNING id",
      [org.id, row.id, e.invited_by],
    )).rows[0];
    await addRoles(tx, m.id, e);
    return { memberId: m.id, zolexora_id: row.zolexora_id };
  }

  async function acceptAsPerson(req: FastifyRequest, reply: any, i: InviteRow, orgId: string) {
    const signIn = () => new AppError({
      statusCode: 401, code: "AUTH_ZOLEXORA_ACCOUNT_REQUIRED",
      message: "Sign in to your Zolexora account (or create one with the invited email), then accept the invite.",
    });
    if (!req.headers.authorization) throw signIn();
    await authenticate(req, reply);
    if (req.tokenPayload?.type !== "user") throw signIn();
    const user = (await d.repo.authDb.query<{ id: string; email: string | null; email_verified_at: Date | null }>(
      "SELECT id, email, email_verified_at FROM zolexora_auth_users WHERE id::text = $1", [req.user!.uid],
    )).rows[0];
    if (!user?.email || user.email !== i.email || !user.email_verified_at) {
      throw denied("This invite is for a different email. Sign in with the invited email address.");
    }
    if (await d.team.getMemberForUser(orgId, user.id)) throw conflict("You are already in this team.", "AUTH_EMPLOYEE_EXISTS");
    const memberId = await d.repo.authDb.tx(async (tx) => {
      const m = (await tx.query<{ id: string }>(
        "INSERT INTO zolexora_org_members (organization_id, user_id, invited_by) VALUES ($1, $2, $3) RETURNING id",
        [orgId, user.id, i.invited_by],
      )).rows[0];
      if (!(await d.team.consumeInvite(tx, i.id, m.id))) throw notFound("This invite link was already used.");
      await addRoles(tx, m.id, i);
      return m.id;
    });
    await audit(d, req, memberId, "invite.accepted", i.id, { kind: "person" });
    return reply.status(201).send({ success: true, member_id: memberId });
  }

  async function acceptAsEmployee(req: FastifyRequest, reply: any, i: InviteRow, org: { id: string; zolexora_org_id: string }) {
    await d.turnstile.verifyToken(getTurnstileToken(req), { remoteIp: getRemoteIp(req), expectedAction: "invite-accept" });
    const { password } = (req.body ?? {}) as { password?: unknown };
    const hash = await hashNewPassword(password);
    if (await d.pwned.isPwned(password as string)) {
      throw badRequest("This password has appeared in a data breach. Choose a different one.", "AUTH_PASSWORD_PWNED");
    }

    if (i.reset_member_id) {
      const m = await d.team.getMember(i.reset_member_id);
      if (!m?.employee_id) throw notFound("This invite link is not valid any more.");
      await d.repo.authDb.tx(async (tx) => {
        if (!(await d.team.consumeInvite(tx, i.id, m.id))) throw notFound("This invite link was already used.");
        await tx.query("UPDATE zolexora_organization_memberships SET password_hash = $2 WHERE id = $1", [m.employee_id, hash]);
      });
      await d.security.revokeMemberSessions(m.id, "password_reset");
      const who = (await d.team.getMemberIdentity(m.id))!;
      await audit(d, req, m.id, "member.password_reset", m.id);
      return reply.status(200).send({ success: true, zolexora_id: who.zolexora_id, org_id: org.zolexora_org_id });
    }

    const orgRole = await d.team.getRole(org.id, i.org_role_id);
    const created = await d.repo.authDb.tx(async (tx) => {
      const r = await addEmployee(tx, org, { ...i, hash }, orgRole);
      if (!(await d.team.consumeInvite(tx, i.id, r.memberId))) throw notFound("This invite link was already used.");
      return r;
    });
    await audit(d, req, created.memberId, "invite.accepted", i.id, { kind: "employee" });
    return reply.status(201).send({ success: true, zolexora_id: created.zolexora_id, org_id: org.zolexora_org_id, member_id: created.memberId });
  }
}
