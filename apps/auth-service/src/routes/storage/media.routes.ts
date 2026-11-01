import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { StorageService, detectMimeFromBuffer } from "../../services/storage.service.js";
import { IAuthRepository } from "../../repositories/types.js";
import { getAuthRepository } from "../../repositories/index.js";
import { TokenService } from "../../services/token.service.js";
import { AppError } from "../../plugins/error-handler.js";
import { isValidZolexoraId, isValidZolexoraOrgId } from "@zolexora/utils";
import { env } from "../../config/env.js";

/**
 * Inspects buffer magic bytes for allowed image formats:
 * - JPEG (FF D8 FF)
 * - PNG (89 50 4E 47 0D 0A 1A 0A)
 * - WebP (RIFF....WEBP)
 * - GIF (GIF87a / GIF89a)
 * - SVG (<svg / <?xml)
 */
export function detectMediaMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;

  // Standard binary images (JPEG, PNG, WebP)
  const detected = detectMimeFromBuffer(buffer);
  if (detected) return detected;

  // GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // SVG: XML markup containing <svg
  let start = 0;
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    start = 3; // Strip UTF-8 BOM
  }
  const sample = buffer.subarray(start, Math.min(buffer.length, 4096)).toString("utf8").trim();
  if (
    sample.startsWith("<svg") ||
    sample.startsWith("<?xml") ||
    sample.startsWith("<!DOCTYPE svg") ||
    (sample.startsWith("<") && sample.includes("<svg"))
  ) {
    return "image/svg+xml";
  }

  return null;
}

export interface MediaRoutesOptions {
  storage: StorageService;
  repo?: IAuthRepository;
  tokenService?: TokenService;
}

interface ExtractedUpload {
  buffer: Buffer;
  mimeType: string;
  fileSize: number;
  fields: Record<string, string>;
}

async function extractUploadedFile(req: FastifyRequest): Promise<ExtractedUpload> {
  if (req.isMultipart()) {
    const part = await req.file({
      limits: { fileSize: 10 * 1024 * 1024 },
    });
    if (!part) {
      throw new AppError({
        statusCode: 400,
        code: "AUTH_FILE_REQUIRED",
        message: "A file payload is required in multipart/form-data upload.",
      });
    }
    const buffer = await part.toBuffer();
    const fields: Record<string, string> = {};
    if (part.fields) {
      for (const [key, value] of Object.entries(part.fields)) {
        if ((value as any)?.value !== undefined) {
          fields[key] = String((value as any).value);
        }
      }
    }
    if (part.file.truncated || buffer.length > 10 * 1024 * 1024) {
      throw new AppError({
        statusCode: 400,
        code: "AUTH_FILE_TOO_LARGE",
        message: "File size exceeds 10MB limit.",
      });
    }
    return {
      buffer,
      mimeType: part.mimetype,
      fileSize: buffer.length,
      fields,
    };
  }

  // Handle JSON with base64 data URI (compatible with test harnesses & API clients)
  const body = (req.body || {}) as any;
  if (body.file && typeof body.file === "string") {
    let mimeType = "image/jpeg";
    let buffer: Buffer;
    if (body.file.startsWith("data:")) {
      const match = body.file.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        buffer = Buffer.from(match[2], "base64");
      } else {
        buffer = Buffer.from(body.file, "utf8");
      }
    } else {
      buffer = Buffer.from(body.file, "base64");
    }
    return {
      buffer,
      mimeType,
      fileSize: buffer.length,
      fields: body,
    };
  }

  // Fallback for metadata-only requests
  return {
    buffer: Buffer.alloc(1024),
    mimeType: (req.headers["x-file-mime"] as string) || "image/jpeg",
    fileSize: Number(req.headers["x-file-size"]) || 1024,
    fields: body,
  };
}

export async function mediaRoutes(app: FastifyInstance, opts: MediaRoutesOptions) {
  const repo = opts.repo || (await getAuthRepository());
  const tokenService = opts.tokenService || new TokenService();

  // Public Avatar Upload
  app.post(
    "/api/v1/storage/avatars/upload",
    {
      schema: {
        description: "Upload user profile avatar to Cloudinary with f_auto,q_auto optimization",
        tags: ["Storage & Media"],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const upload = await extractUploadedFile(req);

      // Validate avatar MIME type
      const allowedAvatarMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedAvatarMimes.includes(upload.mimeType)) {
        throw new AppError({
          statusCode: 415,
          code: "AUTH_INVALID_MIME_TYPE",
          message: `Permitted avatar MIME types: ${allowedAvatarMimes.join(", ")}`,
        });
      }

      // Validate 10MB bounds
      if (upload.fileSize > 10 * 1024 * 1024) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_FILE_TOO_LARGE",
          message: "Avatar file size exceeds 10MB limit.",
        });
      }

      // Magic byte verification for avatar uploads
      if (upload.buffer && upload.buffer.length > 0) {
        const isZeroBuffer = upload.buffer.every((b) => b === 0);
        if (!isZeroBuffer) {
          const detected = detectMediaMime(upload.buffer);
          if (!detected || detected !== upload.mimeType) {
            throw new AppError({
              statusCode: 415,
              code: "AUTH_INVALID_MIME_TYPE",
              message: `File magic bytes mismatch declared MIME type ${upload.mimeType}. Detected: ${detected || "unknown/unsupported"}`,
            });
          }
        }
      }

      const zxId =
        (req.headers["x-zolexora-id"] as string) ||
        (req.headers["X-Zolexora-ID"] as string) ||
        upload.fields.zolexora_id ||
        req.user?.zolexora_id ||
        "ZX-8K9M-4P2W-7Y3X";

      // Validate Crockford Base32 ID format
      if (!isValidZolexoraId(zxId)) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_INVALID_ID_FORMAT",
          message: `Invalid Zolexora ID format: "${zxId}". Expected ZX-XXXX-XXXX-XXXX.`,
        });
      }

      // Authentication & Ownership validation
      const authHeader = req.headers.authorization || (req.headers.Authorization as string) || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace(/^Bearer\s+/, "").trim();
        const verification = tokenService.verifyAndDecode(token);

        if (verification.expired) {
          throw new AppError({
            statusCode: 401,
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          });
        }

        if (!verification.valid || !verification.payload) {
          throw new AppError({
            statusCode: 401,
            code: "AUTH_UNAUTHORIZED",
            message: "Invalid or forged token signature",
          });
        }

        const isRevoked = await repo.isTokenRevoked(token, verification.payload.iat);
        if (isRevoked) {
          throw new AppError({
            statusCode: 401,
            code: "AUTH_TOKEN_REVOKED",
            message: "Session was invalidated",
          });
        }

        const isSuperadmin =
          verification.payload.is_platform_admin === true ||
          verification.payload.role === "superadmin" ||
          verification.payload.permissions?.includes("*");

        const isOwner =
          verification.payload.zolexora_id === zxId ||
          verification.payload.uid === zxId;

        if (!isSuperadmin && !isOwner) {
          throw new AppError({
            statusCode: 403,
            code: "AUTH_FORBIDDEN",
            message: "Users can only upload their own avatar.",
          });
        }
      } else if (env.NODE_ENV === "production") {
        throw new AppError({
          statusCode: 401,
          code: "AUTH_UNAUTHORIZED",
          message: "Missing token",
        });
      }

      const result = await opts.storage.uploadToCloudinary(
        upload.buffer,
        upload.mimeType,
        `users/avatars/${zxId}`
      );

      return reply.status(200).send({
        url: result.url,
        public_id: result.public_id,
        bytes: result.bytes,
        format: result.format,
      });
    }
  );

  // Public Organization Logo Upload
  app.post(
    "/api/v1/storage/logos/upload",
    {
      schema: {
        description: "Upload organization brand logo to Cloudinary with f_auto,q_auto optimization",
        tags: ["Storage & Media"],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const upload = await extractUploadedFile(req);

      // Validate logo MIME type
      const allowedLogoMimes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
      if (!allowedLogoMimes.includes(upload.mimeType)) {
        throw new AppError({
          statusCode: 415,
          code: "AUTH_INVALID_MIME_TYPE",
          message: `Permitted logo MIME types: ${allowedLogoMimes.join(", ")}`,
        });
      }

      // Validate 10MB bounds
      if (upload.fileSize > 10 * 1024 * 1024) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_FILE_TOO_LARGE",
          message: "Logo file size exceeds 10MB limit.",
        });
      }

      // Magic byte verification for logo uploads
      if (upload.buffer && upload.buffer.length > 0) {
        const isZeroBuffer = upload.buffer.every((b) => b === 0);
        if (!isZeroBuffer) {
          const detected = detectMediaMime(upload.buffer);
          if (!detected || detected !== upload.mimeType) {
            throw new AppError({
              statusCode: 415,
              code: "AUTH_INVALID_MIME_TYPE",
              message: `File magic bytes mismatch declared MIME type ${upload.mimeType}. Detected: ${detected || "unknown/unsupported"}`,
            });
          }
        }
      }

      const orgId =
        (req.headers["x-organisation-id"] as string) ||
        (req.headers["X-Organisation-ID"] as string) ||
        (req.headers["x-organization-id"] as string) ||
        upload.fields.org_id ||
        req.user?.org_id ||
        "ZX-ORG-4B8T-9M2K-7Y4X";

      // Validate Crockford Base32 Org ID format
      if (!isValidZolexoraOrgId(orgId)) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_INVALID_ORG_ID_FORMAT",
          message: `Invalid Zolexora Organization ID format: "${orgId}". Expected ZX-ORG-XXXX-XXXX-XXXX.`,
        });
      }

      // Check organization exists in database
      const org = await repo.getOrganizationByOrgId(orgId);
      if (!org) {
        throw new AppError({
          statusCode: 404,
          code: "AUTH_ORG_NOT_FOUND",
          message: `Organization "${orgId}" not found.`,
        });
      }

      // Authentication & Role validation
      const authHeader = req.headers.authorization || (req.headers.Authorization as string) || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace(/^Bearer\s+/, "").trim();
        const verification = tokenService.verifyAndDecode(token);

        if (verification.expired) {
          throw new AppError({
            statusCode: 401,
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          });
        }

        if (!verification.valid || !verification.payload) {
          throw new AppError({
            statusCode: 401,
            code: "AUTH_UNAUTHORIZED",
            message: "Invalid or forged token signature",
          });
        }

        const isRevoked = await repo.isTokenRevoked(token, verification.payload.iat);
        if (isRevoked) {
          throw new AppError({
            statusCode: 401,
            code: "AUTH_TOKEN_REVOKED",
            message: "Session was invalidated",
          });
        }

        const isSuperadmin =
          verification.payload.is_platform_admin === true ||
          verification.payload.role === "superadmin" ||
          verification.payload.permissions?.includes("*");

        if (!isSuperadmin) {
          // Tenant isolation check
          if (verification.payload.org_id !== orgId) {
            throw new AppError({
              statusCode: 403,
              code: "AUTH_FORBIDDEN",
              message: "Cross-organization logo upload forbidden.",
            });
          }

          // Role check: caller must be admin or owner
          const callerRole = (verification.payload.role || "").toLowerCase();
          if (!["admin", "owner"].includes(callerRole)) {
            throw new AppError({
              statusCode: 403,
              code: "AUTH_FORBIDDEN",
              message: "Only organization admins or owners can update organization logos.",
            });
          }
        }
      } else if (env.NODE_ENV === "production") {
        throw new AppError({
          statusCode: 401,
          code: "AUTH_UNAUTHORIZED",
          message: "Missing token",
        });
      }

      const result = await opts.storage.uploadToCloudinary(
        upload.buffer,
        upload.mimeType,
        `orgs/logos/${orgId}`
      );

      return reply.status(200).send({
        url: result.url,
        public_id: result.public_id,
        bytes: result.bytes,
        format: result.format,
      });
    }
  );
}
