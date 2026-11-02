import { FastifyInstance } from "fastify";
import { IAuthRepository } from "../../repositories/types.js";
import { TokenService } from "../../services/token.service.js";
import { StorageService } from "../../services/storage.service.js";
import { AppError } from "../../plugins/error-handler.js";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { ORG_ID_RE, USER_ID_RE, UPLOAD_BODY_LIMIT, UploadBody, parseUpload, validateUpload } from "./upload.js";
import { forbidden, isOrgAdmin } from "../auth/request.js";

// SVG is excluded: it can carry script and would be served from the CDN as active content.
const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;

export async function mediaRoutes(
  app: FastifyInstance,
  opts: { storage: StorageService; repo: IAuthRepository; tokenService: TokenService }
) {
  const authenticate = createAuthMiddleware({ tokenService: opts.tokenService, repo: opts.repo });

  app.post<{ Body: UploadBody }>(
    "/api/v1/storage/avatars/upload",
    {
      preHandler: [authenticate],
      bodyLimit: UPLOAD_BODY_LIMIT,
      schema: { description: "Upload the avatar for X-Zolexora-ID (self or platform admin)", tags: ["Storage"] },
    },
    async (req, reply) => {
      const zxId = String(req.headers["x-zolexora-id"] || "");
      if (!USER_ID_RE.test(zxId)) {
        throw new AppError({ statusCode: 400, code: "AUTH_INVALID_ID_FORMAT", message: "X-Zolexora-ID must be ZX-XXXX-XXXX-XXXX (Crockford Base32)." });
      }
      const user = req.user!;
      if (!user.is_platform_admin && user.zolexora_id !== zxId) {
        throw forbidden("You can only upload your own avatar.");
      }
      const u = parseUpload(req);
      const buffer = validateUpload(u, IMAGE_MIMES);
      return reply.send(await opts.storage.uploadToCloudinary(buffer, u.mime, `users/avatars/${zxId}`));
    }
  );

  app.post<{ Body: UploadBody }>(
    "/api/v1/storage/logos/upload",
    {
      preHandler: [authenticate],
      bodyLimit: UPLOAD_BODY_LIMIT,
      schema: { description: "Upload the logo for X-Organisation-ID (org admin/owner or platform admin)", tags: ["Storage"] },
    },
    async (req, reply) => {
      const orgId = String(req.headers["x-organisation-id"] || req.headers["x-organization-id"] || "");
      if (!ORG_ID_RE.test(orgId)) {
        throw new AppError({ statusCode: 400, code: "AUTH_INVALID_ORG_ID_FORMAT", message: "X-Organisation-ID must be ZX-ORG-XXXX-XXXX-XXXX (Crockford Base32)." });
      }
      if (!(await opts.repo.getOrganizationByOrgId(orgId))) {
        throw new AppError({ statusCode: 404, code: "AUTH_ORG_NOT_FOUND", message: "Organisation not found." });
      }
      const user = req.user!;
      if (!user.is_platform_admin && !(user.org_id === orgId && isOrgAdmin(user.role))) {
        throw forbidden("Only an admin or owner of this organisation can upload its logo.");
      }
      const u = parseUpload(req);
      const buffer = validateUpload(u, IMAGE_MIMES);
      return reply.send(await opts.storage.uploadToCloudinary(buffer, u.mime, `orgs/logos/${orgId}`));
    }
  );
}
