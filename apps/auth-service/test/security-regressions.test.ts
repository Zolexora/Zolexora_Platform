// Regression tests for the security scan findings. Each block names the finding it guards.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyPassword } from "@zolexora/utils";
import { TURNSTILE, buildTestApp, testTokens } from "./helpers/fakes.js";
import { InMemoryAuthRepository, SEED, TEST_PASSWORDS } from "./helpers/in-memory-auth.repository.js";
import { fakeS3Objects } from "./setup.js";
import { env } from "../src/config/env.js";
import { PEOPLE, addPerson, adminAuth, dispatcherAuth, userAuth } from "./helpers/business.js";

const ORG = SEED.defaultOrg;
const bearer = (claims: Record<string, any>) => ({ authorization: `Bearer ${testTokens().signJwt(claims)}` });

describe("Security regressions", () => {
  let repo: InMemoryAuthRepository;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildTestApp(repo);
  });
  afterEach(() => app.close());

  it("#1 opaque / fixture bearer strings are rejected", async () => {
    for (const token of ["usr_anything", "token_belonging_to_usr_1", "expired_token", "a.b.c"]) {
      const res = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(401);
    }
  });

  describe("#3 employee provisioning (invite links only)", () => {
    const invites = `/api/v1/organizations/${ORG}/invites`;
    const payload = { kind: "employee", email: "new.hire@acme-corp.com" };

    it("requires authentication", async () => {
      const res = await app.inject({ method: "POST", url: invites, payload });
      expect(res.statusCode).toBe(401);
    });

    it("rejects members without invite rights and admins of other businesses", async () => {
      await addPerson(repo, SEED.ids.defaultOrg, PEOPLE.manager, "member");
      await addPerson(repo, SEED.ids.secondOrg, PEOPLE.consumer, "admin");
      for (const who of [PEOPLE.manager, PEOPLE.consumer]) {
        const res = await app.inject({ method: "POST", url: invites, headers: userAuth(who), payload });
        expect(res.statusCode).toBe(403);
      }
      // Forged claims for a non-existent employee get nowhere either.
      const forged = await app.inject({ method: "POST", url: invites, headers: bearer({ uid: "emp_a", org_id: ORG, role: "owner", permissions: ["*"], type: "employee" }), payload });
      expect(forged.statusCode).toBe(403);
    });

    it("never overwrites an existing employee (no password/role takeover)", async () => {
      const res = await app.inject({
        method: "POST", url: invites, headers: adminAuth(), payload: { kind: "employee", email: "dispatcher@zolexora.com" },
      });
      expect(res.statusCode).toBe(409);
      const emp = await repo.getEmployeeByOrgAndIdentifier(ORG, "dispatcher@zolexora.com");
      expect(emp!.role).toBe("manager");
      expect(await verifyPassword(TEST_PASSWORDS.standard, emp!.password_hash)).toBe(true);
    });

    it("does not auto-create unknown organisations", async () => {
      const res = await app.inject({ method: "POST", url: "/api/v1/organizations/ZX-ORG-AAAA-BBBB-CCCC/invites", headers: adminAuth(), payload });
      expect(res.statusCode).toBe(404);
    });

    it("cannot grant a role the caller does not hold (manager inviting an admin)", async () => {
      const roles = (await app.inject({ method: "GET", url: `/api/v1/organizations/${ORG}/roles`, headers: adminAuth() })).json().roles;
      const admin = roles.find((r: any) => r.key === "admin");
      const res = await app.inject({ method: "POST", url: invites, headers: dispatcherAuth(), payload: { ...payload, org_role_id: admin.id } });
      expect(res.statusCode).toBe(403);
      // A plain member invite is fine for a manager.
      const ok = await app.inject({ method: "POST", url: invites, headers: dispatcherAuth(), payload });
      expect(ok.statusCode).toBe(201);
    });
  });

  describe("#4 signup / OTP", () => {
    const identify = (email: string) =>
      app.inject({ method: "POST", url: "/api/v1/auth/public/identify", payload: { email, turnstile_token: TURNSTILE.VALID_TOKEN } });
    const verify = (email: string, otp: string | undefined) =>
      app.inject({ method: "POST", url: "/api/v1/auth/public/signup/email/verify", payload: { email, otp } });

    it("codes are random and emailed; the old fixed codes do not work", async () => {
      expect((await identify("fresh@example.com")).statusCode).toBe(200);
      const code = app.mail.lastCode("fresh@example.com");
      expect(code).toMatch(/^\d{6}$/);
      for (const fixed of ["123456", "000000"].filter((c) => c !== code)) {
        expect((await verify("fresh@example.com", fixed)).statusCode).toBe(400);
      }
      expect((await verify("fresh@example.com", code)).statusCode).toBe(200);
      // Single use
      expect((await verify("fresh@example.com", code)).statusCode).toBe(400);
    });

    it("locks the code after OTP_MAX_ATTEMPTS wrong guesses", async () => {
      await identify("brute@example.com");
      const code = app.mail.lastCode("brute@example.com")!;
      const wrong = code === "111111" ? "222222" : "111111";
      for (let i = 0; i < 5; i++) await verify("brute@example.com", wrong);
      expect((await verify("brute@example.com", code)).statusCode).toBe(400);
    });

    it("an existing email gets the password step: no code, no way to replace the password", async () => {
      const res = await identify("consumer@clarityfi.app");
      expect(res.json()).toMatchObject({ exists: true, next: "password" });
      expect(app.mail.lastCode("consumer@clarityfi.app")).toBeUndefined();
      const user = await repo.getGlobalUserByEmail("consumer@clarityfi.app");
      expect(await verifyPassword(TEST_PASSWORDS.standard, user!.password_hash)).toBe(true);
    });
  });

  describe("#5 token revocation", () => {
    it("requires authentication", async () => {
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/tokens/revoke", payload: { uid: "e" } });
      expect(res.statusCode).toBe(401);
    });

    it("non-admins cannot revoke other users, and matching is exact (no substring)", async () => {
      const victim = testTokens().signJwt({ uid: "usr_victim_e" });
      const attacker = bearer({ uid: "usr_attacker" });
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/tokens/revoke", headers: attacker, payload: { uid: "e" } });
      expect(res.statusCode).toBe(403);
      await repo.revokeToken("e", "user_all_tokens", "test", "test");
      const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${victim}` } });
      expect(me.statusCode).toBe(200);
    });

    it("single_token logs out only the current token", async () => {
      const t = testTokens();
      const a = t.signJwt({ uid: "usr_multi" });
      const b = t.signJwt({ uid: "usr_multi" });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/tokens/revoke",
        headers: { authorization: `Bearer ${a}` },
        payload: { revocation_type: "single_token" },
      });
      expect(res.statusCode).toBe(200);
      const meA = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${a}` } });
      const meB = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${b}` } });
      expect(meA.statusCode).toBe(401);
      expect(meB.statusCode).toBe(200);
    });
  });

  it("#6 /api/v1/test/reset does not exist", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/test/reset" });
    expect(res.statusCode).toBe(404);
  });

  it("#Medium /api/v1/health/secrets is gone and health exposes no secrets metadata", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/health/secrets" })).statusCode).toBe(404);
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json().secrets).toBeUndefined();
  });

  it("#Broken health returns 503 when the database is down", async () => {
    repo.isHealthy = async () => false;
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(503);
  });

  it("#Broken password reset emails a code and the confirmed reset revokes old sessions", async () => {
    const oldToken = testTokens().signJwt({ uid: SEED.ids.consumer, iat: Math.floor(Date.now() / 1000) - 5 });
    const req = await app.inject({
      method: "POST",
      url: "/api/v1/auth/public/reset-password",
      payload: { email: "consumer@clarityfi.app", turnstile_token: TURNSTILE.VALID_TOKEN },
    });
    expect(req.statusCode).toBe(200);
    const code = app.mail.lastCode("consumer@clarityfi.app");
    expect(code).toMatch(/^\d{6}$/);

    const confirm = await app.inject({
      method: "POST",
      url: "/api/v1/auth/public/reset-password/confirm",
      payload: { email: "consumer@clarityfi.app", otp: code, new_password: "BrandNewSecurePass456!" },
    });
    expect(confirm.statusCode).toBe(200);
    const user = await repo.getGlobalUserByEmail("consumer@clarityfi.app");
    expect(await verifyPassword("BrandNewSecurePass456!", user!.password_hash)).toBe(true);
    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${oldToken}` } });
    expect(me.statusCode).toBe(401);
  });

  it("#Medium KYC uploads by employees are pinned to the token's organisation", async () => {
    const pdf = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n").toString("base64")}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/storage/kyc/upload",
      headers: { ...bearer({ uid: "emp_k", zolexora_id: "ZX-4B8T-9M2K-7Y4X", org_id: ORG, role: "member" }), "x-organisation-id": SEED.secondOrg },
      payload: { file: pdf },
    });
    expect(res.statusCode).toBe(403);
  });

  it("#Medium 500 responses never leak internal error messages", async () => {
    repo.getGlobalUserByEmail = async () => {
      throw new Error("connection to db-internal.example:5432 refused for user auth_admin");
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/public/login",
      payload: { email: "x@example.com", password: "whatever-123", turnstile_token: TURNSTILE.VALID_TOKEN },
    });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("db-internal");
  });

  describe("KYC files are stored in the S3-compatible bucket", () => {
    const pdf = Buffer.from("%PDF-1.4\nhello kyc\n");
    const upload = () =>
      app.inject({
        method: "POST",
        url: "/api/v1/storage/kyc/upload",
        headers: { ...bearer({ uid: "usr_k", zolexora_id: SEED.consumerZxId }), "x-organisation-id": ORG },
        payload: { file: `data:application/pdf;base64,${pdf.toString("base64")}` },
      });
    const objectPath = (key: string) => new URL(`${env.KYC_STORAGE_S3_ENDPOINT}/${env.KYC_STORAGE_BUCKET}/${key}`).pathname;

    it("uploads the file bytes, not just metadata", async () => {
      const res = await upload();
      expect(res.statusCode).toBe(201);
      const stored = fakeS3Objects.get(objectPath(res.json().storage_key));
      expect(stored).toEqual({ contentType: "application/pdf", size: pdf.length });
    });

    it("removes the uploaded file when the metadata write fails", async () => {
      fakeS3Objects.clear();
      repo.saveKycDocument = async () => {
        throw new Error("db down");
      };
      expect((await upload()).statusCode).toBe(500);
      expect(fakeS3Objects.size).toBe(0);
    });
  });
});
