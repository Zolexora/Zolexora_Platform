import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IAuthRepository } from "../../repositories/types.js";
import { TokenService } from "../../services/token.service.js";
import { AppError } from "../../plugins/error-handler.js";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";

interface RevokeTokenBody {
  uid: string;
  reason?: string;
  actor_id?: string;
  revocation_type?: "user_all_tokens" | "single_token";
}

export async function sessionRoutes(
  app: FastifyInstance,
  opts: { repo: IAuthRepository; tokenService: TokenService }
) {
  const authenticate = createAuthMiddleware({ tokenService: opts.tokenService, repo: opts.repo });

  // 1. Token Revocation Endpoint
  app.post(
    "/api/v1/auth/tokens/revoke",
    {
      schema: {
        description: "Immediately invalidate sessions and refresh tokens for target UID",
        tags: ["Session & Tokens"],
      },
    },
    async (req: FastifyRequest<{ Body: RevokeTokenBody }>, reply: FastifyReply) => {
      const body = req.body || ({} as RevokeTokenBody);
      const uid = body.uid;
      if (!uid) {
        throw new AppError({
          statusCode: 400,
          code: "BAD_REQUEST",
          message: "Target UID is required for token revocation.",
        });
      }

      const result = await opts.repo.revokeToken(
        uid,
        body.reason,
        body.actor_id,
        body.revocation_type
      );

      return reply.status(200).send({
        success: true,
        uid: result.uid,
        revoked_at: new Date(result.revoked_at).toISOString(),
      });
    }
  );

  // 2. Authenticated Session Introspection Endpoint
  app.get(
    "/api/v1/auth/me",
    {
      preHandler: [authenticate],
      schema: {
        description: "Introspect active bearer token, verify signatures and revocation timestamps",
        tags: ["Session & Tokens"],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({
        user: req.user,
        authenticated: true,
      });
    }
  );
}
