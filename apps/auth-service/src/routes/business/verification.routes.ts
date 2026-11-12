import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { requiredChecks } from "../../verification/rules.js";
import { VerificationService, VRow, vView } from "../../verification/verification.service.js";
import { BusinessKind } from "../../business/identifiers.js";
import { actorFor, audit, badRequest, BusinessDeps, denied, need, notFound, parse, requireFreshMfa } from "./context.js";

const docIds = z.array(z.string().min(1).max(100)).max(10).optional();
const ORG_SUBMIT = ["pan", "gst", "registration", "authority"] as const;

/** A check as callers see it, plus the next step for async flows (Digio SDK, UPI pay link). */
const out = (v: VRow & { action?: unknown }, required = true) => ({ ...vView(v, v.check_type, required, true), ...(v.action ? { action: v.action } : {}) });

export async function verificationRoutes(app: FastifyInstance, d: BusinessDeps & { verification: VerificationService }) {
  const authenticate = createAuthMiddleware({ tokenService: d.tokens, repo: d.repo });
  const pre = { preHandler: [authenticate] };
  const vs = d.verification;
  type P<T = {}> = { Params: { org: string } & T };

  const person = async (req: FastifyRequest) => {
    if (req.tokenPayload?.type !== "user") throw denied("Sign in with your Zolexora account.");
    const u = (await d.repo.authDb.query<{ id: string; zolexora_id: string; email: string | null; phone_number: string | null; display_name: string | null }>(
      "SELECT id, zolexora_id, email, phone_number, display_name FROM zolexora_auth_users WHERE id::text = $1 AND status = 'active'", [req.user!.uid],
    )).rows[0];
    if (!u) throw denied("Account is not active.");
    return u;
  };
  const adminOnly = (req: FastifyRequest) => {
    if (!req.user?.is_platform_admin) throw denied("Platform admins only.");
    return `admin:${req.user.uid}`;
  };

  // ── What is switched on, and which documents are accepted ─────────────────
  app.get("/api/v1/verification/config", async () => {
    const docs = (await d.repo.authDb.query(
      `SELECT key, label, check_type, business_kinds, official_url, verify_url, instructions
       FROM zolexora_verification_document_types WHERE active ORDER BY sort_order, key`,
    )).rows;
    return {
      success: true,
      checks: Object.fromEntries((["identity", "pan", "gst", "registration", "authority", "bank"] as const).map((c) => [c, {
        enabled: vs.enabled(c),
        methods: c === "bank" ? vs.cfg.bankMethods : vs.cfg.providers[c],
      }])),
      rulebook: Object.fromEntries((["individual", "proprietor", "company", "llp", "partnership", "huf", "trust", "society", "public_body"] as BusinessKind[])
        .map((k) => [k, requiredChecks(k).filter((c) => vs.enabled(c))])),
      documents: docs,
    };
  });

  // ── A person's identity ───────────────────────────────────────────────────
  app.get("/api/v1/me/verification", pre, async (req) => {
    const u = await person(req);
    return { success: true, identity: vView(await vs.get({ user_id: u.id }, "identity"), "identity", true, vs.enabled("identity")) };
  });

  app.post("/api/v1/me/verification/identity", { ...pre, bodyLimit: 3 * 1024 * 1024 }, async (req) => {
    const u = await person(req);
    const b = parse(z.object({
      method: z.enum(["aadhaar_offline", "digio", "manual"]),
      zip_base64: z.string().max(2_800_000).optional(),
      share_code: z.string().optional(),
      document_ids: docIds,
    }).strict(), req.body);
    if (b.method === "manual") {
      // Only the person's own e-PAN.
      for (const id of b.document_ids ?? []) {
        const doc = (await d.repo.authDb.query("SELECT 1 FROM zolexora_kyc_documents WHERE document_id = $1 AND owner_id = $2 AND document_type = 'e_pan_person'", [id, u.zolexora_id])).rows;
        if (!doc.length) throw badRequest(`Document ${id} is not your e-PAN upload.`, "VERIFICATION_BAD_DOCUMENT");
      }
    }
    const v = await vs.identity(u, b);
    await audit(d, req, u.id, "verification.identity_submitted", v.id, { method: b.method, status: v.status });
    return { success: true, identity: out(v) };
  });

  app.post("/api/v1/me/verification/identity/complete", pre, async (req) => {
    const u = await person(req);
    return { success: true, identity: out(await vs.completeIdentity(u.id)) };
  });

  // ── Business checks ───────────────────────────────────────────────────────
  app.get<P>("/api/v1/organizations/:org/verification", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:verification:view");
    return { success: true, ...(await vs.orgSummary(actor.org)) };
  });

  app.post<P>("/api/v1/organizations/:org/verification/authority/email-code", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:verification:submit");
    const { email } = parse(z.object({ email: z.string().email().max(254) }).strict(), req.body);
    await vs.sendOfficialEmailCode(actor.org, email);
    return { success: true };
  });

  app.post<P<{ check: string }>>("/api/v1/organizations/:org/verification/:check", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:verification:submit");
    const check = parse(z.enum(ORG_SUBMIT), req.params.check);
    const b = parse(z.object({
      method: z.string().optional(),
      document_ids: docIds,
      gstin: z.string().max(20).optional(),
      cin: z.string().max(30).optional(),
      llpin: z.string().max(10).optional(),
      udyam: z.string().max(30).optional(),
      basis: z.enum(["named_in_records", "authorisation_letter"]).optional(),
      designation: z.string().max(80).optional(),
      din: z.string().max(20).optional(),
      official_email: z.string().max(254).optional(),
      email_code: z.string().max(10).optional(),
    }).strict(), req.body);
    const v = await vs.submit(actor.org, actor.id, check, b);
    await audit(d, req, actor.id, `verification.${check}_submitted`, v.id, { status: v.status, provider: v.provider });
    return { success: true, verification: out(v) };
  });

  app.post<P<{ check: string }>>("/api/v1/organizations/:org/verification/:check/complete", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:verification:submit");
    const check = parse(z.enum(ORG_SUBMIT), req.params.check);
    return { success: true, verification: out(await vs.complete(actor.org, check)) };
  });

  // ── Payout accounts (org:payouts:manage + a fresh MFA code) ───────────────
  const mfaCode = (req: FastifyRequest) => {
    const h = req.headers["x-mfa-code"];
    return (typeof h === "string" ? h : undefined) ?? (req.body as any)?.mfa_code;
  };
  const payoutGuard = async (req: FastifyRequest, org: string) => {
    const actor = await actorFor(req, d, org);
    need(actor, "org:payouts:manage");
    // Owners confirm with a code if they have an authenticator; anyone else always must.
    await requireFreshMfa(d, actor, mfaCode(req), !actor.access.isOwner && !actor.isPlatformAdmin);
    return actor;
  };

  app.get<P>("/api/v1/organizations/:org/payout-accounts", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:verification:view");
    return { success: true, accounts: (await vs.listPayouts(actor.org.id)).map(vs.payoutView) };
  });

  app.post<P>("/api/v1/organizations/:org/payout-accounts", pre, async (req, reply) => {
    const actor = await payoutGuard(req, req.params.org);
    const b = parse(z.object({
      kind: z.enum(["bank", "upi"]),
      holder_name: z.string().trim().min(2).max(140),
      account_number: z.string().max(30).optional(),
      ifsc: z.string().max(15).optional(),
      vpa: z.string().max(260).optional(),
      is_primary: z.boolean().optional(),
      mfa_code: z.string().optional(),
    }).strict(), req.body);
    const a = await vs.addPayout(actor.org.id, actor.member?.id ?? null, b);
    await audit(d, req, actor.id, "payout_account.added", a.id, { kind: a.kind, last4: a.value_last4 });
    return reply.status(201).send({ success: true, account: vs.payoutView(a) });
  });

  app.patch<P<{ id: string }>>("/api/v1/organizations/:org/payout-accounts/:id", pre, async (req) => {
    const actor = await payoutGuard(req, req.params.org);
    const b = parse(z.object({ holder_name: z.string().trim().min(2).max(140).optional(), is_primary: z.literal(true).optional(), mfa_code: z.string().optional() }).strict(), req.body);
    const a = await vs.updatePayout(actor.org.id, req.params.id, b);
    if (!a) throw notFound("Payout account not found.");
    await audit(d, req, actor.id, "payout_account.updated", a.id, { holder_name: b.holder_name !== undefined, is_primary: b.is_primary });
    return { success: true, account: vs.payoutView(a) };
  });

  app.delete<P<{ id: string }>>("/api/v1/organizations/:org/payout-accounts/:id", pre, async (req) => {
    const actor = await payoutGuard(req, req.params.org);
    if (!(await vs.removePayout(actor.org.id, req.params.id))) throw notFound("Payout account not found.");
    await audit(d, req, actor.id, "payout_account.removed", req.params.id);
    return { success: true };
  });

  app.post<P<{ id: string }>>("/api/v1/organizations/:org/payout-accounts/:id/verify", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:verification:submit");
    const { method } = parse(z.object({ method: z.string().optional() }).strict(), req.body ?? {});
    const a = await vs.getPayout(actor.org.id, req.params.id);
    if (!a) throw notFound("Payout account not found.");
    const v = await vs.verifyPayout(actor.org, a, actor.id, method);
    await audit(d, req, actor.id, "verification.bank_submitted", v.id, { method: v.method, status: v.status });
    return { success: true, verification: out(v) };
  });

  app.post<P<{ id: string }>>("/api/v1/organizations/:org/payout-accounts/:id/verify/complete", pre, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:verification:submit");
    if (!(await vs.getPayout(actor.org.id, req.params.id))) throw notFound("Payout account not found.");
    return { success: true, verification: out(await vs.complete(actor.org, "bank", req.params.id)) };
  });

  // ── Platform admin: queue, detail, decisions, accepted documents ──────────
  app.get<{ Querystring: { status?: string; check?: string } }>("/api/v1/admin/verifications", pre, async (req) => {
    adminOnly(req);
    return { success: true, verifications: await vs.adminList({ status: req.query.status ?? "pending", check: req.query.check }) };
  });

  app.get<{ Params: { id: string } }>("/api/v1/admin/verifications/:id", pre, async (req) => {
    adminOnly(req);
    const detail = await vs.adminDetail(req.params.id);
    if (!detail) throw notFound("Verification not found.");
    return { success: true, ...detail };
  });

  app.post<{ Params: { id: string } }>("/api/v1/admin/verifications/:id/decision", pre, async (req) => {
    const by = adminOnly(req);
    const b = parse(z.object({
      status: z.enum(["verified", "rejected", "needs_revision"]),
      reason: z.string().trim().min(3).max(500).optional(),
    }).strict(), req.body);
    if (b.status !== "verified" && !b.reason) throw badRequest("Give a reason the business can act on.");
    const v = await vs.decide(req.params.id, b.status, b.reason ?? null, by);
    if (!v) throw notFound("Verification not found.");
    await audit(d, req, by, "verification.decided", v.id, { status: b.status, reason: b.reason ?? null });
    return { success: true, verification: out(v) };
  });

  app.get("/api/v1/admin/verification-document-types", pre, async (req) => {
    adminOnly(req);
    return { success: true, documents: (await d.repo.authDb.query("SELECT * FROM zolexora_verification_document_types ORDER BY sort_order, key")).rows };
  });

  app.put<{ Params: { key: string } }>("/api/v1/admin/verification-document-types/:key", pre, async (req) => {
    const by = adminOnly(req);
    if (!/^[a-z0-9_]{2,40}$/.test(req.params.key)) throw badRequest("Key: lowercase letters, digits and _.");
    const url = z.string().url().max(500).startsWith("https://").nullable().default(null);
    const b = parse(z.object({
      label: z.string().trim().min(2).max(120),
      check_type: z.enum(["identity", "pan", "gst", "registration", "authority"]),
      business_kinds: z.array(z.enum(["individual", "proprietor", "company", "llp", "partnership", "huf", "trust", "society", "public_body"])).default([]),
      official_url: url,
      verify_url: url,
      instructions: z.string().trim().min(10).max(2000),
      active: z.boolean().default(true),
      sort_order: z.number().int().min(0).max(10_000).default(500),
    }).strict(), req.body);
    const row = (await d.repo.authDb.query(
      `INSERT INTO zolexora_verification_document_types (key, label, check_type, business_kinds, official_url, verify_url, instructions, active, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, check_type = EXCLUDED.check_type, business_kinds = EXCLUDED.business_kinds,
         official_url = EXCLUDED.official_url, verify_url = EXCLUDED.verify_url, instructions = EXCLUDED.instructions,
         active = EXCLUDED.active, sort_order = EXCLUDED.sort_order
       RETURNING *`,
      [req.params.key, b.label, b.check_type, JSON.stringify(b.business_kinds), b.official_url, b.verify_url, b.instructions, b.active, b.sort_order],
    )).rows[0];
    await audit(d, req, by, "verification_document_type.saved", req.params.key, { active: b.active });
    return { success: true, document: row };
  });
}
