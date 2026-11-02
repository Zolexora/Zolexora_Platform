import { FastifyInstance, FastifyRequest } from "fastify";
import { isValidZolexoraOrgId, normalizeZolexoraOrgId, isPublicWebmailDomain, verifyPassword } from "@zolexora/utils";
import { IAuthRepository } from "../../repositories/types.js";
import { TurnstileService } from "../../services/turnstile.service.js";
import { RateLimitService } from "../../services/rate-limit.service.js";
import { TokenService } from "../../services/token.service.js";
import { AppError } from "../../plugins/error-handler.js";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import {
  assertPasswordSize, forbidden, getRemoteIp, getTurnstileToken, hashNewPassword, isOrgAdmin,
} from "./request.js";

interface EmployeeLoginBody {
  product?: string;
  org_id?: string;
  user_id_or_email?: string;
  password?: string;
  turnstile_token?: string;
}

interface CreateEmployeeBody {
  org_id?: string;
  email?: string;
  password?: string;
  role?: string;
  permissions?: string[];
}

const invalidOrgId = (raw: string) =>
  new AppError({
    statusCode: 400,
    code: "AUTH_INVALID_ORG_ID_FORMAT",
    message: `Invalid Zolexora Org ID format: "${raw}". Expected ZX-ORG-XXXX-XXXX-XXXX`,
  });

export async function track2EmployeeRoutes(
  app: FastifyInstance,
  opts: { repo: IAuthRepository; turnstile: TurnstileService; rateLimiter: RateLimitService; tokenService: TokenService },
) {
  const authenticate = createAuthMiddleware({ tokenService: opts.tokenService, repo: opts.repo });

  // 1. Employee login
  app.post<{ Body: EmployeeLoginBody }>(
    "/api/v1/auth/employee/login",
    { schema: { description: "Organization-scoped employee login", tags: ["Track 2: Organization Employee"] } },
    async (req: FastifyRequest<{ Body: EmployeeLoginBody }>, reply) => {
      const body = req.body ?? {};
      await opts.turnstile.verifyToken(getTurnstileToken(req), {
        remoteIp: getRemoteIp(req),
        expectedAction: "track2-employee-login",
      });

      const rawOrgId = body.org_id ?? "";
      if (!isValidZolexoraOrgId(rawOrgId)) throw invalidOrgId(rawOrgId);
      const orgId = normalizeZolexoraOrgId(rawOrgId);

      const ip = getRemoteIp(req);
      const identifier = (body.user_id_or_email ?? "").toLowerCase().trim();
      const keys = [`ip:${ip}`, `attempt:${ip}:org:${orgId}:${identifier}`];
      keys.forEach((k) => opts.rateLimiter.checkAllowed(k));

      const password = body.password ?? "";
      assertPasswordSize(password);

      const employee = await opts.repo.getEmployeeByOrgAndIdentifier(orgId, identifier);
      if (!employee || !(await verifyPassword(password, employee.password_hash))) {
        keys.forEach((k) => opts.rateLimiter.recordFailure(k));
        throw new AppError({ statusCode: 401, code: "AUTH_INVALID_CREDENTIALS", message: "Invalid employee credentials" });
      }
      keys.forEach((k) => opts.rateLimiter.recordSuccess(k));

      const org = await opts.repo.getOrganizationByOrgId(orgId);
      if (employee.status !== "active" || org?.status !== "active") {
        throw new AppError({ statusCode: 403, code: "AUTH_ACCOUNT_DISABLED", message: "Employee or organisation is not active." });
      }

      const claims = {
        zolexora_id: employee.zolexora_id,
        org_id: orgId,
        role: employee.role,
        product: employee.product || body.product,
        permissions: employee.permissions,
      };
      return reply.status(200).send({
        success: true,
        customToken: opts.tokenService.mintEmployeeCustomToken(employee.id, claims, employee.email),
        claims,
        user: { uid: employee.id, zolexora_id: employee.zolexora_id, email: employee.email, status: employee.status },
        org: { zolexora_org_id: orgId, role: employee.role },
      });
    },
  );

  // 2. Employee provisioning — platform admins, or admins/owners of the same organisation.
  app.post<{ Body: CreateEmployeeBody }>(
    "/api/v1/auth/employee/create",
    {
      preHandler: [authenticate],
      schema: { description: "Provision a corporate employee (org admin/owner or platform admin)", tags: ["Track 2: Organization Employee"] },
    },
    async (req, reply) => {
      const body = req.body ?? {};
      const user = req.user!;

      const rawOrgId = body.org_id ?? "";
      if (!isValidZolexoraOrgId(rawOrgId)) throw invalidOrgId(rawOrgId);
      const orgId = normalizeZolexoraOrgId(rawOrgId);

      const isSameOrgAdmin = user.org_id === orgId && isOrgAdmin(user.role);
      if (!user.is_platform_admin && !isSameOrgAdmin) {
        throw forbidden("Only an admin or owner of this organisation can create employees.");
      }
      const role = body.role ?? "member";
      if (role === "owner" && !user.is_platform_admin && user.role !== "owner") {
        throw forbidden("Only an owner or platform admin can grant the owner role.");
      }
      const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
      if (!user.is_platform_admin && !user.permissions?.includes("*") &&
          permissions.some((p) => !user.permissions?.includes(p))) {
        throw forbidden("You cannot grant permissions you do not hold.");
      }

      const email = (body.email ?? "").toLowerCase().trim();
      if (!email) throw new AppError({ statusCode: 400, code: "BAD_REQUEST", message: "Email is required." });
      if (isPublicWebmailDomain(email)) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_WEBMAIL_DOMAIN_FORBIDDEN",
          message: "Public email domains like gmail.com are not permitted for corporate employees.",
        });
      }

      if (!(await opts.repo.getOrganizationByOrgId(orgId))) {
        throw new AppError({ statusCode: 404, code: "AUTH_ORG_NOT_FOUND", message: "Organisation not found." });
      }
      const employee = await opts.repo.createEmployee({
        zolexora_org_id: orgId,
        email,
        password_hash: await hashNewPassword(body.password),
        role,
        permissions,
      });
      if (!employee) {
        throw new AppError({ statusCode: 409, code: "AUTH_EMPLOYEE_EXISTS", message: "Employee already exists in this organisation." });
      }

      return reply.status(201).send({
        success: true,
        employee: { zolexora_id: employee.zolexora_id, email: employee.email, org_id: orgId, status: employee.status },
      });
    },
  );
}
