import { randomUUID } from "node:crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import { generateZolexoraId, verifyPassword } from "@zolexora/utils";
import { IAuthRepository } from "../../repositories/types.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { RateLimitService } from "../../services/rate-limit.service.js";
import { TokenService } from "../../services/token.service.js";
import { OtpService } from "../../services/otp.service.js";
import { MailService } from "../../services/mail.service.js";
import { CONSTANTS } from "../../config/constants.js";
import { AppError } from "../../plugins/error-handler.js";
import { assertPasswordSize, getRemoteIp, getTurnstileToken, hashNewPassword } from "./request.js";

interface SignupBody {
  email?: string;
  phoneNumber?: string;
  phone_number?: string;
  password?: string;
  displayName?: string;
  display_name?: string;
  turnstile_token?: string;
}

const normEmail = (email: unknown) => (typeof email === "string" ? email.toLowerCase().trim() : "");
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
  },
) {
  const turnstile = (req: FastifyRequest, action: string) =>
    opts.turnstile.verifyToken(getTurnstileToken(req), { remoteIp: getRemoteIp(req), expectedAction: action });

  /** Throttles code issuance per email (anti email-bombing) using the shared limiter. */
  const throttleOtp = (email: string) => {
    opts.rateLimiter.checkAllowed(`otp:${email}`);
    opts.rateLimiter.recordFailure(`otp:${email}`);
  };

  // 1. Registration: stores the pending account with a one-time code and emails it.
  app.post<{ Body: SignupBody }>(
    "/api/v1/auth/public/signup",
    { schema: { description: "Track 1 registration; emails a one-time verification code", tags: ["Track 1: Public Identity"] } },
    async (req, reply) => {
      const body = req.body ?? {};
      await turnstile(req, "track1-public-signup");
      const passwordHash = await hashNewPassword(body.password);

      const email = normEmail(body.email);
      const phone = body.phoneNumber || body.phone_number;
      if (!email || !phone) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_VERIFICATION_REQUIRED",
          message: "Both email and phone number are required for dual verification.",
        });
      }
      throttleOtp(email);

      // Same response whether or not the email is registered (no account enumeration).
      if (!(await opts.repo.getGlobalUserByEmail(email))) {
        const code = await opts.otp.issue(email, "signup", {
          phone_number: phone,
          display_name: body.displayName || body.display_name,
          password_hash: passwordHash,
          zolexora_id: generateZolexoraId(),
        });
        await opts.mail.sendOtp(email, code, "signup", opts.otp.ttlSeconds);
      }
      return reply.status(201).send({ success: true, attempt_id: randomUUID(), status: "contact_verification" });
    },
  );

  // 2. Email OTP verification creates the account. Existing accounts are never overwritten.
  app.post<{ Body: { email?: string; otp?: string } }>(
    "/api/v1/auth/public/verify-email-otp",
    { schema: { description: "Verify the emailed code and create the account", tags: ["Track 1: Public Identity"] } },
    async (req, reply) => {
      const email = normEmail(req.body?.email);
      if (!email) {
        throw new AppError({ statusCode: 400, code: "AUTH_VERIFICATION_REQUIRED", message: "Email is required." });
      }
      const pending = await opts.otp.consume(email, "signup", req.body?.otp);
      const user = await opts.repo.createGlobalUser({ email, ...pending } as any);
      if (!user) {
        throw new AppError({ statusCode: 409, code: "AUTH_USER_EXISTS", message: "Account already exists." });
      }
      return reply.status(200).send({ success: true, email_verified: true });
    },
  );

  // 3. Login with target product routing.
  app.post<{ Body: { email?: string; password?: string; product?: string; turnstile_token?: string } }>(
    "/api/v1/auth/public/login",
    { schema: { description: "Public user login with consumer vs enterprise SaaS routing", tags: ["Track 1: Public Identity"] } },
    async (req, reply) => {
      const body = req.body ?? {};
      await turnstile(req, "track1-public-login");

      const email = normEmail(body.email);
      const ip = getRemoteIp(req);
      const keys = [`ip:${ip}`, `attempt:${ip}:${email}`];
      keys.forEach((k) => opts.rateLimiter.checkAllowed(k));

      const password = body.password ?? "";
      assertPasswordSize(password);

      const user = await opts.repo.getGlobalUserByEmail(email);
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        keys.forEach((k) => opts.rateLimiter.recordFailure(k));
        throw invalidCredentials();
      }
      keys.forEach((k) => opts.rateLimiter.recordSuccess(k));
      if (user.status !== "active") {
        throw new AppError({ statusCode: 403, code: "AUTH_ACCOUNT_DISABLED", message: "Account is not active." });
      }

      const targetProduct = (req.headers["x-target-product"] as string) || body.product || "clarityfi";
      const isConsumer = (CONSTANTS.PRODUCTS.CONSUMER as readonly string[]).includes(targetProduct);

      return reply.status(200).send({
        success: true,
        customToken: opts.tokenService.mintUserCustomToken(user.id, user.zolexora_id, user.email),
        user: { uid: user.id, zolexora_id: user.zolexora_id, email: user.email, email_verified: user.email_verified },
        routing: {
          user_type: isConsumer ? "consumer" : "enterprise",
          redirect_route: isConsumer ? "/dashboard" : "/select-organization",
        },
      });
    },
  );

  // 4. Password reset request: emails a one-time code when the account exists.
  app.post<{ Body: { email?: string; turnstile_token?: string } }>(
    "/api/v1/auth/public/reset-password",
    { schema: { description: "Email a password reset code", tags: ["Track 1: Public Identity"] } },
    async (req, reply) => {
      await turnstile(req, "track1-public-reset-password");
      opts.rateLimiter.checkAllowed(`ip:${getRemoteIp(req)}`);

      const email = normEmail(req.body?.email);
      if (email) {
        throttleOtp(email);
        const user = await opts.repo.getGlobalUserByEmail(email);
        if (user?.status === "active") {
          await opts.mail.sendOtp(email, await opts.otp.issue(email, "reset"), "reset", opts.otp.ttlSeconds);
        }
      }
      return reply.status(200).send({
        success: true,
        message: "If the account exists, a reset code has been sent.",
      });
    },
  );

  // 5. Password reset confirmation: sets the new password and revokes every existing session.
  app.post<{ Body: { email?: string; otp?: string; new_password?: string } }>(
    "/api/v1/auth/public/reset-password/confirm",
    { schema: { description: "Confirm a password reset with the emailed code", tags: ["Track 1: Public Identity"] } },
    async (req, reply) => {
      opts.rateLimiter.checkAllowed(`ip:${getRemoteIp(req)}`);
      const email = normEmail(req.body?.email);
      const passwordHash = await hashNewPassword(req.body?.new_password);
      await opts.otp.consume(email, "reset", req.body?.otp);

      const user = await opts.repo.updateGlobalUserPassword(email, passwordHash);
      if (!user) throw invalidCredentials();
      await opts.repo.revokeToken(user.id, "user_all_tokens", "Password reset", user.id);
      return reply.status(200).send({ success: true });
    },
  );
}
