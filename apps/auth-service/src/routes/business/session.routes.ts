import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { disabled } from "../../services/business-session.service.js";
import { MfaOwner } from "../../stores/security.store.js";
import { matchTotp, newTotpSecret, otpauthUrl } from "../../services/totp.service.js";
import { getRemoteIp } from "../auth/request.js";
import { productKey } from "../auth/track2-employee.routes.js";
import { audit, badRequest, BusinessDeps, checkMfaCode, clientInfo, conflict, denied, mfaError, notFound, parse } from "./context.js";

/** The person or employee behind the token (MFA belongs to them, not to one business). */
const mfaOwner = (req: FastifyRequest): MfaOwner => {
  const p = req.tokenPayload!;
  if (p.type === "user") return { user_id: p.uid, employee_id: null };
  if (p.type === "employee") return { user_id: null, employee_id: p.uid };
  if (p.type === "member") return { user_id: p.user_id ?? null, employee_id: p.employee_id ?? null };
  throw denied("Not available for this account.");
};

export async function businessSessionRoutes(app: FastifyInstance, d: BusinessDeps) {
  const authenticate = createAuthMiddleware({ tokenService: d.tokens, repo: d.repo });
  const pre = { preHandler: [authenticate] };
  const memberToken = (req: FastifyRequest) => {
    const u = req.user!;
    if (req.tokenPayload?.type !== "member" || !u.member_id || !u.session_id) throw denied("Use a business session token.");
    return { memberId: u.member_id, sessionId: u.session_id };
  };

  app.get("/.well-known/jwks.json", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return d.tokens.jwks();
  });

  /** "Continue as <business>" for a signed-in person (ADR 0004 §3a). */
  app.post("/api/v1/auth/org-session", pre, async (req) => {
    if (req.tokenPayload?.type !== "user") throw denied("Sign in with your Zolexora account.");
    const b = parse(z.object({ org_id: z.string(), product: z.string().optional(), mfa_code: z.string().optional() }).strict(), req.body);
    const org = await d.team.getOrg(b.org_id);
    const member = org && org.status !== "deactivated" ? await d.team.getMemberForUser(org.id, req.user!.uid) : null;
    if (!org || !member) throw notFound("Business not found, or you are not in its team.");
    if (member.status !== "active" || org.status !== "active") throw disabled();
    const product = b.product === undefined ? null : productKey(b.product, d.productKeys);
    if (b.product !== undefined && !product) throw badRequest(`Unknown product: ${b.product}`, "AUTH_UNKNOWN_PRODUCT");

    // Enrolled people confirm with a code unless the business has MFA off.
    let mfa = false;
    const keys = [`mfa:${member.id}`];
    if (b.mfa_code !== undefined || org.mfa_policy !== "off") {
      await d.lockout.check(keys);
      const r = await checkMfaCode(d, { user_id: member.user_id, employee_id: null }, b.mfa_code);
      if (r === "ok") {
        mfa = true;
        await d.lockout.success(keys, getRemoteIp(req));
      } else if (r === "bad") {
        if (b.mfa_code === undefined) throw mfaError("AUTH_MFA_REQUIRED", "Enter the code from your authenticator app.");
        await d.lockout.failure(keys, getRemoteIp(req));
        throw mfaError("AUTH_MFA_INVALID", "That code is not valid.");
      }
      // not enrolled: the session opens; with policy "required" sensitive permissions wait (mfa_setup_required).
    }
    const s = await d.sessions.open(member.id, product, { ...clientInfo(req), mfa });
    await audit(d, req, member.id, "session.opened", s.session_id, { product, mfa });
    return { success: true, ...s };
  });

  app.post("/api/v1/auth/token/refresh", async (req) => {
    const { refresh_token } = (req.body ?? {}) as { refresh_token?: unknown };
    return { success: true, ...(await d.sessions.refresh(refresh_token)) };
  });

  app.post("/api/v1/auth/session/logout", pre, async (req) => {
    const { memberId, sessionId } = memberToken(req);
    await d.security.revokeSession(sessionId, "logout", memberId);
    return { success: true };
  });

  app.get("/api/v1/auth/sessions", pre, async (req) => {
    const { memberId, sessionId } = memberToken(req);
    const rows = await d.security.listSessions(memberId);
    return {
      success: true,
      sessions: rows.map((s) => ({
        id: s.id, product: s.product, user_agent: s.user_agent, ip: s.ip, created_at: s.created_at,
        last_used_at: s.last_used_at, mfa: !!s.mfa_at, current: s.id === sessionId,
      })),
    };
  });

  app.delete<{ Params: { id: string } }>("/api/v1/auth/sessions/:id", pre, async (req) => {
    const { memberId } = memberToken(req);
    if (!(await d.security.revokeSession(req.params.id, "signed_out_by_user", memberId))) throw notFound("Session not found.");
    return { success: true };
  });

  app.post("/api/v1/auth/sessions/revoke-others", pre, async (req) => {
    const { memberId, sessionId } = memberToken(req);
    return { success: true, revoked: await d.security.revokeMemberSessions(memberId, "signed_out_by_user", sessionId) };
  });

  app.get("/api/v1/auth/login-history", pre, async (req) => {
    const { memberId } = memberToken(req);
    return { success: true, attempts: await d.security.loginHistory(memberId) };
  });

  // ── MFA (authenticator app) ───────────────────────────────────────────────
  app.post("/api/v1/auth/mfa/setup", pre, async (req) => {
    const who = mfaOwner(req);
    const f = await d.security.getFactor(who);
    if (f?.confirmed_at) throw conflict("An authenticator is already set up. Remove it first to set up a new one.", "AUTH_MFA_EXISTS");
    const secret = newTotpSecret();
    await d.security.startFactor(who, d.cipher.encrypt(secret));
    const account = req.user!.zolexora_id ?? req.user!.email ?? "account";
    return { success: true, secret, otpauth_url: otpauthUrl(secret, account) };
  });

  app.post("/api/v1/auth/mfa/confirm", pre, async (req) => {
    const who = mfaOwner(req);
    const { code } = parse(z.object({ code: z.string() }).strict(), req.body);
    const f = await d.security.getFactor(who);
    if (!f) throw badRequest("Start the setup first.", "AUTH_MFA_NOT_STARTED");
    if (f.confirmed_at) throw conflict("Already set up.", "AUTH_MFA_EXISTS");
    const step = matchTotp(d.cipher.decrypt(f.secret_encrypted), code);
    if (step === null || !(await d.security.useStep(f.id, step, true))) throw mfaError("AUTH_MFA_INVALID", "That code is not valid.");
    if (req.user!.session_id) await d.security.markMfa(req.user!.session_id);
    await audit(d, req, who.user_id ?? who.employee_id, "mfa.enabled", null);
    return { success: true };
  });

  app.delete("/api/v1/auth/mfa", pre, async (req) => {
    const who = mfaOwner(req);
    const { code } = parse(z.object({ code: z.string() }).strict(), req.body);
    const r = await checkMfaCode(d, who, code);
    if (r === "not_enrolled") throw notFound("No authenticator is set up.");
    if (r !== "ok") throw mfaError("AUTH_MFA_INVALID", "That code is not valid.");
    await d.security.deleteFactor(who);
    await audit(d, req, who.user_id ?? who.employee_id, "mfa.disabled", null);
    return { success: true };
  });
}
