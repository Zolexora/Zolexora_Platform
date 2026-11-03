import { FastifyInstance } from "fastify";
import { IAuthRepository, RevocationType } from "../../repositories/types.js";
import { TokenService } from "../../services/token.service.js";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { forbidden } from "./request.js";
import { AppError } from "../../plugins/error-handler.js";

interface RevokeTokenBody {
  uid?: string;
  reason?: string;
  revocation_type?: RevocationType;
}

export async function sessionRoutes(app: FastifyInstance, opts: { repo: IAuthRepository; tokenService: TokenService }) {
  const authenticate = createAuthMiddleware({ tokenService: opts.tokenService, repo: opts.repo });

  // single_token revokes the caller's current token (logout).
  // user_all_tokens revokes every session of `uid` (default: the caller); other users require a platform admin.
  app.post<{ Body: RevokeTokenBody }>(
    "/api/v1/auth/tokens/revoke",
    {
      preHandler: [authenticate],
      schema: { description: "Log out the current token, or invalidate all sessions of a user", tags: ["Session & Tokens"] },
    },
    async (req, reply) => {
      const body = req.body ?? {};
      const caller = req.user!;
      const type: RevocationType = body.revocation_type === "single_token" ? "single_token" : "user_all_tokens";

      let target: string;
      if (type === "single_token") {
        target = req.tokenPayload!.jti;
      } else {
        target = body.uid || caller.uid;
        if (target !== caller.uid && !caller.is_platform_admin) {
          throw forbidden("Only platform admins can revoke other users' sessions.");
        }
      }

      const result = await opts.repo.revokeToken(target, type, body.reason || "Session revocation", caller.uid);
      return reply.status(200).send({
        success: true,
        uid: type === "single_token" ? caller.uid : target,
        revocation_type: type,
        revoked_at: new Date(result.revoked_at).toISOString(),
      });
    },
  );

  app.get(
    "/api/v1/auth/me",
    { preHandler: [authenticate], schema: { description: "Introspect the active bearer token", tags: ["Session & Tokens"] } },
    async (req, reply) => {
      // Public users: products also need the profile (name, phone) the auth service owns.
      if (req.tokenPayload?.type !== "user" || !req.user?.email) {
        return reply.status(200).send({ user: req.user, authenticated: true });
      }
      const record = await opts.repo.getGlobalUserByEmail(req.user.email);
      if (!record || record.id !== req.user.uid || record.status !== "active") {
        throw new AppError({ statusCode: 401, code: "AUTH_UNAUTHORIZED", message: "Account is not active." });
      }
      return reply.status(200).send({
        user: {
          ...req.user,
          display_name: record.display_name ?? null,
          email_verified: record.email_verified,
          phone_number: record.phone_number ?? null,
          phone_verified: record.phone_verified,
        },
        authenticated: true,
      });
    },
  );
}
