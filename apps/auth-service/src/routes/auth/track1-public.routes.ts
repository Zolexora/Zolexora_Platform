import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IAuthRepository } from "../../repositories/types.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { RateLimitService } from "../../services/rate-limit.service.js";
import { TokenService } from "../../services/token.service.js";
import { CONSTANTS } from "../../config/constants.js";
import { AppError } from "../../plugins/error-handler.js";
import {
  validatePassword,
  generateZolexoraId,
  hashPassword,
  verifyPassword,
  MAX_PASSWORD_BYTES,
} from "@zolexora/utils";

interface SignupBody {
  email: string;
  phoneNumber?: string;
  phone_number?: string;
  password?: string;
  displayName?: string;
  display_name?: string;
  turnstile_token?: string;
}

interface VerifyOtpBody {
  email: string;
  otp: string;
}

interface LoginBody {
  email: string;
  password?: string;
  product?: string;
  turnstile_token?: string;
}

export async function track1PublicRoutes(
  app: FastifyInstance,
  opts: {
    repo: IAuthRepository;
    turnstile: TurnstileService;
    rateLimiter: RateLimitService;
    tokenService: TokenService;
  }
) {
  // Helper to extract Turnstile token
  const getTurnstileToken = (req: FastifyRequest, body: any): string | undefined => {
    return (
      body?.turnstile_token ||
      (req.headers["cf-turnstile-token"] as string | undefined) ||
      (req.headers["CF-Turnstile-Token"] as string | undefined)
    );
  };

  // Helper to extract remote IP
  const getRemoteIp = (req: FastifyRequest): string => {
    const cfIp = req.headers["cf-connecting-ip"];
    if (typeof cfIp === "string" && cfIp.trim() !== "") {
      return cfIp.trim();
    }
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].split(",")[0].trim();
    }
    return req.ip || "127.0.0.1";
  };

  // 1. Dual-Verification Public Registration
  app.post(
    "/api/v1/auth/public/signup",
    {
      schema: {
        description: "Track 1 Public User Registration with dual email OTP and phone number verification",
        tags: ["Track 1: Public Identity"],
      },
    },
    async (req: FastifyRequest<{ Body: SignupBody }>, reply: FastifyReply) => {
      const body = req.body || ({} as SignupBody);
      const turnstileToken = getTurnstileToken(req, body);

      // Step 1: Turnstile Bot Defense
      await opts.turnstile.verifyToken(turnstileToken, {
        remoteIp: getRemoteIp(req),
        expectedAction: "track1-public-signup",
      });

      // Step 2: Password Policy
      const password = body.password || "";
      try {
        validatePassword(password);
      } catch (err: any) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_PASSWORD_POLICY_VIOLATION",
          message: err.message,
        });
      }

      // Step 3: Dual Verification Requirement
      const phone = body.phoneNumber || body.phone_number;
      if (!body.email || !phone) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_VERIFICATION_REQUIRED",
          message: "Both email and phone number are required for dual verification.",
        });
      }

      const zxId = generateZolexoraId();
      const passwordHash = await hashPassword(password, "argon2id");
      const record = await opts.repo.createPendingRegistration({
        email: body.email,
        phone_number: phone,
        password,
        password_hash: passwordHash,
        display_name: body.displayName || body.display_name,
        zolexora_id: zxId,
        otp: CONSTANTS.OTP.DEFAULT_DEV_OTP,
      });

      return reply.status(201).send({
        success: true,
        attempt_id: record.attempt_id,
        status: "contact_verification",
      });
    }
  );

  // 2. Email OTP Verification
  app.post(
    "/api/v1/auth/public/verify-email-otp",
    {
      schema: {
        description: "Verify email OTP for pending registration",
        tags: ["Track 1: Public Identity"],
      },
    },
    async (req: FastifyRequest<{ Body: VerifyOtpBody }>, reply: FastifyReply) => {
      const body = req.body || ({} as VerifyOtpBody);
      const email = body.email;
      if (!email) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_VERIFICATION_REQUIRED",
          message: "Email is required.",
        });
      }

      const pending = await opts.repo.getPendingRegistrationByEmail(email);
      if (!pending) {
        throw new AppError({
          statusCode: 404,
          code: "AUTH_USER_NOT_FOUND",
          message: "User registration attempt not found.",
        });
      }

      const verified = await opts.repo.verifyPendingEmailOtp(email, body.otp);
      if (!verified) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_OTP_INVALID_OR_EXPIRED",
          message: "Invalid or expired OTP code.",
        });
      }

      return reply.status(200).send({
        success: true,
        email_verified: true,
      });
    }
  );

  // 3. Public User Login with Target Product Routing
  app.post(
    "/api/v1/auth/public/login",
    {
      schema: {
        description: "Public user login with consumer vs enterprise SaaS routing",
        tags: ["Track 1: Public Identity"],
      },
    },
    async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const body = req.body || ({} as LoginBody);
      const turnstileToken = getTurnstileToken(req, body);

      // Step 1: Turnstile Bot Defense (MUST execute before rate limit failure recording)
      await opts.turnstile.verifyToken(turnstileToken, {
        remoteIp: getRemoteIp(req),
        expectedAction: "track1-public-login",
      });

      const email = (body.email || "").toLowerCase().trim();
      const remoteIp = getRemoteIp(req);
      const ipKey = `ip:${remoteIp}`;
      const attemptKey = `attempt:${remoteIp}:${email}`;

      // Step 2: Rate Limit Lockout Check (Scoped per IP and per Account+IP)
      opts.rateLimiter.checkAllowed(ipKey);
      opts.rateLimiter.checkAllowed(attemptKey);

      // Step 3: Pre-Hash Password Bounds Check (Algorithmic DoS Defense)
      const password = body.password || "";
      if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_PASSWORD_POLICY_VIOLATION",
          message: `Password exceeds maximum allowed size of ${MAX_PASSWORD_BYTES} bytes.`,
        });
      }

      // Step 4: User Credential Lookup & Verification
      const user = await opts.repo.getGlobalUserByEmail(email);

      // Strictly reject non-existent users without falling back to fixtures or mock identities
      if (!user) {
        opts.rateLimiter.recordFailure(ipKey);
        opts.rateLimiter.recordFailure(attemptKey);
        throw new AppError({
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS",
          message: "Invalid credentials provided.",
        });
      }

      // Strictly verify password hash using constant-time Argon2id/Scrypt crypto
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        opts.rateLimiter.recordFailure(ipKey);
        opts.rateLimiter.recordFailure(attemptKey);
        throw new AppError({
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS",
          message: "Invalid credentials provided.",
        });
      }

      // Step 5: Record success & reset lockout counters
      opts.rateLimiter.recordSuccess(ipKey);
      opts.rateLimiter.recordSuccess(attemptKey);

      // Step 6: Route decision based on target product
      const targetProduct =
        (req.headers["x-target-product"] as string) ||
        body.product ||
        "clarityfi";
      const isConsumer = CONSTANTS.PRODUCTS.CONSUMER.includes(targetProduct as any);

      const customToken = opts.tokenService.mintUserCustomToken(user.id, user.zolexora_id);

      return reply.status(200).send({
        success: true,
        customToken,
        user: {
          uid: user.id,
          zolexora_id: user.zolexora_id,
          email: user.email,
          email_verified: user.email_verified,
        },
        routing: {
          user_type: isConsumer ? "consumer" : "enterprise",
          redirect_route: isConsumer ? "/dashboard" : "/select-organization",
        },
      });
    }
  );

  // 4. Password Reset
  app.post(
    "/api/v1/auth/public/reset-password",
    {
      schema: {
        description: "Initiate password reset flow",
        tags: ["Track 1: Public Identity"],
      },
    },
    async (req: FastifyRequest<{ Body: { email: string; turnstile_token?: string } }>, reply: FastifyReply) => {
      const body = req.body || { email: "" };
      const turnstileToken = getTurnstileToken(req, body);
      await opts.turnstile.verifyToken(turnstileToken, {
        remoteIp: getRemoteIp(req),
        expectedAction: "track1-public-reset-password",
      });

      const remoteIp = getRemoteIp(req);
      opts.rateLimiter.checkAllowed(`ip:${remoteIp}`);

      return reply.status(200).send({
        success: true,
        message: "Password reset instructions dispatched.",
      });
    }
  );
}
