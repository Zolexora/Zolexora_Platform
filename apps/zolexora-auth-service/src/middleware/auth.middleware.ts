import { FastifyRequest, FastifyReply } from "fastify";
import { IAuthRepository } from "../repositories/types.js";
import { TokenService, TokenPayload } from "../services/token.service.js";
import { AppError } from "../plugins/error-handler.js";
import { CONSTANTS } from "../config/constants.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      uid: string;
      email: string;
      zolexora_id: string;
      role?: string;
      org_id?: string;
      permissions?: string[];
      is_platform_admin?: boolean;
    };
    tokenPayload?: TokenPayload;
    rawToken?: string;
  }
}

export interface AuthMiddlewareOptions {
  tokenService: TokenService;
  repo: IAuthRepository;
}

export function createAuthMiddleware(opts: AuthMiddlewareOptions) {
  return async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authHeader = req.headers.authorization || (req.headers.Authorization as string) || "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_UNAUTHORIZED",
        message: "Missing token",
      });
    }

    const token = authHeader.replace(/^Bearer\s+/, "").trim();
    if (!token) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_UNAUTHORIZED",
        message: "Missing token",
      });
    }

    // 1. Verify signature and validity
    const verification = opts.tokenService.verifyAndDecode(token);

    if (verification.expired) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_TOKEN_EXPIRED",
        message: "Token expired",
      });
    }

    if (verification.futureIat) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_TOKEN_FUTURE_IAT",
        message: "Token issued in the future (clock skew exceeded)",
      });
    }

    if (!verification.valid || !verification.payload) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_UNAUTHORIZED",
        message: "Invalid or forged token signature",
      });
    }

    const payload = verification.payload;
    const uid = payload.uid;
    const iat = payload.iat;

    // Defense-in-depth: Validate token issuance timestamp against clock skew
    const now = Math.floor(Date.now() / 1000);
    const maxSkew = CONSTANTS.TOKEN.CLOCK_SKEW_TOLERANCE_SECONDS;
    if (typeof iat === "number" && iat > now + maxSkew) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_TOKEN_FUTURE_IAT",
        message: "Token issued in the future (clock skew exceeded)",
      });
    }

    // 2. Validate token issuance timestamp (iat <= T rejection)
    const isRevoked =
      (await opts.repo.isTokenRevoked(token, iat)) ||
      (await opts.repo.isTokenRevoked(uid, iat));

    if (isRevoked) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_TOKEN_REVOKED",
        message: "Session was invalidated",
      });
    }

    // 3. Attach verified user context to request
    req.rawToken = token;
    req.tokenPayload = payload;
    req.user = {
      uid,
      email: payload.email || "user@zolexora.com",
      zolexora_id: payload.zolexora_id || "ZX-8K9M-4P2W-7Y3X",
      ...(payload.role ? { role: payload.role } : {}),
      ...(payload.org_id ? { org_id: payload.org_id } : {}),
      ...(payload.permissions ? { permissions: payload.permissions } : {}),
      ...(payload.is_platform_admin !== undefined ? { is_platform_admin: payload.is_platform_admin } : {}),
    };
  };
}
