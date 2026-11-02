import { FastifyRequest, FastifyReply } from "fastify";
import { IAuthRepository } from "../repositories/types.js";
import { TokenService, TokenPayload } from "../services/token.service.js";
import { AppError } from "../plugins/error-handler.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      uid: string;
      email?: string;
      zolexora_id?: string;
      role?: string;
      org_id?: string;
      permissions?: string[];
      is_platform_admin?: boolean;
    };
    tokenPayload?: TokenPayload;
  }
}

const unauthorized = (code: string, message: string) => new AppError({ statusCode: 401, code, message });

export function createAuthMiddleware(opts: { tokenService: TokenService; repo: IAuthRepository }) {
  return async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw unauthorized("AUTH_UNAUTHORIZED", "Missing token");

    const result = opts.tokenService.verifyAndDecode(token);
    if (result.expired) throw unauthorized("AUTH_TOKEN_EXPIRED", "Token expired");
    if (result.futureIat) throw unauthorized("AUTH_TOKEN_FUTURE_IAT", "Token issued in the future (clock skew exceeded)");
    if (!result.valid || !result.payload) throw unauthorized("AUTH_UNAUTHORIZED", "Invalid or forged token signature");

    const p = result.payload;
    if (await opts.repo.isTokenRevoked(p.uid, p.jti, p.iat)) {
      throw unauthorized("AUTH_TOKEN_REVOKED", "Session was invalidated");
    }

    req.tokenPayload = p;
    req.user = {
      uid: p.uid,
      email: p.email,
      zolexora_id: p.zolexora_id,
      role: p.role,
      org_id: p.org_id,
      permissions: p.permissions,
      is_platform_admin: p.is_platform_admin === true,
    };
  };
}
