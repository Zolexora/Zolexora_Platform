import { FastifyInstance, FastifyRequest } from "fastify";
import { hashPassword, isValidZolexoraOrgId, normalizeZolexoraOrgId, verifyPassword } from "@zolexora/utils";
import { AppError } from "../../plugins/error-handler.js";
import { CONSTANTS } from "../../config/constants.js";
import { PRODUCT_KEY_RE } from "../../rbac/permissions.js";
import { disabled } from "../../services/business-session.service.js";
import { assertPasswordSize, getRemoteIp, getTurnstileToken } from "./request.js";
import { BusinessDeps, checkMfaCode, clientInfo, mfaError } from "../business/context.js";

interface EmployeeLoginBody {
  product?: string;
  org_id?: string;
  user_id_or_email?: string;
  password?: string;
  login_ticket?: string;
  turnstile_token?: string;
}

interface Candidate {
  id: string; // employee (membership) id
  member_id: string;
  password_hash: string;
  status: string;
  member_status: string;
  zolexora_org_id: string;
  org_name: string;
  org_status: string;
  mfa_policy: string;
}

const invalidOrgId = (raw: string) =>
  new AppError({
    statusCode: 400,
    code: "AUTH_INVALID_ORG_ID_FORMAT",
    message: `Invalid Zolexora Org ID format: "${raw}". Expected ZX-ORG-XXXX-XXXX-XXXX`,
  });
const invalidCredentials = () =>
  new AppError({ statusCode: 401, code: "AUTH_INVALID_CREDENTIALS", message: "Invalid employee credentials" });

/** "zolexora-tms" (legacy) or "tms" → the product key used in roles, when that product is registered. */
export const productKey = (raw: unknown, known: Record<string, string>): string | null => {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase().replace(/^zolexora-/, "").replace(/-/g, "_");
  return PRODUCT_KEY_RE.test(k) && k in known ? k : null;
};

/**
 * Track 2: employees (ADR 0005 §6). Sign in with ZX id, phone or email; the org id is optional.
 * With an email used in several businesses, the picker appears only after the password is right.
 */
export async function track2EmployeeRoutes(app: FastifyInstance, d: BusinessDeps) {
  // Same work for unknown identifiers as for real ones (no timing hint about who exists).
  const dummyHash = hashPassword("zolexora-timing-equaliser", "scrypt");

  const findCandidates = async (identifier: string, orgId: string | null): Promise<Candidate[]> =>
    (await d.repo.authDb.query<Candidate>(
      `SELECT e.id, m.id AS member_id, e.password_hash, e.status, m.status AS member_status,
              o.zolexora_org_id, o.name AS org_name, o.status AS org_status, o.mfa_policy
       FROM zolexora_organization_memberships e
       JOIN zolexora_org_members m ON m.employee_id = e.id
       JOIN zolexora_organizations o ON o.id = e.organization_id
       WHERE o.status <> 'deactivated' AND ($2::text IS NULL OR o.zolexora_org_id = $2)
         AND (lower(e.zolexora_id) = $1 OR e.email = $1 OR e.phone_number = $1)
       ORDER BY o.created_at LIMIT 20`,
      [identifier, orgId],
    )).rows;

  /** Final step for one employee: MFA if they have it, then a business session. */
  const finish = async (req: FastifyRequest, c: Candidate, productRaw: string | undefined) => {
    if (c.status !== "active" || c.member_status !== "active" || c.org_status !== "active") throw disabled();
    const product = productKey(productRaw, d.productKeys);
    const factor = await d.security.getFactor({ user_id: null, employee_id: c.id });
    if (factor?.confirmed_at) {
      const mfa_ticket = d.tokens.signJwt(
        { uid: c.member_id, member_id: c.member_id, product: productRaw, type: "mfa_ticket" }, CONSTANTS.BUSINESS.TICKET_TTL_SECONDS,
      );
      return { success: true, mfa_required: true, mfa_ticket };
    }
    return employeeResponse(c.member_id, product, productRaw, false, req);
  };

  /** Legacy shape (customToken, claims, user, org) plus the new access/refresh tokens. */
  const employeeResponse = async (memberId: string, product: string | null, productRaw: string | undefined, mfa: boolean, req: FastifyRequest) => {
    const s = await d.sessions.open(memberId, product, { ...clientInfo(req), mfa });
    const employeeId = (await d.team.getMember(memberId))!.employee_id!;
    const claims = {
      zolexora_id: s.member.zolexora_id,
      org_id: s.org.zolexora_org_id,
      role: s.claims.role,
      product: productRaw,
      permissions: s.claims.permissions,
    };
    return {
      success: true,
      customToken: d.tokens.mintEmployeeCustomToken(employeeId, claims, s.member.email ?? ""),
      claims,
      user: { uid: employeeId, zolexora_id: s.member.zolexora_id, email: s.member.email, phone_number: s.member.phone_number, status: "active" },
      org: { zolexora_org_id: s.org.zolexora_org_id, name: s.org.name, role: s.claims.role },
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      token_type: s.token_type,
      expires_in: s.expires_in,
      session_id: s.session_id,
      mfa_setup_required: s.claims.mfa_setup_required,
    };
  };

  app.post<{ Body: EmployeeLoginBody }>(
    "/api/v1/auth/employee/login",
    { schema: { description: "Employee login: ZX id, phone or email + password; org id optional", tags: ["Track 2: Organization Employee"] } },
    async (req) => {
      const body = req.body ?? {};
      const ip = getRemoteIp(req);
      await d.turnstile.verifyToken(getTurnstileToken(req), { remoteIp: ip, expectedAction: "track2-employee-login" });

      let orgId: string | null = null;
      if (body.org_id !== undefined && body.org_id !== "") {
        if (!isValidZolexoraOrgId(body.org_id)) throw invalidOrgId(body.org_id);
        orgId = normalizeZolexoraOrgId(body.org_id);
      }

      // Step 2 of an email login: the business was picked after a correct password.
      if (body.login_ticket) {
        const t = d.tokens.verifyAndDecode(body.login_ticket);
        const p = t.payload as any;
        if (!t.valid || p?.type !== "login_ticket" || !orgId) throw invalidCredentials();
        const c = (await findCandidates(String(p.identifier), orgId)).find((x) => (p.members as string[]).includes(x.member_id));
        if (!c) throw invalidCredentials();
        return finish(req, c, body.product);
      }

      const identifier = (body.user_id_or_email ?? "").toLowerCase().trim().replace(/\s+/g, "");
      const keys = [`t2:ip:${ip}`, `t2:${ip}:${identifier}`];
      await d.lockout.check(keys);
      const password = body.password ?? "";
      assertPasswordSize(password);

      const candidates = identifier ? await findCandidates(identifier, orgId) : [];
      const matches: Candidate[] = [];
      if (!candidates.length) await verifyPassword(password, await dummyHash);
      for (const c of candidates) if (await verifyPassword(password, c.password_hash)) matches.push(c);

      if (!matches.length) {
        await d.lockout.failure([...keys, ...candidates.map((c) => `member:${c.member_id}`)], ip);
        throw invalidCredentials();
      }
      await d.lockout.success([...keys, ...matches.map((c) => `member:${c.member_id}`)], ip);

      if (matches.length > 1) {
        const login_ticket = d.tokens.signJwt(
          { uid: "login", identifier, members: matches.map((m) => m.member_id), type: "login_ticket" }, CONSTANTS.BUSINESS.TICKET_TTL_SECONDS,
        );
        return {
          success: true,
          choose_business: true,
          login_ticket,
          businesses: matches.map((m) => ({ zolexora_org_id: m.zolexora_org_id, name: m.org_name })),
        };
      }
      return finish(req, matches[0], body.product);
    },
  );

  /** Step 2 when the employee has an authenticator app. */
  app.post<{ Body: { mfa_ticket?: string; code?: string } }>("/api/v1/auth/employee/mfa", async (req) => {
    const t = d.tokens.verifyAndDecode(req.body?.mfa_ticket ?? "");
    const p = t.payload as any;
    if (!t.valid || p?.type !== "mfa_ticket" || !p.member_id) throw mfaError("AUTH_MFA_INVALID", "This sign-in has expired. Start again.");
    const m = await d.team.getMember(p.member_id);
    if (!m?.employee_id) throw invalidCredentials();
    const keys = [`mfa:${m.id}`];
    await d.lockout.check(keys);
    const r = await checkMfaCode(d, { user_id: null, employee_id: m.employee_id }, req.body?.code);
    if (r !== "ok") {
      await d.lockout.failure(keys, getRemoteIp(req));
      throw mfaError("AUTH_MFA_INVALID", "That code is not valid.");
    }
    await d.lockout.success(keys, getRemoteIp(req));
    return employeeResponse(m.id, productKey(p.product, d.productKeys), p.product, true, req);
  });
}
