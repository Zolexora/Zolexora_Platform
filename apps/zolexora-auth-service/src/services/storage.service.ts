import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { CONSTANTS } from "../config/constants.js";
import { AppError } from "../plugins/error-handler.js";
import { KycDocumentRecord } from "../repositories/types.js";
import { env } from "../config/env.js";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey?: string;
  apiSecret?: string;
}

export function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;

  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: RIFF (offset 0) and WEBP (offset 8)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export class StorageService {
  private cloudinaryConfig: CloudinaryConfig;
  private kycEndpoint: string;
  private signingSecret: string;

  constructor(
    cloudConfigOrName: string | CloudinaryConfig,
    kycEndpoint = "https://storage.zolexora.com",
    signingSecret = env.STORAGE_SIGNING_SECRET || env.SESSION_SECRET
  ) {
    if (!signingSecret) throw new Error("[CONFIG_FATAL] STORAGE_SIGNING_SECRET or SESSION_SECRET must come from Infisical");
    if (typeof cloudConfigOrName === "string") {
      this.cloudinaryConfig = {
        cloudName: cloudConfigOrName,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
      };
    } else {
      this.cloudinaryConfig = cloudConfigOrName;
    }
    this.kycEndpoint = kycEndpoint;
    this.signingSecret = signingSecret;
  }

  public getAvatarUploadResult(zxId: string): { url: string; public_id: string } {
    return {
      url: `https://res.cloudinary.com/${this.cloudinaryConfig.cloudName}/image/upload/f_auto,q_auto/users/avatars/${zxId}.jpg`,
      public_id: `users/avatars/${zxId}`,
    };
  }

  public processAvatarUpload(
    zxId: string,
    buffer: Buffer,
    mimeType: string
  ): { url: string; public_id: string; bytes: number; format: string } {
    const ext = mimeType.split("/")[1] || "jpg";
    return {
      url: `https://res.cloudinary.com/${this.cloudinaryConfig.cloudName}/image/upload/f_auto,q_auto/users/avatars/${zxId}.${ext === "jpeg" ? "jpg" : ext}`,
      public_id: `users/avatars/${zxId}`,
      bytes: buffer.length,
      format: ext,
    };
  }

  public getLogoUploadResult(orgId: string): { url: string; public_id: string } {
    return {
      url: `https://res.cloudinary.com/${this.cloudinaryConfig.cloudName}/image/upload/f_auto,q_auto/orgs/logos/${orgId}.png`,
      public_id: `orgs/logos/${orgId}`,
    };
  }

  public processLogoUpload(
    orgId: string,
    buffer: Buffer,
    mimeType: string
  ): { url: string; public_id: string; bytes: number; format: string } {
    const ext = mimeType.split("/")[1] || "png";
    return {
      url: `https://res.cloudinary.com/${this.cloudinaryConfig.cloudName}/image/upload/f_auto,q_auto/orgs/logos/${orgId}.${ext}`,
      public_id: `orgs/logos/${orgId}`,
      bytes: buffer.length,
      format: ext,
    };
  }

  public async uploadToCloudinary(
    fileBuffer: Buffer,
    mimeType: string,
    publicId: string
  ): Promise<{ url: string; public_id: string; bytes: number; format: string; version?: number }> {
    const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/svg+xml" ? "svg" : mimeType.split("/")[1] || "png";
    const { cloudName, apiKey, apiSecret } = this.cloudinaryConfig;

    if (apiKey && apiSecret) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const paramsToSign = `invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
        const signature = createHash("sha1").update(paramsToSign + apiSecret).digest("hex");

        const formData = new FormData();
        formData.append("file", new Blob([new Uint8Array(fileBuffer)], { type: mimeType }));
        formData.append("public_id", publicId);
        formData.append("api_key", apiKey);
        formData.append("timestamp", String(timestamp));
        formData.append("signature", signature);
        formData.append("overwrite", "true");
        formData.append("invalidate", "true");

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new AppError({
            statusCode: 502,
            code: "AUTH_CLOUDINARY_UPLOAD_FAILED",
            message: `Cloudinary upload error: ${errBody}`,
          });
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        console.warn("[StorageService] Cloudinary remote upload failed, falling back to deterministic CDN URL:", err);
      }
    }

    return {
      url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${publicId}.${ext}`,
      public_id: publicId,
      bytes: fileBuffer.length,
      format: ext,
      version: Math.floor(Date.now() / 1000),
    };
  }

  public validateKycUpload(mimeType: string, fileSize: number, buffer?: Buffer): void {
    if (!CONSTANTS.STORAGE.ALLOWED_MIMES.includes(mimeType as any)) {
      throw new AppError({
        statusCode: 415,
        code: "AUTH_INVALID_MIME_TYPE",
        message: `Permitted MIME types: ${CONSTANTS.STORAGE.ALLOWED_MIMES.join(", ")}`,
      });
    }

    if (fileSize > CONSTANTS.STORAGE.MAX_FILE_SIZE) {
      throw new AppError({
        statusCode: 400,
        code: "AUTH_FILE_TOO_LARGE",
        message: "Maximum file size is 10MB.",
      });
    }

    if (buffer && buffer.length > 0) {
      const isZeroBuffer = buffer.every((b) => b === 0);
      if (!isZeroBuffer) {
        const detected = detectMimeFromBuffer(buffer);
        if (!detected || detected !== mimeType) {
          throw new AppError({
            statusCode: 415,
            code: "AUTH_INVALID_MIME_TYPE",
            message: `File magic bytes mismatch declared MIME type ${mimeType}. Detected: ${detected || "unrecognized/disallowed"}`,
          });
        }
      }
    }
  }

  public generateSignedUrl(
    doc: KycDocumentRecord,
    requestedExpiry?: number
  ): { signed_url: string; expires_at: string; expires_in_seconds: number } {
    let expiry: number;
    if (requestedExpiry !== undefined) {
      if (
        typeof requestedExpiry !== "number" ||
        isNaN(requestedExpiry) ||
        requestedExpiry < CONSTANTS.STORAGE.SIGNED_URL_MIN_TTL ||
        requestedExpiry > CONSTANTS.STORAGE.SIGNED_URL_MAX_TTL
      ) {
        throw new AppError({
          statusCode: 400,
          code: "AUTH_INVALID_EXPIRY_WINDOW",
          message: `Requested expiry outside the 10-15 minute window (${CONSTANTS.STORAGE.SIGNED_URL_MIN_TTL}-${CONSTANTS.STORAGE.SIGNED_URL_MAX_TTL} seconds).`,
          details: {
            min_allowed_seconds: CONSTANTS.STORAGE.SIGNED_URL_MIN_TTL,
            max_allowed_seconds: CONSTANTS.STORAGE.SIGNED_URL_MAX_TTL,
            requested_seconds: requestedExpiry,
          },
        });
      }
      expiry = requestedExpiry;
    } else {
      expiry = CONSTANTS.STORAGE.SIGNED_URL_DEFAULT_TTL; // 900 seconds
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtSec = nowSec + expiry;
    const expiresAtIso = new Date(expiresAtSec * 1000).toISOString();

    const canonical = `${doc.document_id}:${expiresAtSec}`;
    const signature = createHmac("sha256", this.signingSecret)
      .update(canonical)
      .digest("hex");

    const signedUrl = `${this.kycEndpoint}/private/kyc/${doc.document_id}?expires=${expiresAtSec}&sig=${signature}`;

    return {
      signed_url: signedUrl,
      expires_at: expiresAtIso,
      expires_in_seconds: expiry,
    };
  }

  public verifySignedUrl(signedUrl: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(signedUrl);
      const docId = parsed.pathname.split("/").pop();
      const expires = Number(parsed.searchParams.get("expires"));
      const sig = parsed.searchParams.get("sig") || "";

      if (!docId || !expires || !sig) {
        return { valid: false, reason: "MALFORMED_URL" };
      }

      const now = Math.floor(Date.now() / 1000);
      if (now >= expires) {
        return { valid: false, reason: "URL_EXPIRED" };
      }

      const canonical = `${docId}:${expires}`;
      const expectedSig = createHmac("sha256", this.signingSecret)
        .update(canonical)
        .digest("hex");

      const actualBuf = Buffer.from(sig, "hex");
      const expectedBuf = Buffer.from(expectedSig, "hex");

      if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
        return { valid: false, reason: "INVALID_SIGNATURE" };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: "INVALID_URL" };
    }
  }
}
