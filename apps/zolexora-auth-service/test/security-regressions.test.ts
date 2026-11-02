// Regression tests for the security scan findings. Each block names the finding it guards.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyPassword } from "@zolexora/utils";
import { TURNSTILE, buildTestApp, testTokens } from "./helpers/fakes.js";
import { InMemoryAuthRepository, SEED, TEST_PASSWORDS } from "./helpers/in-memory-auth.repository.js";

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

  describe("#3 employee provisioning", () => {
    const payload = { org_id: ORG, email: "new.hire@acme-corp.com", password: TEST_PASSWORDS.standard };

    it("requires authentication", async () => {
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/employee/create", payload });
      expect(res.statusCode).toBe(401);
    });

    it("rejects members and admins of other organisations", async () => {
      for (const claims of [
        { uid: "emp_m", org_id: ORG, role: "member" },
        { uid: "emp_o", org_id: SEED.secondOrg, role: "admin" },
      ]) {
        const res = await app.inject({ method: "POST", url: "/api/v1/auth/employee/create", headers: bearer(claims), payload });
        expect(res.statusCode).toBe(403);
      }
    });

    it("never overwrites an existing employee (no password/role takeover)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/employee/create",
        headers: bearer({ uid: "emp_a", org_id: ORG, role: "admin", permissions: ["*"] }),
        payload: { org_id: ORG, email: "dispatcher@zolexora.com", password: "AttackerChosenPass123!", role: "admin" },
      });
      expect(res.statusCode).toBe(409);
      const emp = await repo.getEmployeeByOrgAndIdentifier(ORG, "dispatcher@zolexora.com");
      expect(emp!.role).toBe("manager");
      expect(await verifyPassword(TEST_PASSWORDS.standard, emp!.password_hash)).toBe(true);
    });

    it("does not auto-create unknown organisations", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/employee/create",
        headers: bearer({ uid: "adm", is_platform_admin: true }),
        payload: { ...payload, org_id: "ZX-ORG-AAAA-BBBB-CCCC" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("cannot grant permissions the caller does not hold", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/employee/create",
        headers: bearer({ uid: "emp_a", org_id: ORG, role: "admin", permissions: ["trips:read"] }),
        payload: { ...payload, permissions: ["billing:write"] },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("#4 signup / OTP", () => {
    const signup = (email: string, password = TEST_PASSWORDS.standard) =>
      app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: { email, phoneNumber: "+919800000000", password, turnstile_token: TURNSTILE.VALID_TOKEN },
      });

    it("codes are random and emailed; the old fixed codes do not work", async () => {
      expect((await signup("fresh@example.com")).statusCode).toBe(201);
      const code = app.mail.lastCode("fresh@example.com");
      expect(code).toMatch(/^\d{6}$/);
      for (const fixed of ["123456", "000000"].filter((c) => c !== code)) {
        const res = await app.inject({ method: "POST", url: "/api/v1/auth/public/verify-email-otp", payload: { email: "fresh@example.com", otp: fixed } });
        expect(res.statusCode).toBe(400);
      }
      const ok = await app.inject({ method: "POST", url: "/api/v1/auth/public/verify-email-otp", payload: { email: "fresh@example.com", otp: code } });
      expect(ok.statusCode).toBe(200);
      // Single use
      const again = await app.inject({ method: "POST", url: "/api/v1/auth/public/verify-email-otp", payload: { email: "fresh@example.com", otp: code } });
      expect(again.statusCode).toBe(400);
    });

    it("locks the code after OTP_MAX_ATTEMPTS wrong guesses", async () => {
      await signup("brute@example.com");
      const code = app.mail.lastCode("brute@example.com")!;
      const wrong = code === "111111" ? "222222" : "111111";
      for (let i = 0; i < 5; i++) {
        await app.inject({ method: "POST", url: "/api/v1/auth/public/verify-email-otp", payload: { email: "brute@example.com", otp: wrong } });
      }
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/public/verify-email-otp", payload: { email: "brute@example.com", otp: code } });
      expect(res.statusCode).toBe(400);
    });

    it("signing up with an existing email cannot replace that account's password", async () => {
      const res = await signup("consumer@clarityfi.app", "AttackerChosenPass123!");
      expect(res.statusCode).toBe(201); // indistinguishable response (no enumeration)
      expect(app.mail.lastCode("consumer@clarityfi.app")).toBeUndefined(); // nothing issued
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
    const oldToken = testTokens().signJwt({ uid: "usr_9981", iat: Math.floor(Date.now() / 1000) - 5 });
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
});
