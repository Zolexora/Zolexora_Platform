import { createHash } from "node:crypto";
import { AppError } from "../plugins/error-handler.js";

export interface StorageConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;
  const at = (i: number, bytes: number[]) => bytes.every((b, j) => buffer[i + j] === b);
  if (at(0, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (buffer.length >= 12 && at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  return null;
}

/** Public media (avatars, logos) on Cloudinary. Private KYC documents use KycStorageService. */
export class StorageService {
  constructor(private readonly config: StorageConfig) {}

  /** Signed upload to Cloudinary. Any failure is surfaced; there is no synthetic fallback URL. */
  public async uploadToCloudinary(
    fileBuffer: Buffer,
    mimeType: string,
    publicId: string,
  ): Promise<{ url: string; public_id: string; bytes: number; format: string; version: number }> {
    const { cloudName, apiKey, apiSecret } = this.config;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1")
      .update(`invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(fileBuffer)], { type: mimeType }));
    form.append("public_id", publicId);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("overwrite", "true");
    form.append("invalidate", "true");

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (!res?.ok) {
      throw new AppError({ statusCode: 502, code: "AUTH_CLOUDINARY_UPLOAD_FAILED", message: "Media upload failed." });
    }
    const data = (await res.json()) as { secure_url: string; public_id: string; bytes: number; format: string; version: number };
    return { url: data.secure_url, public_id: data.public_id, bytes: data.bytes, format: data.format, version: data.version };
  }
}
