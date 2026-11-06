import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { businessKindFromPan, normalizeId, PAN_RE } from "../../business/identifiers.js";
import { last4 } from "../../services/cipher.service.js";
import { OrgRow, ORG_EDITABLE } from "../../stores/team.store.js";
import { actorFor, audit, badRequest, BusinessDeps, conflict, denied, need, notFound, parse } from "./context.js";

const address = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, "6-digit PIN code"),
  country: z.string().trim().length(2).default("IN"),
});
const phone = z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/, "E.164, e.g. +919876543210");
const email = z.string().trim().toLowerCase().email().max(254);
const name = z.string().trim().min(2).max(200);
const activity = z.string().trim().regex(/^[a-z0-9_]{2,40}$/);

const profilePatch = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
  addresses: z.array(address.extend({ label: z.string().trim().max(40).optional() })).max(10).optional(),
}).strict();

const orgFields = {
  legal_name: name,
  trade_name: name.nullable().optional(),
  email: email.nullable().optional(),
  phone: phone.nullable().optional(),
  address: address.nullable().optional(),
  logo_url: z.string().url().max(500).nullable().optional(),
  activity_primary: activity.nullable().optional(),
  activity_others: z.array(activity).max(10).optional(),
};
const orgCreate = z.object({
  pan: z.string(),
  has_business_registration: z.boolean().optional(), // PAN letter P: a registered proprietor firm?
  has_llpin: z.boolean().optional(), // PAN letter F: an LLP?
  ...orgFields,
}).strict();
const orgPatch = z.object({ ...orgFields, legal_name: name.optional() }).strict();


/** The business as its members see it. The PAN is never returned in full. */
export const orgView = (o: OrgRow) => ({
  zolexora_org_id: o.zolexora_org_id,
  name: o.name,
  status: o.status,
  legal_name: o.legal_name,
  trade_name: o.trade_name,
  business_kind: o.business_kind,
  pan_holder_type: o.pan_holder_type,
  pan_last4: o.pan_last4,
  email: o.email,
  phone: o.phone,
  address: o.address,
  logo_url: o.logo_url,
  activity_primary: o.activity_primary,
  activity_others: o.activity_others,
  official_activities: o.official_activities,
  mfa_policy: o.mfa_policy,
  created_at: o.created_at,
});

export async function organizationRoutes(app: FastifyInstance, d: BusinessDeps & { onOrgEdited: (org: OrgRow, changed: string[]) => Promise<void> }) {
  const authenticate = createAuthMiddleware({ tokenService: d.tokens, repo: d.repo });
  /** Activities must be groups from the list (hidden ones can't be chosen any more). */
  const checkActivities = async (b: { activity_primary?: string | null; activity_others?: string[] }) => {
    const keys = [b.activity_primary, ...(b.activity_others ?? [])].filter((k): k is string => !!k);
    if (!keys.length) return;
    const known = new Set((await d.team.listActivityGroups()).map((g) => g.key));
    const bad = keys.filter((k) => !known.has(k));
    if (bad.length) throw badRequest(`Unknown activity: ${bad.join(", ")}. See GET /api/v1/activity-groups.`, "ORG_UNKNOWN_ACTIVITY");
  };
  const personOnly = (req: FastifyRequest) => {
    if (req.tokenPayload?.type !== "user") throw denied("Sign in with your Zolexora account.");
    return req.user!.uid;
  };

  // ── My profile (ADR 0004 §1) ──────────────────────────────────────────────
  app.get("/api/v1/me/profile", { preHandler: [authenticate] }, async (req) => {
    const uid = personOnly(req);
    const r = await d.repo.authDb.query(
      `SELECT zolexora_id, email, phone_number, display_name, avatar_url, addresses, email_verified_at, phone_verified_at, created_at
       FROM zolexora_auth_users WHERE id::text = $1`, [uid],
    );
    if (!r.rows[0]) throw notFound("Account not found.");
    return { success: true, profile: r.rows[0] };
  });

  app.patch("/api/v1/me/profile", { preHandler: [authenticate] }, async (req) => {
    const uid = personOnly(req);
    const p = parse(profilePatch, req.body);
    const r = await d.repo.authDb.query(
      `UPDATE zolexora_auth_users SET display_name = COALESCE($2, display_name),
              avatar_url = CASE WHEN $3 THEN $4 ELSE avatar_url END, addresses = COALESCE($5::jsonb, addresses)
       WHERE id::text = $1
       RETURNING zolexora_id, email, phone_number, display_name, avatar_url, addresses`,
      [uid, p.display_name ?? null, p.avatar_url !== undefined, p.avatar_url ?? null, p.addresses ? JSON.stringify(p.addresses) : null],
    );
    return { success: true, profile: r.rows[0] };
  });

  // ── Businesses (ADR 0004 §2) ──────────────────────────────────────────────
  app.post("/api/v1/organizations", { preHandler: [authenticate] }, async (req, reply) => {
    const uid = personOnly(req);
    const b = parse(orgCreate, req.body);
    const pan = normalizeId(b.pan);
    if (!PAN_RE.test(pan)) throw badRequest("Enter a valid PAN, e.g. ABCDE1234F.", "ORG_INVALID_PAN");
    const kind = businessKindFromPan(pan, b);
    if (!kind) throw badRequest("This PAN type can't own a business here.", "ORG_UNSUPPORTED_PAN_TYPE");
    if (pan[3] === "P" && b.has_business_registration === undefined) {
      throw badRequest("For a personal PAN, tell us whether the business is registered (has_business_registration).", "ORG_FOLLOW_UP_REQUIRED");
    }
    if (pan[3] === "F" && b.has_llpin === undefined) {
      throw badRequest("For a firm PAN, tell us whether it is an LLP (has_llpin).", "ORG_FOLLOW_UP_REQUIRED");
    }
    await checkActivities(b);
    const panHash = d.cipher.hash(`pan:${pan}`);
    // One business per PAN, except personal PANs (a person may run several sole businesses).
    if (pan[3] !== "P" && (await d.team.countOrgsWithPan(panHash)) > 0) {
      throw conflict("A business with this PAN already exists. Ask its owner to invite you.", "ORG_PAN_EXISTS");
    }
    let created;
    try {
      created = await d.team.createOrg({
        legal_name: b.legal_name,
        trade_name: b.trade_name ?? null,
        pan_holder_type: pan[3],
        business_kind: kind,
        pan_encrypted: d.cipher.encrypt(pan),
        pan_last4: last4(pan),
        pan_hash: panHash,
        email: b.email ?? null,
        phone: b.phone ?? null,
        address: b.address ?? null,
        logo_url: b.logo_url ?? null,
        activity_primary: b.activity_primary ?? null,
        activity_others: b.activity_others ?? [],
      }, uid);
    } catch (err: any) {
      if (err?.code === "23505") throw conflict("A business with this PAN already exists. Ask its owner to invite you.", "ORG_PAN_EXISTS");
      throw err;
    }
    await audit(d, req, created.member.id, "org.created", created.org.id, { business_kind: kind });
    return reply.status(201).send({ success: true, organization: orgView(created.org), member_id: created.member.id, role: "owner" });
  });

  app.get("/api/v1/me/organizations", { preHandler: [authenticate] }, async (req) => {
    const uid = personOnly(req);
    const rows = await d.team.listOrgsForUser(uid);
    return {
      success: true,
      organizations: rows.map((r) => ({ ...orgView(r), member_id: r.member_id, member_status: r.member_status, role: r.org_role, role_name: r.org_role_name })),
    };
  });

  app.get<{ Params: { org: string } }>("/api/v1/organizations/:org", { preHandler: [authenticate] }, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:profile:view");
    return { success: true, organization: orgView(actor.org), role: actor.access.orgRoleKey };
  });

  app.patch<{ Params: { org: string } }>("/api/v1/organizations/:org", { preHandler: [authenticate] }, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:profile:edit");
    const p = parse(orgPatch, req.body);
    await checkActivities(p);
    const patch: Record<string, unknown> = {};
    for (const k of ORG_EDITABLE) if (p[k] !== undefined) patch[k] = p[k];
    const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify((actor.org as any)[k] ?? null));
    const org = await d.team.updateOrg(actor.org.id, patch);
    if (changed.length) {
      await audit(d, req, actor.id, "org.updated", org.id, { changed });
      await d.onOrgEdited(org, changed); // re-verify what changed (ADR 0004 §4)
    }
    return { success: true, organization: orgView(org), changed };
  });

  app.put<{ Params: { org: string } }>("/api/v1/organizations/:org/security", { preHandler: [authenticate] }, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    need(actor, "org:security:manage");
    const { mfa_policy } = parse(z.object({ mfa_policy: z.enum(["off", "optional", "required"]) }).strict(), req.body);
    const org = await d.team.updateOrg(actor.org.id, { mfa_policy });
    await audit(d, req, actor.id, "org.security_changed", org.id, { from: actor.org.mfa_policy, to: mfa_policy });
    return { success: true, organization: orgView(org) };
  });

  /** Close: the business is deactivated, everyone is signed out. Its PAN can then start a new business. */
  app.post<{ Params: { org: string } }>("/api/v1/organizations/:org/close", { preHandler: [authenticate] }, async (req) => {
    const actor = await actorFor(req, d, req.params.org);
    if (!actor.isPlatformAdmin) need(actor, "org:business:close");
    const { confirm } = parse(z.object({ confirm: z.string() }).strict(), req.body);
    if (confirm.trim().toUpperCase() !== actor.org.zolexora_org_id) {
      throw badRequest("Type the business id to confirm closing it.", "ORG_CLOSE_CONFIRM");
    }
    await d.team.updateOrg(actor.org.id, { status: "deactivated" });
    await d.repo.authDb.query(
      `UPDATE zolexora_sessions s SET revoked_at = now(), revoked_reason = 'business_closed'
       FROM zolexora_org_members m WHERE m.id = s.member_id AND m.organization_id = $1 AND s.revoked_at IS NULL`,
      [actor.org.id],
    );
    await audit(d, req, actor.id, "org.closed", actor.org.id);
    return { success: true };
  });

  // ── What the business does (ADR 0004 §2a) ─────────────────────────────────
  app.get("/api/v1/activity-groups", async () => ({ success: true, groups: await d.team.listActivityGroups() }));

  const adminOnly = (req: FastifyRequest) => {
    if (!req.user?.is_platform_admin) throw denied("Platform admins only.");
  };
  app.get("/api/v1/admin/activity-groups", { preHandler: [authenticate] }, async (req) => {
    adminOnly(req);
    return { success: true, groups: await d.team.listActivityGroups(true) };
  });
  app.put<{ Params: { key: string } }>("/api/v1/admin/activity-groups/:key", { preHandler: [authenticate] }, async (req) => {
    adminOnly(req);
    const g = parse(z.object({
      label: z.string().trim().min(2).max(100),
      hidden: z.boolean().default(false),
      sort_order: z.number().int().min(0).max(10_000).default(100),
    }).strict(), req.body);
    if (!/^[a-z0-9_]{2,40}$/.test(req.params.key)) throw badRequest("Key: lowercase letters, digits and _.");
    const saved = await d.team.saveActivityGroup({ key: req.params.key, ...g });
    await audit(d, req, `admin:${req.user!.uid}`, "activity_group.saved", req.params.key, g);
    return { success: true, group: saved };
  });
}
