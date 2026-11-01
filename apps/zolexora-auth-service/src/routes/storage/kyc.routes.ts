import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { IAuthRepository } from "../../repositories/types.js";
import { TokenService } from "../../services/token.service.js";
import { StorageService } from "../../services/storage.service.js";
import { AppError } from "../../plugins/error-handler.js";
import { CONSTANTS } from "../../config/constants.js";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import {
  ORG_ID_RE, USER_ID_RE, UPLOAD_BODY_LIMIT, UploadBody,
  parseUpload, validateUpload, forbidden, isOrgAdmin,
} from "./upload.js";

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

interface SignedUrlBody {
  document_id?: string;
  expiry_seconds?: number;
}

export async function kycRoutes(
  app: FastifyInstance,
  opts: { storage: StorageService; repo: IAuthRepository; tokenService: TokenService }
) {
  const authenticate = createAuthMiddleware({ tokenService: opts.tokenService, repo: opts.repo });

  app.post<{ Body: UploadBody }>(
    "/api/v1/storage/kyc/upload",
    {
      bodyLimit: UPLOAD_BODY_LIMIT,
      schema: { description: "Upload a private KYC document (PDF/PNG/JPEG/WebP, ≤10MB)", tags: ["Storage"] },
    },
    async (req, reply) => {
      // Reject bad files before touching auth or storage, then always require a valid token.
      const u = parseUpload(req);
      validateUpload(u, CONSTANTS.STORAGE.ALLOWED_MIMES);
      await authenticate(req, reply);
      const user = req.user!;

      const userId = String(req.headers["x-zolexora-id"] || user.zolexora_id);
      const orgId = String(req.headers["x-organisation-id"] || req.headers["x-organization-id"] || user.org_id || "");
      if (!USER_ID_RE.test(userId)) {
        throw new AppError({ statusCode: 400, code: "AUTH_INVALID_ID_FORMAT", message: "X-Zolexora-ID must be ZX-XXXX-XXXX-XXXX (Crockford Base32)." });
      }
      if (!ORG_ID_RE.test(orgId)) {
        throw new AppError({ statusCode: 400, code: "AUTH_INVALID_ORG_ID_FORMAT", message: "X-Organisation-ID must be ZX-ORG-XXXX-XXXX-XXXX (Crockford Base32)." });
      }
      if (!user.is_platform_admin && user.zolexora_id !== userId) {
        throw forbidden("You can only upload your own KYC documents.");
      }
      if (!(await opts.repo.getOrganizationByOrgId(orgId))) {
        throw new AppError({ statusCode: 404, code: "AUTH_ORG_NOT_FOUND", message: "Organisation not found." });
      }

      const documentId = randomUUID();
      const doc = await opts.repo.saveKycDocument({
        document_id: documentId,
        user_id: userId,
        owner_id: userId,
        org_id: orgId,
        document_type: req.body?.document_type,
        storage_key: `kyc/${orgId}/${userId}/${documentId}.${EXT[u.mime]}`,
        file_size: u.size,
        mime_type: u.mime,
        created_at: new Date().toISOString(),
      });
      return reply.status(201).send({
        document_id: doc.document_id,
        document_type: doc.document_type,
        storage_key: doc.storage_key,
        mime_type: doc.mime_type,
        file_size: doc.file_size,
        created_at: doc.created_at,
      });
    }
  );

  app.post<{ Body: SignedUrlBody }>(
    "/api/v1/storage/kyc/signed-url",
    {
      preHandler: [authenticate],
      schema: { description: "Issue a 10–15 minute signed URL (document owner, org admin/owner, or platform admin)", tags: ["Storage"] },
    },
    async (req, reply) => {
      const { document_id, expiry_seconds } = req.body || {};
      if (!document_id) {
        throw new AppError({ statusCode: 400, code: "BAD_REQUEST", message: "document_id is required." });
      }
      const doc = await opts.repo.getKycDocument(document_id);
      if (!doc) {
        throw new AppError({ statusCode: 404, code: "AUTH_DOCUMENT_NOT_FOUND", message: "Document not found." });
      }
      const user = req.user!;
      const allowed =
        user.is_platform_admin ||
        (doc.user_id ?? doc.owner_id) === user.zolexora_id ||
        (!!doc.org_id && user.org_id === doc.org_id && isOrgAdmin(user.role));
      if (!allowed) throw forbidden("You cannot access this document.");

      return reply.send(opts.storage.generateSignedUrl(doc, expiry_seconds));
    }
  );
}
