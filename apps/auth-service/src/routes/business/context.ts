import { FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../plugins/error-handler.js";
import { Access, MFA_SENSITIVE } from "../../rbac/engine.js";
import { BUILT_IN_GRANTS, BuiltInOrgRole, COMMON_PERMISSIONS, ORG_PERMISSIONS } from "../../rbac/permissions.js";
import { BusinessSessionService } from "../../services/business-session.service.js";
import { CipherService } from "../../services/cipher.service.js";
import { MailService } from "../../services/mail.service.js";
import { PwnedPasswordService } from "../../services/pwned.service.js";
import { TokenService } from "../../services/token.service.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { LockoutService } from "../../services/lockout.service.js";
import { CatalogStore } from "../../stores/catalog.store.js";
import { MfaOwner, SecurityStore } from "../../stores/security.store.js";
import { matchTotp } from "../../services/totp.service.js";
import { MemberRow, OrgRow, TeamStore } from "../../stores/team.store.js";
import { PostgresAuthRepository } from "../../repositories/postgres-auth.repository.js";
import { RoleRow } from "../../rbac/engine.js";
import { getRemoteIp } from "../auth/request.js";

/** Everything the business routes need, built once in app.ts. */
export interface BusinessDeps {
  repo: PostgresAuthRepository;
  team: TeamStore;
  security: SecurityStore;
  catalog: CatalogStore;
  sessions: BusinessSessionService;
  tokens: TokenService;
  cipher: CipherService;
  mail: MailService;
  pwned: PwnedPasswordService;
  lockout: LockoutService;
  turnstile: TurnstileService;
  inviteUrl: string;
  productKeys: Record<string, string>;
}

export const badRequest = (message: string, code = "BAD_REQUEST") => new AppError({ statusCode: 400, code, message });
export const notFound = (message = "Not found.") => new AppError({ statusCode: 404, code: "NOT_FOUND", message });
export const conflict = (message: string, code = "CONFLICT") => new AppError({ statusCode: 409, code, message });
export const denied = (message: string) => new AppError({ statusCode: 403, code: "AUTH_FORBIDDEN", message });

export interface Actor {
  org: OrgRow;
  member: MemberRow | null; // null for platform admins repairing a business
  access: Access;
  isPlatformAdmin: boolean;
  id: string; // for audit: member id or "admin:<id>"
}

/** All business-level permissions, for platform admins (they repair; guard rails still apply). */
const ALL = new Set([...Object.keys(ORG_PERMISSIONS), ...Object.keys(COMMON_PERMISSIONS)]);

/**
 * Who is acting on business `orgParam`, with access recomputed from the database (never trusted from the token).
 * Accepted: a business-session token for that business, a person's Track 1 token (if they are a member),
 * a legacy employee token of that business, or a platform admin.
 */
export async function actorFor(req: FastifyRequest, d: BusinessDeps, orgParam: string): Promise<Actor> {
  const u = req.user!;
  const org = await d.team.getOrg(orgParam);
  if (!org || org.status === "deactivated") throw notFound("Business not found.");

  if (u.is_platform_admin) {
    const access: Access = { isOwner: false, orgRoleKey: null, permissions: new Set(ALL), explain: {}, mfaSetupRequired: false };
    return { org, member: null, access, isPlatformAdmin: true, id: `admin:${u.uid}` };
  }

  const p = req.tokenPayload!;
  let member: MemberRow | null = null;
  if (p.type === "member") member = p.org_id === org.zolexora_org_id && p.member_id ? await d.team.getMember(p.member_id) : null;
  else if (p.type === "user") member = await d.team.getMemberForUser(org.id, u.uid);
  else if (p.type === "employee") member = await d.team.getMemberForEmployee(u.uid);
  if (!member || member.organization_id !== org.id) throw denied("You are not a member of this business.");

  const a = (await d.sessions.access(member.id))!;
  const access = a.access;
  // When the business requires MFA, sensitive actions need a session opened with an MFA code.
  if (org.mfa_policy === "required" && !(p.type === "member" && p.mfa)) {
    for (const k of MFA_SENSITIVE) {
      if (access.permissions.delete(k)) (access.explain[k] ??= []).push("needs a session opened with an MFA code");
    }
  }
  return { org, member, access, isPlatformAdmin: false, id: member.id };
}

export function need(actor: Actor, permission: string): void {
  if (!actor.access.permissions.has(permission)) {
    throw denied(actor.access.explain[permission]?.at(-1) ? `Not allowed: ${actor.access.explain[permission].at(-1)}.` : `You need ${permission}.`);
  }
}

/** What a role gives, for the holding rule. Built-in roles: code grants minus the business's blocks. */
export function rolePermissions(role: RoleRow): string[] {
  if (role.built_in) {
    const blocked = new Set(role.rules.filter((r) => r.effect === "block").map((r) => r.permission_key));
    return (BUILT_IN_GRANTS[role.key as BuiltInOrgRole] ?? []).filter((p) => !blocked.has(p));
  }
  return role.rules.filter((r) => r.effect === "grant").map((r) => r.permission_key);
}

/** Holding rule: nobody gives what they don't have. The owner holds everything. */
export function assertHolds(actor: Actor, keys: Iterable<string>): void {
  if (actor.access.isOwner || actor.isPlatformAdmin) return;
  const missing = [...keys].filter((k) => !actor.access.permissions.has(k));
  if (missing.length) throw denied(`You can't give permissions you don't have: ${missing.join(", ")}.`);
}

export async function audit(d: BusinessDeps, req: FastifyRequest, actor: string | null, action: string, target: string | null, details: unknown = null) {
  await d.repo.authDb.query(
    "INSERT INTO zolexora_auth_audit_logs (actor_id, action, target_id, details, ip_address) VALUES ($1, $2, $3, $4::jsonb, $5)",
    [actor, action, target, details === null ? null : JSON.stringify(details), getRemoteIp(req)],
  );
}

export const clientInfo = (req: FastifyRequest) => ({
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
  ip: getRemoteIp(req),
});

export const str = (v: unknown, max = 200): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

export const parse = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> => {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw badRequest(r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), "VALIDATION_ERROR");
  return r.data;
};

/**
 * Checks a 6-digit authenticator code. "not_enrolled" when the person has no confirmed authenticator.
 * Each code works once (the used time step is stored).
 */
export async function checkMfaCode(d: BusinessDeps, who: MfaOwner, code: unknown): Promise<"ok" | "bad" | "not_enrolled"> {
  const f = await d.security.getFactor(who);
  if (!f?.confirmed_at) return "not_enrolled";
  const step = matchTotp(d.cipher.decrypt(f.secret_encrypted), code);
  if (step === null) return "bad";
  return (await d.security.useStep(f.id, step, false)) ? "ok" : "bad";
}

export const mfaError = (code: "AUTH_MFA_REQUIRED" | "AUTH_MFA_INVALID", message: string) =>
  new AppError({ statusCode: 401, code, message });

/** Sensitive actions (ownership, payouts): a fresh code, if the person has an authenticator. */
export async function requireFreshMfa(d: BusinessDeps, actor: Actor, code: unknown, mandatory = false): Promise<void> {
  if (!actor.member) return; // platform admin repair
  const r = await checkMfaCode(d, { user_id: actor.member.user_id, employee_id: actor.member.employee_id }, code);
  if (r === "ok") return;
  if (r === "not_enrolled" && !mandatory) return;
  if (r === "not_enrolled") throw denied("Set up an authenticator app first (MFA).");
  throw mfaError(code ? "AUTH_MFA_INVALID" : "AUTH_MFA_REQUIRED", code ? "That code is not valid." : "Enter the code from your authenticator app.");
}
