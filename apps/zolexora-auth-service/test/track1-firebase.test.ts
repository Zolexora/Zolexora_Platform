// Track 1: Continue with Google / Email / Phone (Firebase), MOBILE_OTP_VERIFICATION.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TURNSTILE, buildTestApp, firebaseIdToken, pnvToken, testFirebase, testTokens } from "./helpers/fakes.js";
import { InMemoryAuthRepository, TEST_PASSWORDS } from "./helpers/in-memory-auth.repository.js";

const PASSWORD = "SecureNewUserPass123!";
const TS = { turnstile_token: TURNSTILE.VALID_TOKEN };

describe("Track 1 — Firebase sign-in", () => {
  let repo: InMemoryAuthRepository;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  const post = (url: string, payload: Record<string, unknown>, headers: Record<string, string> = {}) =>
    app.inject({ method: "POST", url: `/api/v1/auth/public${url}`, payload, headers });

  const verifyEmail = async (email: string, signup_token?: string) => {
    const res = await post("/signup/email/verify", { email, otp: app.mail.lastCode(email), signup_token });
    expect(res.statusCode).toBe(200);
    return res.json();
  };
  const verifyPhoneSms = async (phone: string, signup_token?: string) => {
    const firebase_id_token = await firebaseIdToken({ provider: "phone", phoneNumber: phone });
    return post("/signup/phone", { firebase_id_token, signup_token });
  };
  const complete = (signup_token: string, password = PASSWORD) =>
    post("/signup/complete", { signup_token, display_name: "Asha Rao", password });

  beforeEach(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildTestApp(repo);
  });
  afterEach(() => app.close());

  it("publishes the sign-in options", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/public/config" });
    expect(res.json()).toEqual({ mobile_verification_required: true, phone_number_verification: "pnv_or_sms" });
  });

  describe("Continue with Email", () => {
    it("existing email → password step, no code sent", async () => {
      const res = await post("/identify", { email: "Consumer@ClarityFi.app", ...TS });
      expect(res.json()).toMatchObject({ exists: true, next: "password" });
      expect(app.mail.sent).toHaveLength(0);
      const login = await post("/login", { email: "consumer@clarityfi.app", password: TEST_PASSWORDS.standard, ...TS });
      expect(login.statusCode).toBe(200);
      expect(login.json().customToken).toBeTruthy();
    });

    it("new email → verify email → verify phone → name + password → signed in", async () => {
      const id = await post("/identify", { email: "asha@example.com", ...TS });
      expect(id.json()).toMatchObject({ exists: false, next: "verify_email" });

      const afterEmail = await verifyEmail("asha@example.com");
      expect(afterEmail.next).toBe("verify_phone");

      const afterPhone = await verifyPhoneSms("+919800000001", afterEmail.signup_token);
      expect(afterPhone.statusCode).toBe(200);
      expect(afterPhone.json()).toMatchObject({ next: "profile", email: "asha@example.com", phone_number: "+919800000001" });

      const done = await complete(afterPhone.json().signup_token);
      expect(done.statusCode).toBe(201);
      expect(done.json().user).toMatchObject({ email: "asha@example.com", phone_number: "+919800000001", phone_verified: true, display_name: "Asha Rao" });

      const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${done.json().customToken}` } });
      expect(me.statusCode).toBe(200);
      // Both identifiers now sign in with the password.
      expect((await post("/login", { phone_number: "+91 98000 00001", password: PASSWORD, ...TS })).statusCode).toBe(200);
      expect((await post("/identify", { phone_number: "+919800000001", ...TS })).json().next).toBe("password");
    });

    it("phone can be verified with Firebase PNV instead of the SMS code", async () => {
      await post("/identify", { email: "pnv@example.com", ...TS });
      const { signup_token } = await verifyEmail("pnv@example.com");
      const res = await post("/signup/phone", { signup_token, pnv_token: await pnvToken("+919800000002") });
      expect(res.json()).toMatchObject({ next: "profile", phone_number: "+919800000002" });
    });

    it("a wrong email code is rejected", async () => {
      await post("/identify", { email: "typo@example.com", ...TS });
      const res = await post("/signup/email/verify", { email: "typo@example.com", otp: "000000" === app.mail.lastCode("typo@example.com") ? "111111" : "000000" });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("Continue with Phone", () => {
    it("existing phone → password step", async () => {
      expect((await post("/identify", { phone_number: "+919876543210", ...TS })).json()).toMatchObject({ exists: true, next: "password" });
      expect((await post("/login", { phone_number: "+919876543210", password: TEST_PASSWORDS.standard, ...TS })).statusCode).toBe(200);
    });

    it("new phone → verify phone → verify email → name + password", async () => {
      expect((await post("/identify", { phone_number: "+919800000003", ...TS })).json()).toMatchObject({ exists: false, next: "verify_phone" });

      const afterPhone = (await verifyPhoneSms("+919800000003")).json();
      expect(afterPhone.next).toBe("verify_email");

      const send = await post("/signup/email/send", { signup_token: afterPhone.signup_token, email: "ravi@example.com" });
      expect(send.statusCode).toBe(200);
      const afterEmail = await verifyEmail("ravi@example.com", afterPhone.signup_token);
      expect(afterEmail).toMatchObject({ next: "profile", phone_number: "+919800000003", email: "ravi@example.com" });

      expect((await complete(afterEmail.signup_token)).statusCode).toBe(201);
    });

    it("rejects numbers that are not in international format", async () => {
      expect((await post("/identify", { phone_number: "9876543210", ...TS })).statusCode).toBe(400);
    });

    it("an email that already has an account cannot be attached", async () => {
      const { signup_token } = (await verifyPhoneSms("+919800000004")).json();
      const res = await post("/signup/email/send", { signup_token, email: "consumer@clarityfi.app" });
      expect(res.statusCode).toBe(409);
    });
  });

  describe("Continue with Google", () => {
    it("existing account (same verified email) → signed in without a password, and linked", async () => {
      const id_token = await firebaseIdToken({ uid: "g_consumer", email: "consumer@clarityfi.app" });
      const res = await post("/google", { id_token, ...TS });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ next: "done", user: { email: "consumer@clarityfi.app" } });
      expect((await repo.getGlobalUserByEmail("consumer@clarityfi.app"))!.firebase_uid).toBe("g_consumer");
    });

    it("new Google user → verify phone → name + password", async () => {
      const id_token = await firebaseIdToken({ uid: "g_new", email: "new.google@gmail.com", name: "Neha" });
      const start = (await post("/google", { id_token, ...TS })).json();
      expect(start).toMatchObject({ next: "verify_phone", email: "new.google@gmail.com", suggested_name: "Neha" });

      const afterPhone = (await verifyPhoneSms("+919800000005", start.signup_token)).json();
      expect(afterPhone.next).toBe("profile");
      expect((await complete(afterPhone.signup_token)).statusCode).toBe(201);

      // Next time: straight in, matched by the Firebase UID.
      const again = await post("/google", { id_token: await firebaseIdToken({ uid: "g_new", email: "new.google@gmail.com" }), ...TS });
      expect(again.json().next).toBe("done");
    });

    it("requires a Google sign-in with a verified email", async () => {
      for (const id_token of [
        await firebaseIdToken({ provider: "phone", phoneNumber: "+919800000006" }),
        await firebaseIdToken({ email: "unverified@gmail.com", emailVerified: false }),
      ]) {
        expect((await post("/google", { id_token, ...TS })).statusCode).toBe(400);
      }
    });
  });

  describe("MOBILE_OTP_VERIFICATION", () => {
    it("true: the account cannot be created before the phone is verified", async () => {
      await post("/identify", { email: "skip@example.com", ...TS });
      const { signup_token } = await verifyEmail("skip@example.com");
      const res = await complete(signup_token);
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("AUTH_SIGNUP_INCOMPLETE");
    });

    it("true: a typed-in number without PNV/SMS is refused", async () => {
      const res = await post("/signup/phone", { phone_number: "+919800000010" });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("AUTH_PHONE_VERIFICATION_REQUIRED");
    });

    describe("false: the mobile number is still asked for, but not verified", () => {
      beforeEach(async () => {
        await app.close();
        app = await buildTestApp(repo, undefined, { mobileVerificationRequired: false });
      });

      it("email sign-up → number typed in → name + password; stored unverified", async () => {
        await post("/identify", { email: "nophone@example.com", ...TS });
        const afterEmail = await verifyEmail("nophone@example.com");
        expect(afterEmail.next).toBe("verify_phone"); // the number is always asked for
        expect((await complete(afterEmail.signup_token)).json().code).toBe("AUTH_SIGNUP_INCOMPLETE");

        const afterPhone = await post("/signup/phone", { phone_number: "+91 98000 00011", signup_token: afterEmail.signup_token });
        expect(afterPhone.json()).toMatchObject({ next: "profile", phone_number: "+919800000011" });
        const done = await complete(afterPhone.json().signup_token);
        expect(done.statusCode).toBe(201);
        expect(done.json().user).toMatchObject({ phone_number: "+919800000011", phone_verified: false });
      });

      it("phone-first sign-up works without the SMS code", async () => {
        const afterPhone = (await post("/signup/phone", { phone_number: "+919800000012" })).json();
        expect(afterPhone.next).toBe("verify_email");
        await post("/signup/email/send", { signup_token: afterPhone.signup_token, email: "phonefirst@example.com" });
        const afterEmail = await verifyEmail("phonefirst@example.com", afterPhone.signup_token);
        expect((await complete(afterEmail.signup_token)).statusCode).toBe(201);
        expect((await post("/login", { phone_number: "+919800000012", password: PASSWORD, ...TS })).statusCode).toBe(200);
      });

      it("a typed-in number cannot take one that is already used; a verified one takes it over", async () => {
        const typed = (await post("/signup/phone", { phone_number: "+919800000013" })).json();
        await post("/signup/email/send", { signup_token: typed.signup_token, email: "squatter@example.com" });
        expect((await complete((await verifyEmail("squatter@example.com", typed.signup_token)).signup_token)).statusCode).toBe(201);

        expect((await post("/signup/phone", { phone_number: "+919800000013" })).statusCode).toBe(409);

        // The real owner proves the number by SMS: it moves to their new account.
        const owner = await verifyPhoneSms("+919800000013");
        expect(owner.statusCode).toBe(200);
        await post("/signup/email/send", { signup_token: owner.json().signup_token, email: "owner@example.com" });
        const done = await complete((await verifyEmail("owner@example.com", owner.json().signup_token)).signup_token);
        expect(done.json().user).toMatchObject({ phone_number: "+919800000013", phone_verified: true });
        expect((await repo.getGlobalUserByEmail("squatter@example.com"))!.phone_number).toBeNull();
      });
    });
  });

  describe("Security", () => {
    it("rejects Firebase tokens with a bad signature, issuer, audience or age", async () => {
      const good = await firebaseIdToken({ email: "x@gmail.com" });
      const forged = good.slice(0, -4) + (good.endsWith("AAAA") ? "BBBB" : "AAAA");
      for (const id_token of [
        forged,
        await firebaseIdToken({ email: "x@gmail.com", issuer: "https://evil.test" }),
        await firebaseIdToken({ email: "x@gmail.com", audience: "other-project" }),
        await firebaseIdToken({ email: "x@gmail.com", issuedAt: Math.floor(Date.now() / 1000) - 600 }),
        testTokens().signJwt({ uid: "x", email: "x@gmail.com" }), // a Zolexora session token is not a Firebase token
        "not-a-jwt",
      ]) {
        const res = await post("/google", { id_token, ...TS });
        expect(res.statusCode).toBe(401);
        expect(res.json().code).toBe("AUTH_FIREBASE_TOKEN_INVALID");
      }
    });

    it("a phone number that already has an account cannot be reused", async () => {
      const res = await verifyPhoneSms("+919876543210");
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe("AUTH_PHONE_IN_USE");
    });

    it("sign-up tokens and session tokens are not interchangeable", async () => {
      const { signup_token } = (await verifyPhoneSms("+919800000007")).json();
      const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${signup_token}` } });
      expect(me.statusCode).toBe(401);
      const session = testTokens().signJwt({ uid: "u1", email: "u1@example.com" });
      expect((await complete(session)).statusCode).toBe(401);
      expect((await complete(signup_token.slice(0, -2) + "xx")).statusCode).toBe(401);
    });

    it("PNV tokens are refused when PNV is not configured", async () => {
      await app.close();
      app = await buildTestApp(repo, undefined, { firebase: testFirebase(false) });
      const res = await post("/signup/phone", { pnv_token: await pnvToken("+919800000008") });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("AUTH_PNV_UNAVAILABLE");
    });

    it("password policy: 12 to 1024 bytes", async () => {
      const ticket = async (n: number) => {
        await post("/identify", { email: `len${n}@example.com`, ...TS });
        const { signup_token } = await verifyEmail(`len${n}@example.com`);
        return (await verifyPhoneSms(`+9198000001${String(n).padStart(2, "0").slice(-2)}`, signup_token)).json().signup_token;
      };
      expect((await complete(await ticket(11), "A".repeat(11))).json().code).toBe("AUTH_PASSWORD_POLICY_VIOLATION");
      expect((await complete(await ticket(12), "A".repeat(12))).statusCode).toBe(201);
      expect((await complete(await ticket(24), "A".repeat(1024))).statusCode).toBe(201);
      expect((await complete(await ticket(25), "A".repeat(1025))).json().code).toBe("AUTH_PASSWORD_POLICY_VIOLATION");
    });

    it("Continue with Email / Google / Login require Turnstile", async () => {
      for (const [url, body] of [["/identify", { email: "a@example.com" }], ["/google", { id_token: "x" }], ["/login", { email: "a@example.com", password: "x" }]] as const) {
        expect((await post(url, body)).json().code).toBe("AUTH_TURNSTILE_REQUIRED");
      }
    });
  });
});
