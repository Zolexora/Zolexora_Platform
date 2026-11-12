import { FastifyInstance } from "fastify";
import { verifyPassword } from "@zolexora/utils";
import { IAuthRepository } from "../../repositories/types.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { RateLimitService } from "../../services/rate-limit.service.js";
import { TokenService } from "../../services/token.service.js";
import { AppError } from "../../plugins/error-handler.js";
import { assertPasswordSize, getRemoteIp, getTurnstileToken } from "./request.js";

interface AdminLoginBody {
  username_or_email?: string;
  email?: string;
  username?: string;
  password?: string;
  turnstile_token?: string;
}

export async function track3AdminRoutes(
  app: FastifyInstance,
  opts: { repo: IAuthRepository; turnstile: TurnstileService; rateLimiter: RateLimitService; tokenService: TokenService },
) {
  // 1. Platform admin login
  app.post<{ Body: AdminLoginBody }>(
    "/api/v1/auth/admin/login",
    { schema: { description: "Platform Admin internal login", tags: ["Track 3: Platform Admin"] } },
    async (req, reply) => {
      const body = req.body ?? {};
      await opts.turnstile.verifyToken(getTurnstileToken(req), {
        remoteIp: getRemoteIp(req),
        expectedAction: "track3-admin-login",
      });

      const identifier = (body.username_or_email || body.email || body.username || "").toLowerCase().trim();
      const ip = getRemoteIp(req);
      const keys = [`ip:${ip}`, `attempt:${ip}:admin:${identifier}`];
      keys.forEach((k) => opts.rateLimiter.checkAllowed(k));

      const password = body.password ?? "";
      assertPasswordSize(password);

      const admin = await opts.repo.getAdminByIdentifier(identifier);
      if (!admin || !(await verifyPassword(password, admin.password_hash))) {
        keys.forEach((k) => opts.rateLimiter.recordFailure(k));
        throw new AppError({ statusCode: 401, code: "AUTH_INVALID_ADMIN_CREDENTIALS", message: "Invalid admin credentials" });
      }
      if (admin.status !== "active" || !admin.is_platform_admin) {
        throw new AppError({ statusCode: 403, code: "AUTH_ADMIN_ACCESS_DENIED", message: "Admin account suspended" });
      }
      keys.forEach((k) => opts.rateLimiter.recordSuccess(k));

      const claims = {
        zolexora_id: admin.zolexora_id,
        role: admin.role,
        permissions: admin.permissions,
        is_platform_admin: true,
      };
      return reply.status(200).send({
        success: true,
        customToken: opts.tokenService.mintAdminCustomToken(admin.id, claims, admin.email),
        admin: { id: admin.id, email: admin.email, ...claims },
      });
    },
  );

  // 2. Public admin registration is forbidden.
  app.all(
    "/api/v1/auth/admin/signup",
    { schema: { description: "Public registration forbidden for platform admin tier", tags: ["Track 3: Platform Admin"] } },
    async () => {
      throw new AppError({
        statusCode: 403,
        code: "AUTH_ADMIN_SIGNUP_FORBIDDEN",
        message: "Platform Admin accounts cannot be created publicly.",
      });
    },
  );
}
