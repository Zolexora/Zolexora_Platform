import { FastifyInstance, FastifyRequest } from "fastify";
import { generateZolexoraId, verifyPassword } from "@zolexora/utils";
import { GlobalUserRecord, IAuthRepository } from "../../repositories/types.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { RateLimitService } from "../../services/rate-limit.service.js";
import { TokenService } from "../../services/token.service.js";
import { OtpService } from "../../services/otp.service.js";
import { MailService } from "../../services/mail.service.js";
import { FirebaseService } from "../../services/firebase.service.js";
import { SignupFacts, SignupTicketService } from "../../services/signup-ticket.service.js";
import { CONSTANTS } from "../../config/constants.js";
import { AppError } from "../../plugins/error-handler.js";
import { assertPasswordSize, getRemoteIp, getTurnstileToken, hashNewPassword } from "./request.js";

/*
 * Track 1 (public users) — "Continue with Google / Email / Phone".
 *
 *   Google: POST /google ─ existing ─▶ session (no password)
 *                        └ new ──────▶ [verify phone] ▶ profile (name + password) ▶ session
 *   Email:  POST /identify ─ existing ─▶ POST /login (password)
 *                          └ new (code emailed) ▶ /signup/email/verify ▶ [verify phone] ▶ profile ▶ session
 *   Phone:  POST /identify ─ existing ─▶ POST /login (password)
 *                          └ new ▶ /signup/phone (Firebase PNV or SMS code) ▶ /signup/email/send + verify ▶ profile ▶ session
 *
 * [verify phone] is required when MOBILE_OTP_VERIFICATION=true. Each sign-up step returns a
 * `signup_token` recording what has been verified, and `next` naming the step to show.
 */

type Next = "verify_email" | "verify_phone" | "profile";

const E164 = /^\+[1-9]\d{7,14}$/;
const normEmail = (email: unknown) => (typeof email === "string" ? email.toLowerCase().trim() : "");
const normPhone = (phone: unknown) => (typeof phone === "string" ? phone.replace(/[\s\-()]/g, "") : "");
const isEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

const badRequest = (code: string, message: string) => new AppError({ statusCode: 400, code, message });
const conflict = (code: string, message: string) => new AppError({ statusCode: 409, code, message });
const invalidCredentials = () =>
  new AppError({ statusCode: 401, code: "AUTH_INVALID_CREDENTIALS", message: "Invalid credentials provided." });

export async function track1PublicRoutes(
  app: FastifyInstance,
  opts: {
    repo: IAuthRepository;
    turnstile: TurnstileService;
    rateLimiter: RateLimitService;
    tokenService: TokenService;
    otp: OtpService;
    mail: MailService;
    firebase: FirebaseService;
    tickets: SignupTicketService;
    mobileVerificationRequired: boolean;
  },
) {
  const { repo, rateLimiter, otp, mail, firebase, tickets } = opts;
  const tags = ["Track 1: Public Identity"];

  const turnstile = (req: FastifyRequest, action: string) =>
    opts.turnstile.verifyToken(getTurnstileToken(req), { remoteIp: getRemoteIp(req), expectedAction: action });
  const limitIp = (req: FastifyRequest) => rateLimiter.checkAllowed(`ip:${getRemoteIp(req)}`);

  /** Throttles code issuance per email (anti email-bombing). */
  const throttleOtp = (email: string) => {
    rateLimiter.checkAllowed(`otp:${email}`);
    rateLimiter.recordFailure(`otp:${email}`);
  };

  const sendSignupCode = async (email: string) => {
    throttleOtp(email);
    await mail.sendOtp(email, await otp.issue(email, "signup"), "signup", otp.ttlSeconds);
  };

  const nextStep = (f: SignupFacts): Next => {
    if (!f.email) return "verify_email";
    if (!f.phone_number && (opts.mobileVerificationRequired || f.started_with === "phone")) return "verify_phone";
    return "profile";
  };

  const step = async (facts: SignupFacts) => ({
    success: true,
    next: nextStep(facts),
    signup_token: await tickets.issue(facts),
    email: facts.email ?? null,
    phone_number: facts.phone_number ?? null,
  });

  const optionalTicket = (token: unknown) => (token === undefined || token === null || token === "" ? null : tickets.read(token));

  const session = (req: FastifyRequest, user: GlobalUserRecord, product?: string) => {
    if (user.status !== "active") {
      throw new AppError({ statusCode: 403, code: "AUTH_ACCOUNT_DISABLED", message: "Account is not active." });
    }
    const targetProduct = (req.headers["x-target-product"] as string) || product || "clarityfi";
    const isConsumer = (CONSTANTS.PRODUCTS.CONSUMER as readonly string[]).includes(targetProduct);
    return {
      success: true,
      next: "done" as const,
      customToken: opts.tokenService.mintUserCustomToken(user.id, user.zolexora_id, user.email),
      user: {
        uid: user.id,
        zolexora_id: user.zolexora_id,
        email: user.email,
        email_verified: user.email_verified,
        phone_number: user.phone_number ?? null,
        phone_verified: user.phone_verified,
        display_name: user.display_name ?? null,
      },
      routing: {
        user_type: isConsumer ? "consumer" : "enterprise",
        redirect_route: isConsumer ? "/dashboard" : "/select-organization",
      },
    };
  };

  // Tells the client which screens to show; used by the sign-in UI before the first step.
  app.get("/api/v1/auth/public/config", { schema: { description: "Track 1 sign-in options", tags } }, async () => ({
    mobile_verification_required: opts.mobileVerificationRequired,
    phone_number_verification: firebase.pnvEnabled ? "pnv_or_sms" : "sms",
  }));

  // 1. Continue with Email / Phone: existing → password, new → start verification.
  app.post<{ Body: { email?: string; phone_number?: string; turnstile_token?: string } }>(
    "/api/v1/auth/public/identify",
    { schema: { description: "Continue with email or phone: says whether to ask for a password or start sign-up", tags } },
    async (req) => {
      await turnstile(req, "track1-public-identify");
      limitIp(req);
      const body = req.body ?? {};

      if (body.email !== undefined) {
        const email = normEmail(body.email);
        if (!isEmail(email)) throw badRequest("AUTH_INVALID_EMAIL", "Enter a valid email address.");
        if (await repo.getGlobalUserByEmail(email)) return { success: true, exists: true, next: "password" };
        await sendSignupCode(email);
        return { success: true, exists: false, next: "verify_email" };
      }

      const phone = normPhone(body.phone_number);
      if (!E164.test(phone)) throw badRequest("AUTH_INVALID_PHONE", "Enter the phone number in international format, e.g. +919876543210.");
      if (await repo.getGlobalUserByPhone(phone)) return { success: true, exists: true, next: "password" };
      return { success: true, exists: false, next: "verify_phone" };
    },
  );

  // 2. Continue with Google: existing → session without password, new → sign-up steps.
  app.post<{ Body: { id_token?: string; product?: string; turnstile_token?: string } }>(
    "/api/v1/auth/public/google",
    { schema: { description: "Exchange a Firebase Google sign-in ID token", tags } },
    async (req) => {
      await turnstile(req, "track1-public-google");
      limitIp(req);
      const identity = await firebase.verifyIdToken(req.body?.id_token);
      if (identity.provider !== "google.com" || !identity.email || !identity.emailVerified) {
        throw badRequest("AUTH_GOOGLE_TOKEN_REQUIRED", "A Google sign-in with a verified email is required.");
      }

      const user = (await repo.getGlobalUserByFirebaseUid(identity.uid)) ?? (await repo.getGlobalUserByEmail(identity.email));
      if (user) {
        if (!user.firebase_uid) await repo.linkFirebaseUid(user.id, identity.uid);
        return session(req, user, req.body?.product);
      }
      return { ...(await step({ started_with: "google", email: identity.email, firebase_uid: identity.uid })), suggested_name: identity.name ?? null };
    },
  );

  // 3a. Phone-first sign-up: email the verification code once the phone is verified.
  app.post<{ Body: { signup_token?: string; email?: string } }>(
    "/api/v1/auth/public/signup/email/send",
    { schema: { description: "Email a verification code during sign-up", tags } },
    async (req) => {
      limitIp(req);
      const facts = await tickets.read(req.body?.signup_token);
      if (facts.email) throw badRequest("AUTH_SIGNUP_STEP_DONE", "Email is already verified.");
      const email = normEmail(req.body?.email);
      if (!isEmail(email)) throw badRequest("AUTH_INVALID_EMAIL", "Enter a valid email address.");
      if (await repo.getGlobalUserByEmail(email)) {
        throw conflict("AUTH_EMAIL_IN_USE", "This email already has an account. Sign in with it instead.");
      }
      await sendSignupCode(email);
      return { success: true, next: "verify_email" };
    },
  );

  // 3b. Verify the emailed code. Starts the email sign-up, or adds the email to a phone sign-up.
  app.post<{ Body: { signup_token?: string; email?: string; otp?: string } }>(
    "/api/v1/auth/public/signup/email/verify",
    { schema: { description: "Verify the emailed sign-up code", tags } },
    async (req) => {
      limitIp(req);
      const prior = await optionalTicket(req.body?.signup_token);
      if (prior?.email) throw badRequest("AUTH_SIGNUP_STEP_DONE", "Email is already verified.");
      const email = normEmail(req.body?.email);
      if (!email) throw badRequest("AUTH_VERIFICATION_REQUIRED", "Email is required.");
      await otp.consume(email, "signup", req.body?.otp);
      if (await repo.getGlobalUserByEmail(email)) {
        throw conflict("AUTH_EMAIL_IN_USE", "This email already has an account. Sign in with it instead.");
      }
      return step({ ...(prior ?? { started_with: "email" as const }), email });
    },
  );

  // 4. Verify the phone with Firebase PNV, or the Firebase SMS code fallback (ID token with phone_number).
  app.post<{ Body: { signup_token?: string; pnv_token?: string; firebase_id_token?: string } }>(
    "/api/v1/auth/public/signup/phone",
    { schema: { description: "Attach a Firebase-verified phone number (PNV token or SMS-code ID token)", tags } },
    async (req) => {
      limitIp(req);
      const prior = await optionalTicket(req.body?.signup_token);
      if (prior?.phone_number) throw badRequest("AUTH_SIGNUP_STEP_DONE", "Phone number is already verified.");

      let phone: string | undefined;
      if (req.body?.pnv_token) phone = await firebase.verifyPnvToken(req.body.pnv_token);
      else phone = (await firebase.verifyIdToken(req.body?.firebase_id_token)).phoneNumber;
      if (!phone || !E164.test(phone)) throw badRequest("AUTH_PHONE_NOT_VERIFIED", "The token carries no verified phone number.");

      if (await repo.getGlobalUserByPhone(phone)) {
        throw conflict("AUTH_PHONE_IN_USE", "This phone number already has an account. Sign in with it instead.");
      }
      return step({ ...(prior ?? { started_with: "phone" as const }), phone_number: phone });
    },
  );

  // 5. Name + password: creates the account and signs in.
  app.post<{ Body: { signup_token?: string; display_name?: string; password?: string; product?: string } }>(
    "/api/v1/auth/public/signup/complete",
    { schema: { description: "Finish sign-up with name and password", tags } },
    async (req, reply) => {
      limitIp(req);
      const facts = await tickets.read(req.body?.signup_token);
      const pending = nextStep(facts);
      if (pending !== "profile") throw badRequest("AUTH_SIGNUP_INCOMPLETE", `Finish the "${pending}" step first.`);

      const displayName = typeof req.body?.display_name === "string" ? req.body.display_name.trim() : "";
      if (!displayName || displayName.length > 100) throw badRequest("AUTH_INVALID_NAME", "Enter your name (up to 100 characters).");
      const passwordHash = await hashNewPassword(req.body?.password);

      const user = await repo.createGlobalUser({
        zolexora_id: generateZolexoraId(),
        email: facts.email!,
        phone_number: facts.phone_number,
        firebase_uid: facts.firebase_uid,
        display_name: displayName,
        password_hash: passwordHash,
      });
      if (!user) throw conflict("AUTH_USER_EXISTS", "An account with this email or phone already exists. Sign in instead.");
      return reply.status(201).send(session(req, user, req.body?.product));
    },
  );

  // 6. Password sign-in for existing users (email or phone).
  app.post<{ Body: { email?: string; phone_number?: string; password?: string; product?: string; turnstile_token?: string } }>(
    "/api/v1/auth/public/login",
    { schema: { description: "Password sign-in with email or phone", tags } },
    async (req) => {
      const body = req.body ?? {};
      await turnstile(req, "track1-public-login");

      const identifier = body.phone_number !== undefined ? normPhone(body.phone_number) : normEmail(body.email);
      const ip = getRemoteIp(req);
      const keys = [`ip:${ip}`, `attempt:${ip}:${identifier}`];
      keys.forEach((k) => rateLimiter.checkAllowed(k));

      const password = body.password ?? "";
      assertPasswordSize(password);

      const user = body.phone_number !== undefined
        ? await repo.getGlobalUserByPhone(identifier)
        : await repo.getGlobalUserByEmail(identifier);
      if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
        keys.forEach((k) => rateLimiter.recordFailure(k));
        throw invalidCredentials();
      }
      keys.forEach((k) => rateLimiter.recordSuccess(k));
      return session(req, user, body.product);
    },
  );

  // 7. Password reset request: emails a one-time code when the account exists.
  app.post<{ Body: { email?: string; turnstile_token?: string } }>(
    "/api/v1/auth/public/reset-password",
    { schema: { description: "Email a password reset code", tags } },
    async (req, reply) => {
      await turnstile(req, "track1-public-reset-password");
      limitIp(req);

      const email = normEmail(req.body?.email);
      if (email) {
        throttleOtp(email);
        const user = await repo.getGlobalUserByEmail(email);
        if (user?.status === "active") {
          await mail.sendOtp(email, await otp.issue(email, "reset"), "reset", otp.ttlSeconds);
        }
      }
      return reply.status(200).send({ success: true, message: "If the account exists, a reset code has been sent." });
    },
  );

  // 8. Password reset confirmation: sets the new password and revokes every existing session.
  app.post<{ Body: { email?: string; otp?: string; new_password?: string } }>(
    "/api/v1/auth/public/reset-password/confirm",
    { schema: { description: "Confirm a password reset with the emailed code", tags } },
    async (req, reply) => {
      limitIp(req);
      const email = normEmail(req.body?.email);
      const passwordHash = await hashNewPassword(req.body?.new_password);
      await otp.consume(email, "reset", req.body?.otp);

      const user = await repo.updateGlobalUserPassword(email, passwordHash);
      if (!user) throw invalidCredentials();
      await repo.revokeToken(user.id, "user_all_tokens", "Password reset", user.id);
      return reply.status(200).send({ success: true });
    },
  );
}
