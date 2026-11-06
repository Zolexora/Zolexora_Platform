// ADR 0004 §2–3a and ADR 0005: businesses, team, roles, invites, business sessions, catalog, MFA, Track 2.
import { createPublicKey, verify } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TURNSTILE, buildTestApp } from "./helpers/fakes.js";
import { InMemoryAuthRepository, SEED, TEST_PASSWORDS } from "./helpers/in-memory-auth.repository.js";
import { PEOPLE, addPerson, adminAuth, dispatcherAuth, memberIdOf, userAuth } from "./helpers/business.js";
import { TEST_PRODUCT_KEYS } from "./helpers/test-env.js";
import { currentStep, totpCode } from "../src/services/totp.service.js";

const ORG = SEED.defaultOrg;
const COMPANY_PAN = "AABCZ1234F";
const NEW_PASSWORD = "Brand-New-Staff-Pass-2026";
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const tokenFrom = (link: string) => new URL(link).searchParams.get("token")!;
const tokenFromMail = (text: string) => text.match(/token=([A-Za-z0-9_%-]+)/)![1];

describe("Businesses, team and business sessions", () => {
  let repo: InMemoryAuthRepository;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  const inject = (method: string, url: string, headers: Record<string, string> = {}, payload?: unknown) =>
    app.inject({ method: method as any, url, headers, payload: payload as any });

  beforeEach(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildTestApp(repo);
  });
  afterEach(() => app.close());

  const createCompany = async (who = PEOPLE.consumer, pan = COMPANY_PAN) =>
    inject("POST", "/api/v1/organizations", userAuth(who), { pan, legal_name: "Meena Textiles Private Limited", activity_primary: "textiles_apparel" });

  const roleId = async (org: string, key: string, scope = "org") =>
    (await inject("GET", `/api/v1/organizations/${org}/roles`, adminAuth())).json().roles.find((r: any) => r.key === key && r.scope === scope).id;

  /** Invites an employee by phone and accepts it; returns the new ZX id. */
  const hireEmployee = async (org: string, by: Record<string, string>, extra: Record<string, unknown> = {}, phone = "+919811112222") => {
    const inv = await inject("POST", `/api/v1/organizations/${org}/invites`, by, { kind: "employee", phone_number: phone, ...extra });
    expect(inv.statusCode).toBe(201);
    const acc = await inject("POST", `/api/v1/invites/${tokenFrom(inv.json().link)}/accept`, {}, { password: NEW_PASSWORD, turnstile_token: TURNSTILE.VALID_TOKEN });
    expect(acc.statusCode).toBe(201);
    return acc.json() as { zolexora_id: string; member_id: string };
  };
  /** Sets up an authenticator; returns the secret and the step already used. */
  const enrol = async (headers: Record<string, string>) => {
    const { secret } = (await inject("POST", "/api/v1/auth/mfa/setup", headers)).json();
    const step = currentStep();
    expect((await inject("POST", "/api/v1/auth/mfa/confirm", headers, { code: totpCode(secret, step) })).statusCode).toBe(200);
    return { secret, step };
  };
  const employeeLogin = (payload: Record<string, unknown>) =>
    inject("POST", "/api/v1/auth/employee/login", {}, { turnstile_token: TURNSTILE.VALID_TOKEN, ...payload });

  // ── Businesses ────────────────────────────────────────────────────────────
  describe("business from PAN", () => {
    it("derives the type from the PAN, makes the creator owner and never returns the PAN", async () => {
      const res = await createCompany();
      expect(res.statusCode).toBe(201);
      const org = res.json().organization;
      expect(org.business_kind).toBe("company");
      expect(org.pan_last4).toBe("234F");
      expect(JSON.stringify(res.json())).not.toContain(COMPANY_PAN);
      expect(res.json().role).toBe("owner");

      const mine = await inject("GET", "/api/v1/me/organizations", userAuth(PEOPLE.consumer));
      expect(mine.json().organizations.map((o: any) => o.zolexora_org_id)).toContain(org.zolexora_org_id);
    });

    it("allows one business per PAN, except personal PANs", async () => {
      expect((await createCompany()).statusCode).toBe(201);
      const dup = await createCompany(PEOPLE.manager);
      expect(dup.statusCode).toBe(409);
      expect(dup.json().code).toBe("ORG_PAN_EXISTS");

      const personal = { pan: "ABCPE1234F", legal_name: "Meena Store", has_business_registration: true };
      expect((await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.consumer), personal)).statusCode).toBe(201);
      expect((await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.consumer), { ...personal, legal_name: "Meena Cafe" })).statusCode).toBe(201);
    });

    it("asks the follow-up question for personal and firm PANs, and rejects unknown activities", async () => {
      const p = await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.consumer), { pan: "ABCPE1234F", legal_name: "Meena" });
      expect(p.json().code).toBe("ORG_FOLLOW_UP_REQUIRED");
      const f = await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.consumer), { pan: "ABCFE1234F", legal_name: "Meena & Co" });
      expect(f.json().code).toBe("ORG_FOLLOW_UP_REQUIRED");
      const llp = await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.consumer), { pan: "ABCFE1234F", legal_name: "Meena LLP", has_llpin: true });
      expect(llp.json().organization.business_kind).toBe("llp");
      const bad = await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.consumer), { pan: "AABCY1234F", legal_name: "X Pvt Ltd", activity_primary: "space_mining" });
      expect(bad.json().code).toBe("ORG_UNKNOWN_ACTIVITY");
    });

    it("edits keep the display name in step and close signs everyone out", async () => {
      const org = (await createCompany()).json().organization.zolexora_org_id;
      const edit = await inject("PATCH", `/api/v1/organizations/${org}`, userAuth(PEOPLE.consumer), { trade_name: "Meena Silks" });
      expect(edit.json().organization.name).toBe("Meena Silks");
      expect(edit.json().changed).toEqual(["trade_name"]);

      const s = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.consumer), { org_id: org })).json();
      const wrong = await inject("POST", `/api/v1/organizations/${org}/close`, userAuth(PEOPLE.consumer), { confirm: "yes" });
      expect(wrong.json().code).toBe("ORG_CLOSE_CONFIRM");
      expect((await inject("POST", `/api/v1/organizations/${org}/close`, userAuth(PEOPLE.consumer), { confirm: org })).statusCode).toBe(200);
      expect((await inject("GET", "/api/v1/auth/me", bearer(s.access_token))).statusCode).toBe(401);
      // The PAN is free again.
      expect((await createCompany(PEOPLE.manager)).statusCode).toBe(201);
    });
  });

  // ── Business sessions ─────────────────────────────────────────────────────
  describe("org-session tokens", () => {
    it("issues an ES256 token that verifies with the published JWKS, and /auth/me recomputes access", async () => {
      await addPerson(repo, SEED.ids.defaultOrg, PEOPLE.manager, "member");
      const s = await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG.toLowerCase() });
      expect(s.statusCode).toBe(200);
      const { access_token, expires_in, claims } = s.json();
      expect(expires_in).toBe(900);
      expect(claims.permissions).toEqual(["org:profile:view"]);

      const jwks = (await inject("GET", "/.well-known/jwks.json")).json();
      const [h, p, sig] = access_token.split(".");
      const head = JSON.parse(Buffer.from(h, "base64url").toString());
      expect(head.alg).toBe("ES256");
      const key = createPublicKey({ key: jwks.keys.find((k: any) => k.kid === head.kid), format: "jwk" });
      expect(verify("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"))).toBe(true);

      // Promote to admin: /auth/me reflects it at once (no new token needed).
      const memberId = s.json().member.id;
      await inject("PATCH", `/api/v1/organizations/${ORG}/members/${memberId}`, adminAuth(), { org_role_id: await roleId(ORG, "admin") });
      const me = (await inject("GET", "/api/v1/auth/me", bearer(access_token))).json();
      expect(me.role).toBe("admin");
      expect(me.permissions).toContain("org:team:manage");
    });

    it("rotates refresh tokens and ends the session when an old one is reused", async () => {
      await addPerson(repo, SEED.ids.defaultOrg, PEOPLE.manager, "member");
      const first = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG })).json();
      const second = await inject("POST", "/api/v1/auth/token/refresh", {}, { refresh_token: first.refresh_token });
      expect(second.statusCode).toBe(200);
      expect(second.json().refresh_token).not.toBe(first.refresh_token);

      const replay = await inject("POST", "/api/v1/auth/token/refresh", {}, { refresh_token: first.refresh_token });
      expect(replay.json().code).toBe("AUTH_REFRESH_REUSED");
      // The whole session is gone: the newest tokens stop working too.
      expect((await inject("POST", "/api/v1/auth/token/refresh", {}, { refresh_token: second.json().refresh_token })).statusCode).toBe(401);
      expect((await inject("GET", "/api/v1/auth/me", bearer(second.json().access_token))).statusCode).toBe(401);
    });

    it("refuses outsiders, unknown products and helper tickets used as access tokens", async () => {
      expect((await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG })).statusCode).toBe(404);
      await addPerson(repo, SEED.ids.defaultOrg, PEOPLE.manager, "member");
      const bad = await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG, product: "nope" });
      expect(bad.json().code).toBe("AUTH_UNKNOWN_PRODUCT");
    });

    it("lists devices and signs out others", async () => {
      await addPerson(repo, SEED.ids.defaultOrg, PEOPLE.manager, "member");
      const a = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG })).json();
      const b = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG })).json();
      expect((await inject("GET", "/api/v1/auth/sessions", bearer(a.access_token))).json().sessions).toHaveLength(2);
      expect((await inject("POST", "/api/v1/auth/sessions/revoke-others", bearer(a.access_token))).json().revoked).toBe(1);
      expect((await inject("GET", "/api/v1/auth/me", bearer(b.access_token))).statusCode).toBe(401);
      expect((await inject("GET", "/api/v1/auth/me", bearer(a.access_token))).statusCode).toBe(200);
    });
  });

  // ── Team guard rails (ADR 0005 §4) ────────────────────────────────────────
  describe("guard rails", () => {
    let org: string;
    let ownerMember: string;
    let adminMember: string;
    beforeEach(async () => {
      const c = (await createCompany()).json();
      org = c.organization.zolexora_org_id;
      ownerMember = c.member_id;
      const orgUuid = (await repo.authDb.query("SELECT id FROM zolexora_organizations WHERE zolexora_org_id = $1", [org])).rows[0].id;
      adminMember = await addPerson(repo, orgUuid, PEOPLE.manager, "admin");
    });
    const asOwner = () => userAuth(PEOPLE.consumer);
    const asAdmin = () => userAuth(PEOPLE.manager);

    it("admins can't touch owners, nobody changes themselves, and the last owner stays", async () => {
      expect((await inject("PATCH", `/api/v1/organizations/${org}/members/${ownerMember}`, asAdmin(), { status: "suspended" })).statusCode).toBe(403);
      expect((await inject("PATCH", `/api/v1/organizations/${org}/members/${adminMember}`, asAdmin(), { status: "suspended" })).statusCode).toBe(403);
      const leave = await inject("DELETE", `/api/v1/organizations/${org}/members/me`, asOwner());
      expect(leave.statusCode).toBe(403);
      expect(leave.json().message).toContain("always have an owner");
      // The owner role itself can't be edited.
      expect((await inject("PATCH", `/api/v1/organizations/${org}/roles/${await roleId(org, "owner")}`, asOwner(), { blocks: [] })).statusCode).toBe(403);
    });

    it("blocks always win, and owner-only permissions can't be handed out", async () => {
      const block = await inject("PUT", `/api/v1/organizations/${org}/members/${adminMember}/overrides`, asOwner(), { permission: "org:team:invite", effect: "block" });
      expect(block.statusCode).toBe(200);
      const access = (await inject("GET", `/api/v1/organizations/${org}/members/${adminMember}/access`, asOwner())).json();
      expect(access.permissions).not.toContain("org:team:invite");
      expect(access.explain["org:team:invite"]).toContain("blocked for this person");

      const give = await inject("PUT", `/api/v1/organizations/${org}/members/${adminMember}/overrides`, asOwner(), { permission: "org:business:close", effect: "grant" });
      expect(give.statusCode).toBe(400);
      const role = await inject("POST", `/api/v1/organizations/${org}/roles`, asOwner(), { scope: "org", name: "Closer", permissions: ["org:ownership:transfer"] });
      expect(role.statusCode).toBe(400);
    });

    it("payouts go to a custom role only when the business requires MFA", async () => {
      const body = { scope: "org", name: "Accounts Admin", permissions: ["org:profile:view", "org:payouts:manage"] };
      expect((await inject("POST", `/api/v1/organizations/${org}/roles`, asOwner(), body)).statusCode).toBe(400);
      expect((await inject("PUT", `/api/v1/organizations/${org}/security`, asOwner(), { mfa_policy: "required" })).statusCode).toBe(200);
      // Role management is now MFA-sensitive: the owner needs a session opened with a code.
      expect((await inject("POST", `/api/v1/organizations/${org}/roles`, asOwner(), body)).statusCode).toBe(403);
      const { secret, step } = await enrol(asOwner());
      const s = (await inject("POST", "/api/v1/auth/org-session", asOwner(), { org_id: org, mfa_code: totpCode(secret, step + 1) })).json();
      expect((await inject("POST", `/api/v1/organizations/${org}/roles`, bearer(s.access_token), body)).statusCode).toBe(201);
    });

    it("the holding rule: an admin can't grant what they don't hold", async () => {
      const r = await inject("POST", `/api/v1/organizations/${org}/roles`, asAdmin(), { scope: "org", name: "Payout Clerk", permissions: ["common:billing:manage"] });
      expect(r.statusCode).toBe(403);
    });

    it("disabling a built-in role moves its people", async () => {
      const member = await roleId(org, "member");
      const res = await inject("PATCH", `/api/v1/organizations/${org}/roles/${await roleId(org, "admin")}`, asOwner(), { disabled: true });
      expect(res.json().code).toBe("ROLE_MOVE_REQUIRED");
      expect((await inject("PATCH", `/api/v1/organizations/${org}/roles/${await roleId(org, "admin")}`, asOwner(), { disabled: true, move_to: member })).statusCode).toBe(200);
      const access = (await inject("GET", `/api/v1/organizations/${org}/members/${adminMember}/access`, asOwner())).json();
      expect(access.role).toBe("member");
    });

    it("ownership transfer makes the old owner an admin", async () => {
      const res = await inject("POST", `/api/v1/organizations/${org}/transfer-ownership`, asOwner(), { member_id: adminMember });
      expect(res.statusCode).toBe(200);
      const members = (await inject("GET", `/api/v1/organizations/${org}/members`, asAdmin())).json().members;
      const roleOf = (id: string) => members.find((m: any) => m.id === id).roles.find((r: any) => r.scope === "org").key;
      expect(roleOf(adminMember)).toBe("owner");
      expect(roleOf(ownerMember)).toBe("admin");
    });
  });

  // ── Catalog and product roles ─────────────────────────────────────────────
  describe("permission catalog", () => {
    const register = (permissions: { key: string; description: string }[], key = TEST_PRODUCT_KEYS.tms) =>
      inject("PUT", "/api/v1/catalog/tms", { "x-product-key": key }, { permissions });
    const TRIPS = [{ key: "tms:trips:create", description: "Create trips" }, { key: "tms:trips:view", description: "See trips" }];

    it("checks the product key and the prefix", async () => {
      expect((await register(TRIPS, "wrong")).statusCode).toBe(401);
      expect((await register([{ key: "marketplace:orders:refund", description: "x" }])).json().code).toBe("CATALOG_BAD_KEY");
    });

    it("adds at once, removes only after approval, and scopes tokens to the product", async () => {
      expect((await register(TRIPS)).json()).toMatchObject({ status: "applied", added: ["tms:trips:create", "tms:trips:view"] });

      const role = await inject("POST", `/api/v1/organizations/${ORG}/roles`, adminAuth(), { scope: "tms", name: "Dispatcher", permissions: ["tms:trips:create", "tms:trips:view"] });
      expect(role.statusCode).toBe(201);
      await addPerson(repo, SEED.ids.defaultOrg, PEOPLE.manager, "member");
      const memberId = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG })).json().member.id;
      expect((await inject("PUT", `/api/v1/organizations/${ORG}/members/${memberId}/roles/tms`, adminAuth(), { role_id: role.json().role.id })).statusCode).toBe(200);

      const inTms = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG, product: "tms" })).json();
      expect(inTms.claims.permissions).toEqual(["org:profile:view", "tms:trips:create", "tms:trips:view"]);
      const inMarket = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.manager), { org_id: ORG, product: "marketplace" })).json();
      expect(inMarket.claims.permissions).toEqual(["org:profile:view"]);

      // Removing "create" waits for a platform admin; until then it still works.
      const removal = await register([TRIPS[1]]);
      expect(removal.statusCode).toBe(202);
      expect((await inject("GET", "/api/v1/auth/me", bearer(inTms.access_token))).json().permissions).toContain("tms:trips:create");
      const pending = (await inject("GET", "/api/v1/admin/catalog/versions?status=pending_approval", adminAuth())).json().versions;
      expect(pending).toHaveLength(1);
      expect((await inject("POST", `/api/v1/admin/catalog/versions/${pending[0].id}/approve`, adminAuth())).statusCode).toBe(200);
      expect((await inject("GET", "/api/v1/auth/me", bearer(inTms.access_token))).json().permissions).not.toContain("tms:trips:create");

      // Roll back to version 1 brings it back.
      const v1 = (await inject("GET", "/api/v1/admin/catalog/versions?product=tms", adminAuth())).json().versions.find((v: any) => v.version === 1);
      expect((await inject("POST", `/api/v1/admin/catalog/versions/${v1.id}/rollback`, adminAuth())).json().version.added).toEqual(["tms:trips:create"]);
    });
  });

  // ── Invites and Track 2 ───────────────────────────────────────────────────
  describe("invites and employee sign-in", () => {
    it("an employee joins by invite link and signs in with the ZX id, no org id needed", async () => {
      const inv = await inject("POST", `/api/v1/organizations/${ORG}/invites`, adminAuth(), { kind: "employee", phone_number: "+919811112222" });
      const token = tokenFrom(inv.json().link);
      const preview = (await inject("GET", `/api/v1/invites/${token}`)).json().invite;
      expect(preview).toMatchObject({ kind: "employee", role: "Member", phone_number: "••••2222" });

      const leaked = await inject("POST", `/api/v1/invites/${token}/accept`, {}, { password: "LeakedPassword123!", turnstile_token: TURNSTILE.VALID_TOKEN });
      expect(leaked.json().code).toBe("AUTH_PASSWORD_PWNED");
      const ok = await inject("POST", `/api/v1/invites/${token}/accept`, {}, { password: NEW_PASSWORD, turnstile_token: TURNSTILE.VALID_TOKEN });
      expect(ok.statusCode).toBe(201);
      expect((await inject("POST", `/api/v1/invites/${token}/accept`, {}, { password: NEW_PASSWORD, turnstile_token: TURNSTILE.VALID_TOKEN })).statusCode).toBe(404);

      for (const id of [ok.json().zolexora_id, "+919811112222"]) {
        const login = await employeeLogin({ user_id_or_email: id, password: NEW_PASSWORD, product: "zolexora-tms" });
        expect(login.statusCode).toBe(200);
        expect(login.json()).toMatchObject({ success: true, org: { zolexora_org_id: ORG }, claims: { role: "member", org_id: ORG } });
        expect(login.json().access_token).toBeTruthy();
        expect(login.json().customToken).toBeTruthy();
      }
    });

    it("an email used in two businesses gets the picker only after the right password", async () => {
      // The seeded dispatcher also joins the second business with the same email.
      const inv = await inject("POST", `/api/v1/organizations/${SEED.secondOrg}/invites`, adminAuth(), { kind: "employee", email: "dispatcher@zolexora.com" });
      const token = tokenFromMail(app.mail.sent.at(-1)!.text);
      expect(inv.json().link).toBeUndefined(); // email invites go by email only
      await inject("POST", `/api/v1/invites/${token}/accept`, {}, { password: TEST_PASSWORDS.standard, turnstile_token: TURNSTILE.VALID_TOKEN });

      const wrong = await employeeLogin({ user_id_or_email: "dispatcher@zolexora.com", password: "Wrong-Password-123" });
      expect(wrong.json().code).toBe("AUTH_INVALID_CREDENTIALS");
      const pick = await employeeLogin({ user_id_or_email: "dispatcher@zolexora.com", password: TEST_PASSWORDS.standard });
      expect(pick.json().choose_business).toBe(true);
      expect(pick.json().businesses.map((b: any) => b.zolexora_org_id).sort()).toEqual([ORG, SEED.secondOrg].sort());

      const done = await employeeLogin({ login_ticket: pick.json().login_ticket, org_id: SEED.secondOrg });
      expect(done.json().org.zolexora_org_id).toBe(SEED.secondOrg);
      // A ticket is not an access token.
      expect((await inject("GET", "/api/v1/auth/me", bearer(pick.json().login_ticket))).statusCode).toBe(401);
    });

    it("locks out after repeated failures (kept in the database)", async () => {
      for (let i = 0; i < 5; i++) await employeeLogin({ user_id_or_email: SEED.dispatcherZxId, password: "Wrong-Password-123" });
      const locked = await employeeLogin({ user_id_or_email: SEED.dispatcherZxId, password: TEST_PASSWORDS.standard });
      expect(locked.statusCode).toBe(429);
      // A fresh app (another replica) sees the same lock.
      const other = await buildTestApp(repo);
      const again = await other.inject({ method: "POST", url: "/api/v1/auth/employee/login", payload: { user_id_or_email: SEED.dispatcherZxId, password: TEST_PASSWORDS.standard, turnstile_token: TURNSTILE.VALID_TOKEN } });
      expect(again.statusCode).toBe(429);
    });

    it("a forced reset stops the old password and the employee sets a new one", async () => {
      const dispatcher = await memberIdOf(repo, SEED.ids.dispatcher);
      const reset = await inject("POST", `/api/v1/organizations/${ORG}/members/${dispatcher}/reset-password`, adminAuth());
      expect(reset.statusCode).toBe(201);
      expect((await employeeLogin({ user_id_or_email: SEED.dispatcherZxId, password: TEST_PASSWORDS.standard })).statusCode).toBe(401);
      const token = tokenFromMail(app.mail.sent.at(-1)!.text);
      expect((await inject("GET", `/api/v1/invites/${token}`)).json().invite.reset).toBe(true);
      await inject("POST", `/api/v1/invites/${token}/accept`, {}, { password: NEW_PASSWORD, turnstile_token: TURNSTILE.VALID_TOKEN });
      expect((await employeeLogin({ user_id_or_email: SEED.dispatcherZxId, password: NEW_PASSWORD })).statusCode).toBe(200);
    });

    it("a manager invites members only, and people accept with the invited email", async () => {
      const inv = await inject("POST", `/api/v1/organizations/${ORG}/invites`, dispatcherAuth(), { kind: "person", email: PEOPLE.manager.email });
      expect(inv.statusCode).toBe(201);
      const token = tokenFromMail(app.mail.sent.at(-1)!.text);
      expect((await inject("POST", `/api/v1/invites/${token}/accept`, userAuth(PEOPLE.consumer))).statusCode).toBe(403);
      expect((await inject("POST", `/api/v1/invites/${token}/accept`)).statusCode).toBe(401);
      expect((await inject("POST", `/api/v1/invites/${token}/accept`, userAuth(PEOPLE.manager))).statusCode).toBe(201);
      const orgs = (await inject("GET", "/api/v1/me/organizations", userAuth(PEOPLE.manager))).json().organizations;
      expect(orgs.find((o: any) => o.zolexora_org_id === ORG).role).toBe("member");
    });

    it("an admin can still create an employee directly, but never an owner", async () => {
      const create = (payload: Record<string, unknown>) =>
        inject("POST", "/api/v1/auth/employee/create", adminAuth(), { org_id: ORG, password: NEW_PASSWORD, ...payload });
      expect((await create({ email: "boss@globalfreight.com", role: "owner" })).json().error.code).toBe("AUTH_OWNER_NEEDS_ZOLEXORA_ACCOUNT");
      expect((await create({ email: "boss@globalfreight.com", org_role_id: await roleId(ORG, "owner") })).statusCode).toBe(400);
      expect((await create({ email: "x@gmail.com" })).json().error.code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
      expect((await create({ email: "x@globalfreight.com", permissions: ["org:team:invite"] })).statusCode).toBe(400);

      const res = await create({ email: "packer@globalfreight.com", role: "manager" });
      expect(res.statusCode).toBe(201);
      expect((await create({ email: "packer@globalfreight.com" })).json().error.code).toBe("AUTH_EMPLOYEE_EXISTS");
      const login = await employeeLogin({ user_id_or_email: res.json().employee.zolexora_id, password: NEW_PASSWORD });
      expect(login.statusCode).toBe(200);
      expect(login.json().claims.role).toBe("manager");
      // A manager (the dispatcher) may create members only.
      const byManager = (role: string) => inject("POST", "/api/v1/auth/employee/create", dispatcherAuth(),
        { org_id: ORG, password: NEW_PASSWORD, email: `${role}2@globalfreight.com`, role });
      expect((await byManager("admin")).statusCode).toBe(403);
      expect((await byManager("member")).statusCode).toBe(201);
    });

    it("an owner invite goes to a Zolexora account: by email, accepted after sign-in or sign-up", async () => {
      const org = (await createCompany()).json().organization.zolexora_org_id;
      const owner = await roleId(org, "owner");
      const invite = (payload: Record<string, unknown>) =>
        inject("POST", `/api/v1/organizations/${org}/invites`, userAuth(PEOPLE.consumer), { org_role_id: owner, ...payload });
      expect((await invite({ kind: "employee", email: "boss@meena.in" })).json().error.code).toBe("AUTH_OWNER_NEEDS_ZOLEXORA_ACCOUNT");
      expect((await invite({ kind: "person", email: PEOPLE.manager.email })).statusCode).toBe(201);
      const token = tokenFromMail(app.mail.sent.at(-1)!.text);
      expect((await inject("GET", `/api/v1/invites/${token}`)).json().invite.needs_zolexora_account).toBe(true);
      expect((await inject("POST", `/api/v1/invites/${token}/accept`)).json().error.code).toBe("AUTH_ZOLEXORA_ACCOUNT_REQUIRED");
      expect((await inject("POST", `/api/v1/invites/${token}/accept`, userAuth(PEOPLE.manager))).statusCode).toBe(201);
      const orgs = (await inject("GET", "/api/v1/me/organizations", userAuth(PEOPLE.manager))).json().organizations;
      expect(orgs.find((o: any) => o.zolexora_org_id === org).role).toBe("owner");
    });

  });

  // ── MFA ───────────────────────────────────────────────────────────────────
  describe("MFA (authenticator app)", () => {
    it("employees with MFA sign in in two steps, and a code works once", async () => {
      const emp = await hireEmployee(ORG, adminAuth());
      const login1 = (await employeeLogin({ user_id_or_email: emp.zolexora_id, password: NEW_PASSWORD })).json();
      const { secret, step } = await enrol(bearer(login1.access_token));

      const login2 = (await employeeLogin({ user_id_or_email: emp.zolexora_id, password: NEW_PASSWORD })).json();
      expect(login2.mfa_required).toBe(true);
      expect(login2.access_token).toBeUndefined();
      // The confirm step already used this code.
      expect((await inject("POST", "/api/v1/auth/employee/mfa", {}, { mfa_ticket: login2.mfa_ticket, code: totpCode(secret, step) })).statusCode).toBe(401);
      const done = await inject("POST", "/api/v1/auth/employee/mfa", {}, { mfa_ticket: login2.mfa_ticket, code: totpCode(secret, step + 1) });
      expect(done.statusCode).toBe(200);
      expect(done.json().access_token).toBeTruthy();
    });

    it("with MFA required, sensitive permissions need an MFA session", async () => {
      const org = (await createCompany()).json().organization.zolexora_org_id;
      await inject("PUT", `/api/v1/organizations/${org}/security`, userAuth(PEOPLE.consumer), { mfa_policy: "required" });
      // Owner without MFA: the session opens but security settings are out of reach until MFA is set up.
      const s = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.consumer), { org_id: org })).json();
      expect((await inject("PUT", `/api/v1/organizations/${org}/security`, bearer(s.access_token), { mfa_policy: "off" })).statusCode).toBe(403);

      const { secret, step } = await enrol(userAuth(PEOPLE.consumer));
      const noCode = await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.consumer), { org_id: org });
      expect(noCode.json().code).toBe("AUTH_MFA_REQUIRED");
      const withCode = (await inject("POST", "/api/v1/auth/org-session", userAuth(PEOPLE.consumer), { org_id: org, mfa_code: totpCode(secret, step + 1) })).json();
      expect(withCode.claims.mfa).toBe(true);
      expect((await inject("PUT", `/api/v1/organizations/${org}/security`, bearer(withCode.access_token), { mfa_policy: "optional" })).statusCode).toBe(200);
    });
  });
});
