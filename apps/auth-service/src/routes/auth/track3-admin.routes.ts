import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IAuthRepository } from "../../repositories/types.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { RateLimitService } from "../../services/rate-limit.service.js";
import { TokenService } from "../../services/token.service.js";
import { AppError } from "../../plugins/error-handler.js";
import { verifyPassword, MAX_PASSWORD_BYTES } from "@zolexora/utils";

interface AdminLoginBody {
  username_or_email?: string;
  email?: string;
  username?: string;
  password?: string;
  org_id?: string;
  turnstile_token?: string;
}

export async function track3AdminRoutes(
  app: FastifyInstance,
  opts: {
    repo: IAuthRepository;
    turnstile: TurnstileService;
    rateLimiter: RateLimitService;
    tokenService: TokenService;
  }
) {
  const getTurnstileToken = (req: FastifyRequest, body: any): string | undefined => {
    return (
      body?.turnstile_token ||
      (req.headers["cf-turnstile-token"] as string | undefined) ||
      (req.headers["CF-Turnstile-Token"] as string | undefined)
    );
  };

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

  // 1. Platform Admin Login
  app.post(
    "/api/v1/auth/admin/login",
    {
      schema: {
        description: "Platform Admin internal login with superadmin RBAC claims and zero org_id requirement",
        tags: ["Track 3: Platform Admin"],
      },
    },
    async (req: FastifyRequest<{ Body: AdminLoginBody }>, reply: FastifyReply) => {
      const body = req.body || ({} as AdminLoginBody);
      const turnstileToken = getTurnstileToken(req, body);

      // Step 1: Turnstile Bot Defense
      await opts.turnstile.verifyToken(turnstileToken, {
        remoteIp: getRemoteIp(req),
        expectedAction: "track3-admin-login",
      });

      const identifier = (body.username_or_email || body.email || body.username || "")
        .toLowerCase()
        .trim();
      const remoteIp = getRemoteIp(req);
      const ipKey = `ip:${remoteIp}`;
      const attemptKey = `attempt:${remoteIp}:admin:${identifier}`;

      // Step 2: Rate Limit Check (Scoped per IP and per Account+IP)
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

      // Step 4: Admin User Lookup & Verification
      const admin = await opts.repo.getAdminByIdentifier(identifier);

      if (!admin) {
        opts.rateLimiter.recordFailure(ipKey);
        opts.rateLimiter.recordFailure(attemptKey);
        throw new AppError({
          statusCode: 401,
          code: "AUTH_INVALID_ADMIN_CREDENTIALS",
          message: "Invalid admin credentials",
        });
      }

      // Strictly verify password hash using constant-time Argon2id/Scrypt crypto
      const isValid = await verifyPassword(password, admin.password_hash);
      if (!isValid) {
        opts.rateLimiter.recordFailure(ipKey);
        opts.rateLimiter.recordFailure(attemptKey);
        throw new AppError({
          statusCode: 401,
          code: "AUTH_INVALID_ADMIN_CREDENTIALS",
          message: "Invalid admin credentials",
        });
      }

      // Step 4: Active Check
      if (admin.status !== "active") {
        throw new AppError({
          statusCode: 403,
          code: "AUTH_ADMIN_ACCESS_DENIED",
          message: "Admin account suspended",
        });
      }

      // Step 5: Success & Reset Lockout
      opts.rateLimiter.recordSuccess(ipKey);
      opts.rateLimiter.recordSuccess(attemptKey);

      const customToken = opts.tokenService.mintAdminCustomToken(
        admin.id,
        {
          zolexora_id: admin.zolexora_id,
          role: "superadmin",
          permissions: admin.permissions || ["*"],
          is_platform_admin: true,
        },
        admin.email
      );

      return reply.status(200).send({
        success: true,
        customToken,
        admin: {
          id: admin.id,
          zolexora_id: admin.zolexora_id,
          email: admin.email,
          role: "superadmin",
          is_platform_admin: true,
          permissions: ["*"],
        },
      });
    }
  );

  // 2. Public Admin Registration Strictly Forbidden
  app.all(
    "/api/v1/auth/admin/signup",
    {
      schema: {
        description: "Public registration forbidden for platform admin tier",
        tags: ["Track 3: Platform Admin"],
      },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      reply.status(403).send({
        success: false,
        code: "AUTH_ADMIN_SIGNUP_FORBIDDEN",
        message: "Platform Admin accounts cannot be created publicly.",
        error: {
          code: "AUTH_ADMIN_SIGNUP_FORBIDDEN",
          message: "Platform Admin accounts cannot be created publicly.",
          details: {},
        },
      });
    }
  );
}
