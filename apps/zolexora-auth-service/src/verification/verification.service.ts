// Verification (ADR 0004 §4): one row per check per subject, provider attempts logged, names checked, admins decide the rest.
import { createHmac } from "node:crypto";
import { Db } from "../db.js";
import { AppError } from "../plugins/error-handler.js";
import { BusinessKind, IFSC_RE, ACCOUNT_RE, VPA_RE, GSTIN_RE, isValidGstin, namesMatch, normalizeId, panOfGstin } from "../business/identifiers.js";
import { CipherService, last4 } from "../services/cipher.service.js";
import { MailService } from "../services/mail.service.js";
import { OrgRow, TeamStore } from "../stores/team.store.js";
import {
  CashfreeClient, ClearTaxClient, DigioClient, ProviderRejected, ProviderUnavailable, readAadhaarOfflineZip,
} from "./providers.js";
import {
  CheckType, ORG_CHECKS, OFFICIAL_EMAIL_RE, Status, authorityRule, isPersonalKind, registrationRule, requiredChecks,
} from "./rules.js";

export interface VerificationConfig {
  providers: Record<Exclude<CheckType, "bank">, string[]>;
  bankProvider: "false" | "cashfree" | "digio";
  bankMethods: string[];
  uidaiCert?: string;
  cashfree?: CashfreeClient;
  cleartax?: ClearTaxClient;
  digio?: DigioClient;
  digioTemplates: { identity?: string; pan?: string; reverse_penny_drop?: string; penny_drop?: string };
}

export interface VRow {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  payout_account_id: string | null;
  check_type: CheckType;
  status: "pending" | "verified" | "rejected" | "needs_revision";
  provider: string;
  method: string | null;
  provider_ref: string | null;
  value_encrypted: string | null;
  value_last4: string | null;
  registered_name: string | null;
  document_ids: string[];
  details: Record<string, unknown>;
  reason: string | null;
  submitted_by: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PayoutRow {
  id: string;
  organization_id: string;
  kind: "bank" | "upi";
  holder_name: string;
  value_encrypted: string;
  value_last4: string;
  ifsc: string | null;
  is_primary: boolean;
  created_at: Date;
}

type Subject = { user_id: string } | { organization_id: string; payout_account_id?: string | null };

const DAILY_PAID_LIMIT = 5;
const AADHAAR_MAX_AGE_DAYS = 3; // UIDAI: use an Offline e-KYC file generated within the last few days
const V_COLS = `id, user_id, organization_id, payout_account_id, check_type, status, provider, method, provider_ref, value_encrypted,
  value_last4, registered_name, document_ids, details, reason, submitted_by, decided_by, decided_at, created_at, updated_at`;
const P_COLS = "id, organization_id, kind, holder_name, value_encrypted, value_last4, ifsc, is_primary, created_at";
const PAID = new Set(["cashfree", "cleartax", "digio"]);

const err = (statusCode: number, code: string, message: string, details?: unknown) =>
  new AppError({ statusCode, code, message, ...(details ? { details: details as any } : {}) });
const bad = (message: string, code = "VERIFICATION_INVALID") => err(400, code, message);

/** What a caller sees: never the full number, never provider internals. */
export const vView = (v: VRow | null, check: CheckType, required: boolean, enabled: boolean) => ({
  check,
  status: (!enabled ? "not_required" : v ? v.status : "not_submitted") as Status,
  required: required && enabled,
  provider: v?.provider ?? null,
  method: v?.method ?? null,
  value_last4: v?.value_last4 ?? null,
  registered_name: v?.registered_name ?? null,
  reason: v?.reason ?? null,
  decided_at: v?.decided_at ?? null,
  updated_at: v?.updated_at ?? null,
});

export class VerificationService {
  constructor(
    private readonly db: Db,
    private readonly team: TeamStore,
    private readonly cipher: CipherService,
    private readonly mail: MailService,
    readonly cfg: VerificationConfig,
  ) {}

  enabled(check: CheckType): boolean {
    return check === "bank" ? this.cfg.bankProvider !== "false" : this.cfg.providers[check].length > 0;
  }

  // ── Rows ──────────────────────────────────────────────────────────────────
  private where(s: Subject, check: CheckType): [string, unknown[]] {
    if ("user_id" in s) return ["user_id = $1 AND organization_id IS NULL AND payout_account_id IS NULL AND check_type = $2", [s.user_id, check]];
    return [
      "user_id IS NULL AND organization_id = $1 AND payout_account_id IS NOT DISTINCT FROM $2 AND check_type = $3",
      [s.organization_id, s.payout_account_id ?? null, check],
    ];
  }

  async get(s: Subject, check: CheckType): Promise<VRow | null> {
    const [w, p] = this.where(s, check);
    return (await this.db.query<VRow>(`SELECT ${V_COLS} FROM zolexora_verifications WHERE ${w}`, p)).rows[0] ?? null;
  }

  async getById(id: string): Promise<VRow | null> {
    return (await this.db.query<VRow>(`SELECT ${V_COLS} FROM zolexora_verifications WHERE id::text = $1`, [id])).rows[0] ?? null;
  }

  /** Starts (or restarts) a check: a fresh pending row, ready for attempts. */
  private async open(s: Subject, check: CheckType, f: Partial<VRow> & { provider: string; submitted_by: string | null }): Promise<VRow> {
    const subj = "user_id" in s ? [s.user_id, null, null] : [null, s.organization_id, s.payout_account_id ?? null];
    return (await this.db.query<VRow>(
      `INSERT INTO zolexora_verifications
         (user_id, organization_id, payout_account_id, check_type, status, provider, method, value_encrypted, value_last4, document_ids, details, submitted_by)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
       ON CONFLICT (user_id, organization_id, payout_account_id, check_type) DO UPDATE SET
         status = 'pending', provider = EXCLUDED.provider, method = EXCLUDED.method, provider_ref = NULL,
         value_encrypted = COALESCE(EXCLUDED.value_encrypted, zolexora_verifications.value_encrypted),
         value_last4 = COALESCE(EXCLUDED.value_last4, zolexora_verifications.value_last4),
         registered_name = NULL, document_ids = EXCLUDED.document_ids, details = EXCLUDED.details, reason = NULL,
         submitted_by = EXCLUDED.submitted_by, decided_by = NULL, decided_at = NULL
       RETURNING ${V_COLS}`,
      [...subj, check, f.provider, f.method ?? null, f.value_encrypted ?? null, f.value_last4 ?? null,
        JSON.stringify(f.document_ids ?? []), JSON.stringify(f.details ?? {}), f.submitted_by],
    )).rows[0];
  }

  private async update(id: string, f: Partial<Pick<VRow, "status" | "provider" | "method" | "provider_ref" | "registered_name" | "reason" | "details" | "decided_by">>) {
    const decided = f.status && f.status !== "pending";
    return (await this.db.query<VRow>(
      `UPDATE zolexora_verifications SET
         status = COALESCE($2, status), provider = COALESCE($3, provider), method = COALESCE($4, method),
         provider_ref = COALESCE($5, provider_ref), registered_name = COALESCE($6, registered_name), reason = $7,
         details = details || COALESCE($8::jsonb, '{}'::jsonb),
         decided_by = CASE WHEN $9 THEN $10 ELSE NULL END, decided_at = CASE WHEN $9 THEN now() ELSE NULL END
       WHERE id = $1 RETURNING ${V_COLS}`,
      [id, f.status ?? null, f.provider ?? null, f.method ?? null, f.provider_ref ?? null, f.registered_name ?? null,
        f.reason ?? null, f.details ? JSON.stringify(f.details) : null, !!decided, f.decided_by ?? "system"],
    )).rows[0];
  }

  private async attempt(vid: string, a: { provider: string; method?: string | null; outcome: string; name?: string | null; note?: string | null; actor?: string | null }) {
    await this.db.query(
      `INSERT INTO zolexora_verification_attempts (verification_id, provider, method, paid, outcome, registered_name, note, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [vid, a.provider, a.method ?? null, PAID.has(a.provider), a.outcome, a.name ?? null, a.note?.slice(0, 300) ?? null, a.actor ?? null],
    );
  }

  /** 5 paid provider calls per check per subject per UTC day. */
  private async assertBudget(vid: string, provider: string) {
    if (!PAID.has(provider)) return;
    const n = (await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM zolexora_verification_attempts
       WHERE verification_id = $1 AND paid AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
      [vid],
    )).rows[0].n;
    if (n >= DAILY_PAID_LIMIT) throw err(429, "VERIFICATION_DAILY_LIMIT", "Too many attempts for this check today. Try again tomorrow.");
  }

  /** A name from a source decides verified vs admin review. */
  private async conclude(v: VRow, provider: string, method: string | null, found: string | null, expected: (string | null)[], extra: Record<string, unknown> = {}, ref?: string | null) {
    const ok = namesMatch(found, expected);
    await this.attempt(v.id, { provider, method, outcome: ok ? "verified" : "name_mismatch", name: found });
    return this.update(v.id, {
      status: ok ? "verified" : "pending",
      provider, method, provider_ref: ref ?? null, registered_name: found,
      reason: ok ? null : "The name from the source doesn't match. An admin will review it.",
      details: { ...extra, name_check: ok ? "match" : "mismatch" },
      decided_by: ok ? `provider:${provider}` : undefined,
    });
  }

  private async rejectWith(v: VRow, provider: string, method: string | null, reason: string) {
    await this.attempt(v.id, { provider, method, outcome: "rejected", note: reason });
    return this.update(v.id, { status: "rejected", provider, method, reason, decided_by: `provider:${provider}` });
  }

  /** Tries providers in order; unavailable ones fall through to the next. */
  private async run(v: VRow, providers: string[], step: (provider: string) => Promise<VRow | "skip">): Promise<VRow> {
    const tried: string[] = [];
    for (const p of providers) {
      await this.assertBudget(v.id, p);
      try {
        const r = await step(p);
        if (r === "skip") continue;
        return r;
      } catch (e) {
        if (e instanceof ProviderUnavailable) {
          tried.push(p);
          await this.attempt(v.id, { provider: p, outcome: "unavailable", note: e.message });
          continue;
        }
        if (e instanceof ProviderRejected) return this.rejectWith(v, p, null, e.message);
        throw e;
      }
    }
    throw err(503, "VERIFICATION_UNAVAILABLE", tried.length
      ? "The verification service is not available right now. Try again later."
      : "This can't be verified automatically. Upload the documents listed for this check.");
  }

  // ── Names and documents ───────────────────────────────────────────────────
  private async ownerIdentityNames(orgId: string): Promise<string[]> {
    return (await this.db.query<{ registered_name: string }>(
      `SELECT v.registered_name FROM zolexora_verifications v
       JOIN zolexora_org_members m ON m.user_id = v.user_id AND m.organization_id = $1
       JOIN zolexora_member_roles mr ON mr.member_id = m.id AND mr.scope = 'org'
       JOIN zolexora_roles r ON r.id = mr.role_id AND r.key = 'owner' AND r.built_in
       WHERE v.check_type = 'identity' AND v.status = 'verified' AND v.registered_name IS NOT NULL`,
      [orgId],
    )).rows.map((r) => r.registered_name);
  }

  private async expectedNames(org: OrgRow, check: CheckType): Promise<(string | null)[]> {
    if (!isPersonalKind(org.business_kind)) return [org.legal_name, org.trade_name];
    const people = await this.ownerIdentityNames(org.id);
    return check === "pan" ? people : [...people, org.legal_name, org.trade_name];
  }

  /** Documents must be uploaded for this business, be of an accepted type for this check and kind. */
  private async checkDocuments(org: OrgRow, check: CheckType, ids: string[], allowed?: string[]): Promise<string[]> {
    if (ids.length > 10) throw bad("Up to 10 documents per check.");
    const types: string[] = [];
    for (const id of new Set(ids)) {
      const d = (await this.db.query<{ document_type: string; org_id: string | null; check_type: string | null; business_kinds: string[] | null; active: boolean | null }>(
        `SELECT k.document_type, k.org_id, t.check_type, t.business_kinds, t.active
         FROM zolexora_kyc_documents k LEFT JOIN zolexora_verification_document_types t ON t.key = k.document_type
         WHERE k.document_id = $1`, [id],
      )).rows[0];
      if (!d || d.org_id !== org.zolexora_org_id) throw bad(`Document ${id} was not uploaded for this business.`, "VERIFICATION_BAD_DOCUMENT");
      const kindOk = !d.business_kinds?.length || d.business_kinds.includes(org.business_kind ?? "");
      if (d.check_type !== check || !d.active || !kindOk || (allowed && !allowed.includes(d.document_type))) {
        throw bad(`Document ${id} (${d.document_type}) is not accepted for ${check}. See GET /api/v1/verification/config.`, "VERIFICATION_BAD_DOCUMENT");
      }
      types.push(d.document_type);
    }
    return types;
  }

  private pan(org: OrgRow): string {
    return this.cipher.decrypt(org.pan_encrypted!);
  }

  // ── Reads ─────────────────────────────────────────────────────────────────
  async orgSummary(org: OrgRow) {
    const kind = (org.business_kind ?? "individual") as BusinessKind;
    const required = new Set(requiredChecks(kind));
    const rows = (await this.db.query<VRow>(`SELECT ${V_COLS} FROM zolexora_verifications WHERE organization_id = $1`, [org.id])).rows;
    const one = (c: CheckType) => rows.find((r) => r.check_type === c && !r.payout_account_id) ?? null;
    const accounts = await this.listPayouts(org.id);
    return {
      business_kind: kind,
      checks: ORG_CHECKS.filter((c) => c !== "bank").map((c) => vView(one(c), c, required.has(c), this.enabled(c))),
      bank: accounts.map((a) => ({
        payout_account: this.payoutView(a),
        ...vView(rows.find((r) => r.payout_account_id === a.id) ?? null, "bank", true, this.enabled("bank")),
      })),
      owners_identity: (await this.db.query<{ zolexora_id: string; status: string | null }>(
        `SELECT u.zolexora_id, v.status FROM zolexora_org_members m
         JOIN zolexora_auth_users u ON u.id = m.user_id
         JOIN zolexora_member_roles mr ON mr.member_id = m.id AND mr.scope = 'org'
         JOIN zolexora_roles r ON r.id = mr.role_id AND r.key = 'owner' AND r.built_in
         LEFT JOIN zolexora_verifications v ON v.user_id = u.id AND v.check_type = 'identity'
         WHERE m.organization_id = $1`, [org.id],
      )).rows.map((r) => ({ zolexora_id: r.zolexora_id, status: (this.enabled("identity") ? r.status ?? "not_submitted" : "not_required") as Status })),
    };
  }

  /** Short form for /auth/me: check → status. */
  async orgStatusMap(org: OrgRow): Promise<Record<string, Status>> {
    const s = await this.orgSummary(org);
    const out: Record<string, Status> = Object.fromEntries(s.checks.map((c) => [c.check, c.status]));
    out.bank = !this.enabled("bank") ? "not_required"
      : s.bank.some((b) => b.status === "verified") ? "verified" : s.bank.length ? s.bank[0].status : "not_submitted";
    out.identity = !this.enabled("identity") ? "not_required"
      : s.owners_identity.some((o) => o.status === "verified") ? "verified" : (s.owners_identity[0]?.status ?? "not_submitted");
    return out;
  }

  // ── Identity (a person) ───────────────────────────────────────────────────
  async identity(user: { id: string; zolexora_id: string; email: string | null; phone_number: string | null; display_name: string | null },
    b: { method: string; zip_base64?: string; share_code?: string; document_ids?: string[] }) {
    const list = this.cfg.providers.identity;
    if (!list.length) throw bad("Identity verification is not required.", "VERIFICATION_NOT_REQUIRED");
    if (!list.includes(b.method)) throw bad(`Use one of: ${list.join(", ")}.`, "VERIFICATION_METHOD_UNAVAILABLE");
    const current = await this.get({ user_id: user.id }, "identity");
    if (current?.status === "verified") throw err(409, "VERIFICATION_ALREADY_DONE", "Your identity is already verified.");
    const v = await this.open({ user_id: user.id }, "identity", { provider: b.method, method: b.method, submitted_by: user.id, document_ids: b.document_ids ?? [] });

    if (b.method === "aadhaar_offline") {
      if (!b.zip_base64 || !b.share_code || !/^[0-9]{4}$/.test(b.share_code)) throw bad("Upload the Offline e-KYC ZIP and its 4-digit share code.");
      try {
        const f = await readAadhaarOfflineZip(Buffer.from(b.zip_base64, "base64"), b.share_code, this.cfg.uidaiCert!);
        if (!f.generatedAt || Date.now() - f.generatedAt.getTime() > AADHAAR_MAX_AGE_DAYS * 86400_000) {
          throw new ProviderRejected(`Download a fresh Offline e-KYC file (less than ${AADHAAR_MAX_AGE_DAYS} days old) and try again.`);
        }
        await this.attempt(v.id, { provider: "aadhaar_offline", method: "aadhaar_offline", outcome: "verified", name: f.name, actor: user.id });
        // Only these facts are kept. The Aadhaar number, photo, address and XML are discarded.
        return this.update(v.id, {
          status: "verified", registered_name: f.name, provider: "aadhaar_offline",
          details: { birth_year: f.birthYear, aadhaar_last4: f.last4, source: "uidai_offline_ekyc" }, decided_by: "provider:aadhaar_offline",
        });
      } catch (e) {
        if (e instanceof ProviderRejected) return this.rejectWith(v, "aadhaar_offline", "aadhaar_offline", e.message);
        throw e;
      }
    }
    if (b.method === "digio") {
      await this.assertBudget(v.id, "digio");
      const id = user.email ?? user.phone_number;
      if (!id) throw bad("Add an email or phone number to your account first.");
      const r = await this.cfg.digio!.start(this.cfg.digioTemplates.identity!, id, user.display_name ?? user.zolexora_id);
      await this.attempt(v.id, { provider: "digio", method: "digilocker", outcome: "started", actor: user.id });
      const row = await this.update(v.id, { provider_ref: r.ref, details: { stage: "awaiting_user" } });
      return Object.assign(row, { action: { provider: "digio", request_id: r.ref, access_token: r.accessToken, customer_identifier: r.customerIdentifier } });
    }
    // manual: the person's own e-PAN, checked by an admin
    if (!b.document_ids?.length) throw bad("Upload your e-PAN PDF first.");
    await this.attempt(v.id, { provider: "manual", outcome: "submitted", actor: user.id });
    return this.update(v.id, { provider: "manual", reason: null });
  }

  /** After the person finishes Digio's flow. DigiLocker's name is authoritative for identity. */
  async completeIdentity(userId: string) {
    const v = await this.get({ user_id: userId }, "identity");
    if (!v || v.provider !== "digio" || v.status !== "pending" || !v.provider_ref) throw bad("Nothing to complete.");
    const r = await this.cfg.digio!.result(v.provider_ref);
    if (r.failed) return this.rejectWith(v, "digio", "digilocker", "DigiLocker verification was not completed.");
    if (!r.done) throw err(409, "VERIFICATION_NOT_FINISHED", "Finish the DigiLocker steps first.");
    if (!r.name) {
      await this.attempt(v.id, { provider: "digio", method: "digilocker", outcome: "needs_review" });
      return this.update(v.id, { reason: "An admin will review the DigiLocker result." });
    }
    await this.attempt(v.id, { provider: "digio", method: "digilocker", outcome: "verified", name: r.name });
    return this.update(v.id, { status: "verified", registered_name: r.name, decided_by: "provider:digio" });
  }

  // ── Business checks ───────────────────────────────────────────────────────
  async submit(org: OrgRow, by: string, check: "pan" | "gst" | "registration" | "authority", b: Record<string, any>) {
    const list = this.cfg.providers[check];
    if (!list.length) throw bad(`${check} verification is not required.`, "VERIFICATION_NOT_REQUIRED");
    const kind = org.business_kind as BusinessKind;
    if (check !== "gst" && !requiredChecks(kind).includes(check)) throw bad(`A ${kind} business doesn't need ${check} verification.`, "VERIFICATION_NOT_REQUIRED");
    const s = { organization_id: org.id };
    const providers = b.method ? (list.includes(b.method) ? [b.method] : (() => { throw bad(`Use one of: ${list.join(", ")}.`, "VERIFICATION_METHOD_UNAVAILABLE"); })()) : list;
    const docs: string[] = Array.isArray(b.document_ids) ? b.document_ids.map(String) : [];

    if (check === "pan") {
      if (docs.length) await this.checkDocuments(org, "pan", docs);
      const v = await this.open(s, "pan", { provider: providers[0], value_last4: org.pan_last4, document_ids: docs, submitted_by: by });
      return this.run(v, providers, (p) => this.panStep(org, v, p, docs));
    }

    if (check === "gst") {
      const gstin = normalizeId(b.gstin);
      if (!GSTIN_RE.test(gstin) || !isValidGstin(gstin)) throw bad("Enter a valid GSTIN (the check digit doesn't match).", "VERIFICATION_BAD_GSTIN");
      if (panOfGstin(gstin) !== this.pan(org)) throw bad("This GSTIN belongs to a different PAN.", "VERIFICATION_GSTIN_PAN_MISMATCH");
      if (docs.length) await this.checkDocuments(org, "gst", docs);
      const v = await this.open(s, "gst", {
        provider: providers[0], value_encrypted: this.cipher.encrypt(gstin), value_last4: last4(gstin), document_ids: docs, submitted_by: by,
      });
      const done = await this.run(v, providers, (p) => this.gstStep(org, v, p, gstin, docs));
      if (done.status === "verified") await this.afterGstVerified(org, by);
      return done;
    }

    if (check === "registration") {
      const rule = registrationRule(kind)!;
      let number: string | null = null;
      if (rule.number) {
        number = normalizeId(b[rule.number.field]);
        if (!number && rule.number.required) throw bad(`Enter the ${rule.number.label}.`);
        if (number && !rule.number.re.test(number)) throw bad(`That ${rule.number.label} doesn't look right.`);
      }
      const types = await this.checkDocuments(org, "registration", docs, rule.docs);
      if (new Set(types).size < rule.min) {
        throw bad(rule.min > 1 ? `Upload ${rule.min} different documents from: ${rule.docs.join(", ")}.` : `Upload: ${rule.docs.join(" or ")}.`, "VERIFICATION_DOCUMENTS_REQUIRED");
      }
      const v = await this.open(s, "registration", {
        provider: "manual", value_encrypted: number ? this.cipher.encrypt(number) : null, value_last4: number ? last4(number) : null,
        document_ids: docs, details: { document_types: types, number_type: rule.number?.field ?? null, number }, submitted_by: by,
      });
      await this.attempt(v.id, { provider: "manual", outcome: "submitted", actor: by });
      return v;
    }

    // authority
    const rule = authorityRule(kind);
    const basis = b.basis === "named_in_records" && rule.namedRole ? "named_in_records" : "authorisation_letter";
    let types: string[] = [];
    if (basis === "authorisation_letter") {
      types = await this.checkDocuments(org, "authority", docs, rule.letterDocs);
      if (!types.length) throw bad(`Upload: ${rule.letterDocs.join(" or ")}.`, "VERIFICATION_DOCUMENTS_REQUIRED");
    }
    let officialEmail: string | null = null;
    if (rule.officialEmail) {
      officialEmail = String(b.official_email ?? "").toLowerCase().trim();
      if (!OFFICIAL_EMAIL_RE.test(officialEmail) || !this.emailCodeOk(org.id, officialEmail, b.email_code)) {
        throw bad("Confirm an official @gov.in or @nic.in email with the code we send to it.", "VERIFICATION_OFFICIAL_EMAIL");
      }
    }
    const designation = typeof b.designation === "string" ? b.designation.trim().slice(0, 80) : null;
    const v = await this.open(s, "authority", {
      provider: "manual", document_ids: docs, submitted_by: by,
      details: { basis, named_role: rule.namedRole, designation, din: typeof b.din === "string" ? b.din.slice(0, 20) : null, document_types: types, official_email: officialEmail },
    });
    await this.attempt(v.id, { provider: "manual", outcome: "submitted", actor: by });
    return v;
  }

  private async panStep(org: OrgRow, v: VRow, p: string, docs: string[]): Promise<VRow | "skip"> {
    const pan = this.pan(org);
    if (p === "gstin") {
      // Free: a verified GSTIN that contains this PAN proves the PAN and gives the legal name.
      const g = await this.get({ organization_id: org.id }, "gst");
      if (g?.status !== "verified" || !g.value_encrypted || panOfGstin(this.cipher.decrypt(g.value_encrypted)) !== pan) return "skip";
      return this.conclude(v, "gstin", "gstin", g.registered_name, await this.expectedNames(org, "pan"), { via: "gst" });
    }
    if (p === "cashfree") {
      const r = await this.cfg.cashfree!.pan(pan, org.legal_name ?? undefined);
      if (!r.valid) return this.rejectWith(v, "cashfree", null, "The Income Tax Department has no such PAN.");
      return this.conclude(v, "cashfree", null, r.name, await this.expectedNames(org, "pan"), {}, r.ref);
    }
    if (p === "digio") return this.startDigio(v, this.cfg.digioTemplates.pan!, org, "pan");
    if (!docs.length) return "skip";
    await this.attempt(v.id, { provider: "manual", outcome: "submitted" });
    return this.update(v.id, { provider: "manual" });
  }

  private async gstStep(org: OrgRow, v: VRow, p: string, gstin: string, docs: string[]): Promise<VRow | "skip"> {
    if (p === "manual") {
      if (!docs.length) return "skip";
      await this.attempt(v.id, { provider: "manual", outcome: "submitted" });
      return this.update(v.id, { provider: "manual" });
    }
    const client = p === "cashfree" ? this.cfg.cashfree! : this.cfg.cleartax!;
    const r = await client.gstin(gstin, org.legal_name ?? undefined);
    if (!r.valid) return this.rejectWith(v, p, null, "GSTN has no such GSTIN.");
    if (!r.active) return this.rejectWith(v, p, null, "This GSTIN is not active.");
    const found = namesMatch(r.legalName, await this.expectedNames(org, "gst")) ? r.legalName : (r.tradeName && namesMatch(r.tradeName, await this.expectedNames(org, "gst")) ? r.tradeName : r.legalName);
    return this.conclude(v, p, null, found, await this.expectedNames(org, "gst"), { activities: r.activities, trade_name: r.tradeName }, r.ref);
  }

  /** A verified GSTIN fills the official activities and, when allowed, verifies the PAN for free. */
  private async afterGstVerified(org: OrgRow, by: string) {
    const g = (await this.get({ organization_id: org.id }, "gst"))!;
    const acts = Array.isArray(g.details.activities) ? (g.details.activities as string[]).slice(0, 20) : [];
    if (acts.length) await this.team.updateOrg(org.id, { official_activities: acts });
    const pan = await this.get({ organization_id: org.id }, "pan");
    if (this.cfg.providers.pan.includes("gstin") && pan?.status !== "verified") {
      const v = await this.open({ organization_id: org.id }, "pan", { provider: "gstin", value_last4: org.pan_last4, submitted_by: by });
      const r = await this.panStep(org, v, "gstin", []);
      if (r === "skip") await this.update(v.id, { reason: "Waiting for the GST check." });
    }
  }

  private async startDigio(v: VRow, template: string, org: OrgRow, method: string): Promise<VRow> {
    const id = org.email ?? org.phone;
    if (!id) throw bad("Add the business email or phone to the profile first.");
    const r = await this.cfg.digio!.start(template, id, org.legal_name ?? org.name);
    await this.attempt(v.id, { provider: "digio", method, outcome: "started" });
    const row = await this.update(v.id, { provider: "digio", method, provider_ref: r.ref, details: { stage: "awaiting_user" } });
    return Object.assign(row, { action: { provider: "digio", request_id: r.ref, access_token: r.accessToken, customer_identifier: r.customerIdentifier } });
  }

  /** Finishes an async check (Digio flow, reverse penny drop). */
  async complete(org: OrgRow, check: CheckType, payoutId?: string) {
    const v = await this.get({ organization_id: org.id, payout_account_id: payoutId ?? null }, check);
    if (!v || v.status !== "pending" || !v.provider_ref) throw bad("Nothing to complete.");
    const expected = await this.expectedNames(org, check);
    if (v.provider === "digio") {
      await this.assertBudget(v.id, "digio");
      const r = await this.cfg.digio!.result(v.provider_ref);
      if (r.failed) return this.rejectWith(v, "digio", v.method, "The verification was not completed.");
      if (!r.done) throw err(409, "VERIFICATION_NOT_FINISHED", "Finish the steps first.");
      if (check === "bank" && payoutId && r.account && !(await this.sameAccount(payoutId, r.account, r.ifsc))) {
        return this.rejectWith(v, "digio", v.method, "The payment came from a different account.");
      }
      return this.conclude(v, "digio", v.method, r.name, expected, {}, v.provider_ref);
    }
    if (v.provider === "cashfree" && v.method === "reverse_penny_drop") {
      await this.assertBudget(v.id, "cashfree");
      const r = await this.cfg.cashfree!.reversePennyDropStatus(v.id, v.provider_ref);
      if (r.status === "FAILURE" || r.status === "EXPIRED") return this.rejectWith(v, "cashfree", v.method, r.status === "EXPIRED" ? "The payment link expired. Start again." : "The payment failed. Start again.");
      if (r.status !== "SUCCESS") throw err(409, "VERIFICATION_NOT_FINISHED", "Pay ₹1 with the UPI link first (it is refunded).");
      if (payoutId && !(await this.sameAccount(payoutId, r.account ?? r.upi, r.ifsc))) {
        return this.rejectWith(v, "cashfree", v.method, "The ₹1 came from a different account than the one added.");
      }
      return this.conclude(v, "cashfree", v.method, r.name, expected, {}, v.provider_ref);
    }
    throw bad("Nothing to complete.");
  }

  // ── Official email code (public bodies) ───────────────────────────────────
  private emailCode(orgId: string, email: string, window: number) {
    const h = createHmac("sha256", this.cipher.hash("authority-email-key")).update(`${orgId}:${email}:${window}`).digest();
    return String(h.readUInt32BE(0) % 1_000_000).padStart(6, "0");
  }
  private emailCodeOk(orgId: string, email: string, code: unknown) {
    const w = Math.floor(Date.now() / 600_000);
    return typeof code === "string" && [w, w - 1].some((x) => this.emailCode(orgId, email, x) === code);
  }
  async sendOfficialEmailCode(org: OrgRow, email: string) {
    const e = email.toLowerCase().trim();
    if (org.business_kind !== "public_body") throw bad("Only public bodies confirm an official email.");
    if (!OFFICIAL_EMAIL_RE.test(e)) throw bad("Use an official @gov.in or @nic.in address.", "VERIFICATION_OFFICIAL_EMAIL");
    const code = this.emailCode(org.id, e, Math.floor(Date.now() / 600_000));
    await this.mail.send(e, `${code} is your Zolexora verification code`, `Use ${code} to confirm this address for ${org.name}. It expires in 10 minutes.`);
  }

  // ── Payout accounts and bank checks ───────────────────────────────────────
  payoutView = (a: PayoutRow) => ({ id: a.id, kind: a.kind, holder_name: a.holder_name, last4: a.value_last4, ifsc: a.ifsc, is_primary: a.is_primary, created_at: a.created_at });

  async listPayouts(orgId: string): Promise<PayoutRow[]> {
    return (await this.db.query<PayoutRow>(`SELECT ${P_COLS} FROM zolexora_payout_accounts WHERE organization_id = $1 ORDER BY created_at`, [orgId])).rows;
  }

  async getPayout(orgId: string, id: string): Promise<PayoutRow | null> {
    return (await this.db.query<PayoutRow>(`SELECT ${P_COLS} FROM zolexora_payout_accounts WHERE organization_id = $1 AND id::text = $2`, [orgId, id])).rows[0] ?? null;
  }

  async addPayout(orgId: string, by: string | null, b: { kind: "bank" | "upi"; holder_name: string; account_number?: string; ifsc?: string; vpa?: string; is_primary?: boolean }) {
    let value: Record<string, string>, l4: string, ifsc: string | null = null;
    if (b.kind === "bank") {
      const acc = String(b.account_number ?? "").replace(/\s+/g, "");
      ifsc = normalizeId(b.ifsc);
      if (!ACCOUNT_RE.test(acc)) throw bad("Account number: 9 to 18 digits.");
      if (!IFSC_RE.test(ifsc)) throw bad("Enter a valid IFSC, e.g. HDFC0001234.");
      value = { account_number: acc, ifsc };
      l4 = last4(acc);
    } else {
      const vpa = String(b.vpa ?? "").trim().toLowerCase();
      if (!VPA_RE.test(vpa)) throw bad("Enter a valid UPI ID, e.g. name@bank.");
      value = { vpa };
      l4 = vpa.split("@")[0].slice(-4);
    }
    return this.db.tx(async (tx) => {
      const first = (await tx.query("SELECT 1 FROM zolexora_payout_accounts WHERE organization_id = $1", [orgId])).rows.length === 0;
      const primary = b.is_primary || first;
      if (primary) await tx.query("UPDATE zolexora_payout_accounts SET is_primary = false WHERE organization_id = $1", [orgId]);
      return (await tx.query<PayoutRow>(
        `INSERT INTO zolexora_payout_accounts (organization_id, kind, holder_name, value_encrypted, value_last4, ifsc, is_primary, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${P_COLS}`,
        [orgId, b.kind, b.holder_name.trim().slice(0, 140), this.cipher.encryptJson(value), l4, ifsc, primary, by],
      )).rows[0];
    });
  }

  async updatePayout(orgId: string, id: string, b: { holder_name?: string; is_primary?: boolean }) {
    return this.db.tx(async (tx) => {
      if (b.is_primary) await tx.query("UPDATE zolexora_payout_accounts SET is_primary = false WHERE organization_id = $1", [orgId]);
      const row = (await tx.query<PayoutRow>(
        `UPDATE zolexora_payout_accounts SET holder_name = COALESCE($3, holder_name), is_primary = COALESCE($4, is_primary)
         WHERE organization_id = $1 AND id::text = $2 RETURNING ${P_COLS}`,
        [orgId, id, b.holder_name?.trim().slice(0, 140) ?? null, b.is_primary ?? null],
      )).rows[0];
      // Editing an account re-verifies only that account.
      if (row && b.holder_name !== undefined) {
        await tx.query(
          `UPDATE zolexora_verifications SET status = 'pending', reason = 'Account details changed. An admin will review it.', decided_by = NULL, decided_at = NULL
           WHERE payout_account_id = $1 AND status <> 'rejected'`, [id],
        );
      }
      return row ?? null;
    });
  }

  async removePayout(orgId: string, id: string) {
    return (await this.db.query("DELETE FROM zolexora_payout_accounts WHERE organization_id = $1 AND id::text = $2", [orgId, id])).rowCount > 0;
  }

  private async sameAccount(payoutId: string, account: string | null, ifsc: string | null): Promise<boolean> {
    const a = (await this.db.query<PayoutRow>(`SELECT ${P_COLS} FROM zolexora_payout_accounts WHERE id = $1`, [payoutId])).rows[0];
    if (!a || !account) return false;
    const v = this.cipher.decryptJson<{ account_number?: string; vpa?: string; ifsc?: string }>(a.value_encrypted);
    if (a.kind === "upi") return account.toLowerCase() === v.vpa;
    const got = account.replace(/\s+/g, "").toUpperCase();
    const masked = /[X*]/.test(got);
    const same = masked ? got.slice(-4) === v.account_number!.slice(-4) : got === v.account_number;
    return same && (!ifsc || normalizeId(ifsc) === v.ifsc);
  }

  /** Methods that fit an account, in the configured order. */
  methodsFor(kind: "bank" | "upi"): string[] {
    const fits = kind === "upi" ? ["upi_vpa", "reverse_penny_drop"] : ["reverse_penny_drop", "pennyless", "penny_drop"];
    return this.cfg.bankMethods.filter((m) => fits.includes(m));
  }

  async verifyPayout(org: OrgRow, account: PayoutRow, by: string, method?: string) {
    if (!this.enabled("bank")) throw bad("Bank verification is not required.", "VERIFICATION_NOT_REQUIRED");
    const methods = this.methodsFor(account.kind);
    const m = method ?? methods[0];
    if (!m || !methods.includes(m)) throw bad(`For this account use: ${methods.join(", ") || "none available"}.`, "VERIFICATION_METHOD_UNAVAILABLE");
    const provider = this.cfg.bankProvider;
    const s = { organization_id: org.id, payout_account_id: account.id };
    const v = await this.open(s, "bank", { provider, method: m, value_last4: account.value_last4, submitted_by: by });
    await this.assertBudget(v.id, provider);
    const value = this.cipher.decryptJson<{ account_number?: string; ifsc?: string; vpa?: string }>(account.value_encrypted);
    const expected = await this.expectedNames(org, "bank");
    try {
      if (provider === "cashfree") {
        const cf = this.cfg.cashfree!;
        if (m === "upi_vpa") {
          const r = await cf.upi(v.id, value.vpa!, account.holder_name);
          if (!r.valid) return this.rejectWith(v, provider, m, "This UPI ID doesn't exist.");
          return this.conclude(v, provider, m, r.name, expected, {}, r.ref);
        }
        if (m === "penny_drop") {
          const r = await cf.bankAccount(value.account_number!, value.ifsc!, account.holder_name);
          if (!r.valid) return this.rejectWith(v, provider, m, `The bank says this account is not valid${r.code ? ` (${r.code})` : ""}.`);
          return this.conclude(v, provider, m, r.name, expected, {}, r.ref);
        }
        const r = await cf.reversePennyDrop(v.id, account.holder_name);
        await this.attempt(v.id, { provider, method: m, outcome: "started" });
        const row = await this.update(v.id, { provider_ref: r.ref, details: { stage: "awaiting_payment" } });
        return Object.assign(row, { action: { provider, upi_link: r.upiLink, qr_code: r.qrCode, valid_upto: r.validUpto } });
      }
      const template = m === "penny_drop" ? this.cfg.digioTemplates.penny_drop! : this.cfg.digioTemplates.reverse_penny_drop!;
      return this.startDigio(v, template, org, m);
    } catch (e) {
      if (e instanceof ProviderRejected) return this.rejectWith(v, provider, m, e.message);
      if (e instanceof ProviderUnavailable) {
        await this.attempt(v.id, { provider, method: m, outcome: "unavailable", note: e.message });
        throw err(503, "VERIFICATION_UNAVAILABLE", "The verification service is not available right now. Try again later.");
      }
      throw e;
    }
  }

  // ── Edits and admin decisions ─────────────────────────────────────────────
  /** Changing the legal or trade name sends PAN, GST, registration, authority and bank back for review. */
  async onOrgEdited(org: OrgRow, changed: string[]) {
    if (!changed.some((c) => c === "legal_name" || c === "trade_name")) return;
    await this.db.query(
      `UPDATE zolexora_verifications SET status = 'pending', reason = 'The business name changed. An admin will review it.',
              decided_by = NULL, decided_at = NULL
       WHERE organization_id = $1 AND status IN ('verified', 'needs_revision')`,
      [org.id],
    );
  }

  async decide(id: string, status: "verified" | "rejected" | "needs_revision", reason: string | null, admin: string) {
    const v = await this.getById(id);
    if (!v) return null;
    await this.attempt(v.id, { provider: "admin", method: v.method, outcome: status, note: reason, actor: admin });
    return this.update(v.id, { status, reason, decided_by: admin });
  }

  async adminList(f: { status?: string; check?: string; limit?: number }) {
    return (await this.db.query(
      `SELECT v.id, v.check_type, v.status, v.provider, v.method, v.value_last4, v.registered_name, v.reason, v.created_at, v.updated_at,
              o.zolexora_org_id, o.name AS org_name, o.business_kind, u.zolexora_id AS user_zolexora_id, u.display_name AS user_name,
              v.payout_account_id
       FROM zolexora_verifications v
       LEFT JOIN zolexora_organizations o ON o.id = v.organization_id
       LEFT JOIN zolexora_auth_users u ON u.id = v.user_id
       WHERE ($1::text IS NULL OR v.status = $1) AND ($2::text IS NULL OR v.check_type = $2)
       ORDER BY v.updated_at ASC LIMIT $3`,
      [f.status ?? null, f.check ?? null, Math.min(f.limit ?? 100, 500)],
    )).rows;
  }

  /** Everything an admin needs to decide, including the full number (admins only). */
  async adminDetail(id: string) {
    const v = await this.getById(id);
    if (!v) return null;
    const org = v.organization_id ? await this.team.getOrgById(v.organization_id) : null;
    const attempts = (await this.db.query(
      "SELECT provider, method, paid, outcome, registered_name, note, actor_id, created_at FROM zolexora_verification_attempts WHERE verification_id = $1 ORDER BY created_at",
      [v.id],
    )).rows;
    const documents = (await this.db.query(
      `SELECT k.document_id, k.document_type, k.mime_type, k.file_size, k.created_at, t.label, t.official_url, t.verify_url
       FROM zolexora_kyc_documents k LEFT JOIN zolexora_verification_document_types t ON t.key = k.document_type
       WHERE k.document_id = ANY($1::text[])`,
      [v.document_ids],
    )).rows;
    let value: unknown = v.value_encrypted ? this.cipher.decrypt(v.value_encrypted) : null;
    if (v.payout_account_id) {
      const a = (await this.db.query<PayoutRow>(`SELECT ${P_COLS} FROM zolexora_payout_accounts WHERE id = $1`, [v.payout_account_id])).rows[0];
      value = a ? { kind: a.kind, holder_name: a.holder_name, ...this.cipher.decryptJson<Record<string, string>>(a.value_encrypted) } : null;
    }
    const { value_encrypted: _drop, ...rest } = v;
    return {
      verification: rest,
      value,
      organization: org && {
        zolexora_org_id: org.zolexora_org_id, name: org.name, legal_name: org.legal_name, trade_name: org.trade_name,
        business_kind: org.business_kind, pan: org.pan_encrypted ? this.cipher.decrypt(org.pan_encrypted) : null,
        owner_identity_names: await this.ownerIdentityNames(org.id),
      },
      documents,
      attempts,
    };
  }

}
