import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IAuthRepository } from "../../repositories/types.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { RateLimitService } from "../../services/rate-limit.service.js";
import { TokenService } from "../../services/token.service.js";
import { AppError } from "../../plugins/error-handler.js";
import {
  isValidZolexoraOrgId,
  normalizeZolexoraOrgId,
  isPublicWebmailDomain,
  validatePassword,
  hashPassword,
  verifyPassword,
  MAX_PASSWORD_BYTES,
} from "@zolexora/utils";

interface EmployeeLoginBody {
  product?: string;
  org_id?: string;
  user_id_or_email?: string;
  password?: string;
  turnstile_token?: string;
}

interface CreateEmployeeBody {
  org_id?: string;
  email: string;
  password?: string;
  role?: string;
  permissions?: string[];
  turnstile_token?: string;
}

export async function track2EmployeeRoutes(
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

  // 1. Employee Login
  app.post(
    "/api/v1/auth/employee/login",
    {
      schema: {
        description: "Organization-scoped employee login with strict canonical Org ID validation and zero friction",
        tags: ["Track 2: Organization Employee"],
      },
    },
    async (req: FastifyRequest<{ Body: EmployeeLoginBody }>, reply: FastifyReply) => {
      const body = req.body || ({} as EmployeeLoginBody);
      const turnstileToken = getTurnstileToken(req, body);

      // Step 1: Turnstile Bot Defense
      await opts.turnstile.verifyToken(turnstileToken, {
        remoteIp: getRemoteIp(req),
        expectedAction: "track2-employee-login",
      });

      // Step 2: Canonical Org ID Format Validation
      const rawOrgId = body.org_id || "";
      if (!isValidZolexoraOrgId(rawOrgId)) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_INVALID_ORG_ID_FORMAT",
          message: `Invalid Zolexora Org ID format: "${rawOrgId}". Expected ZX-ORG-XXXX-XXXX-XXXX`,
        });
      }
      const canonicalOrgId = normalizeZolexoraOrgId(rawOrgId);

      const remoteIp = getRemoteIp(req);
      const identifier = (body.user_id_or_email || "").toLowerCase().trim();
      const ipKey = `ip:${remoteIp}`;
      const attemptKey = `attempt:${remoteIp}:org:${canonicalOrgId}:${identifier}`;

      // Step 3: Rate Limit Check (Scoped per IP and per Account+IP)
      opts.rateLimiter.checkAllowed(ipKey);
      opts.rateLimiter.checkAllowed(attemptKey);

      // Step 4: Pre-Hash Password Bounds Check (Algorithmic DoS Defense)
      const password = body.password || "";
      if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_PASSWORD_POLICY_VIOLATION",
          message: `Password exceeds maximum allowed size of ${MAX_PASSWORD_BYTES} bytes.`,
        });
      }

      // Step 5: Employee Credential Lookup & Verification
      const employee = await opts.repo.getEmployeeByOrgAndIdentifier(canonicalOrgId, identifier);

      if (!employee) {
        opts.rateLimiter.recordFailure(ipKey);
        opts.rateLimiter.recordFailure(attemptKey);
        throw new AppError({
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS",
          message: "Invalid employee credentials",
        });
      }

      // Strictly verify password hash using constant-time Argon2id/Scrypt crypto
      const isValid = await verifyPassword(password, employee.password_hash);
      if (!isValid) {
        opts.rateLimiter.recordFailure(ipKey);
        opts.rateLimiter.recordFailure(attemptKey);
        throw new AppError({
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS",
          message: "Invalid employee credentials",
        });
      }

      // Step 5: Record Success & Reset Lockout
      opts.rateLimiter.recordSuccess(ipKey);
      opts.rateLimiter.recordSuccess(attemptKey);

      const resolvedProduct = employee.product || body.product || "zolexora-tms";
      const customToken = opts.tokenService.mintEmployeeCustomToken(
        employee.id,
        {
          zolexora_id: employee.zolexora_id,
          org_id: canonicalOrgId,
          role: employee.role,
          product: resolvedProduct,
          permissions: employee.permissions,
        },
        employee.email
      );

      return reply.status(200).send({
        success: true,
        customToken,
        claims: {
          zolexora_id: employee.zolexora_id,
          org_id: canonicalOrgId,
          role: employee.role,
          product: resolvedProduct,
          permissions: employee.permissions,
        },
        user: {
          uid: employee.id,
          zolexora_id: employee.zolexora_id,
          email: employee.email,
          status: employee.status,
        },
        org: {
          zolexora_org_id: canonicalOrgId,
          role: employee.role,
        },
      });
    }
  );

  // 2. Employee Provisioning (Webmail Rejection & Zero Friction)
  app.post(
    "/api/v1/auth/employee/create",
    {
      schema: {
        description: "Provision corporate employee with strict public webmail rejection and zero verification friction",
        tags: ["Track 2: Organization Employee"],
      },
    },
    async (req: FastifyRequest<{ Body: CreateEmployeeBody }>, reply: FastifyReply) => {
      const body = req.body || ({} as CreateEmployeeBody);
      const email = (body.email || "").toLowerCase().trim();

      // Step 1: Webmail Domain Rejection (Test T1.2.03, T3.04)
      if (isPublicWebmailDomain(email)) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_WEBMAIL_DOMAIN_FORBIDDEN",
          message: "Public email domains like gmail.com are not permitted for corporate employees.",
        });
      }

      const rawOrgId = body.org_id || "ZX-ORG-4B8T-9M2K-7Y4X";
      const canonicalOrgId = normalizeZolexoraOrgId(rawOrgId);

      const password = body.password;
      if (!password) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_PASSWORD_POLICY_VIOLATION",
          message: "Password is required.",
        });
      }
      try {
        validatePassword(password);
      } catch (err: any) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_PASSWORD_POLICY_VIOLATION",
          message: err.message,
        });
      }
      const passwordHash = await hashPassword(password, "argon2id");

      const employee = await opts.repo.createEmployee({
        zolexora_org_id: canonicalOrgId,
        email,
        password_hash: passwordHash,
        role: body.role || "member",
        permissions: body.permissions || ["trips:read"],
      });

      return reply.status(201).send({
        success: true,
        employee: {
          zolexora_id: employee.zolexora_id,
          email: employee.email,
          org_id: canonicalOrgId,
          status: "active",
        },
      });
    }
  );
}
