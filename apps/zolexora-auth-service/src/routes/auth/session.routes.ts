import { FastifyInstance } from "fastify";
import { IAuthRepository, RevocationType } from "../../repositories/types.js";
import { TokenService } from "../../services/token.service.js";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { forbidden } from "./request.js";

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
    async (req, reply) => reply.status(200).send({ user: req.user, authenticated: true }),
  );
}
