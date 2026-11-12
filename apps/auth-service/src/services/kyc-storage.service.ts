import { AwsClient } from "aws4fetch";
import { CONSTANTS } from "../config/constants.js";
import { AppError } from "../plugins/error-handler.js";

/**
 * Private KYC document storage over the S3 API. Works with any S3-compatible provider
 * (Supabase Storage, Cloudflare R2, AWS S3, MinIO, Backblaze B2): the provider is chosen
 * purely by configuration. Objects are addressed path-style: {endpoint}/{bucket}/{key}.
 */
export interface KycStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  defaultSignedUrlTtl: number;
}

const storageError = (message: string) => new AppError({ statusCode: 502, code: "AUTH_STORAGE_FAILED", message });

export class KycStorageService {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(private readonly config: KycStorageConfig) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      service: "s3",
    });
    this.base = `${config.endpoint.replace(/\/$/, "")}/${encodeURIComponent(config.bucket)}`;
  }

  private url(key: string): string {
    return `${this.base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  public async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await this.client
      .fetch(this.url(key), {
        method: "PUT",
        body: new Uint8Array(body),
        headers: { "Content-Type": contentType },
        signal: AbortSignal.timeout(30_000),
      })
      .catch(() => null);
    if (!res?.ok) throw storageError("KYC document upload failed.");
  }

  /** Best-effort delete, used to roll back an upload when the metadata write fails. */
  public async remove(key: string): Promise<void> {
    await this.client.fetch(this.url(key), { method: "DELETE", signal: AbortSignal.timeout(30_000) }).catch(() => null);
  }

  /** Presigned GET URL, valid for 10–15 minutes. Signed locally; no network call. */
  public async signedGetUrl(
    key: string,
    requestedExpiry?: number,
  ): Promise<{ signed_url: string; expires_at: string; expires_in_seconds: number }> {
    const { SIGNED_URL_MIN_TTL: min, SIGNED_URL_MAX_TTL: max } = CONSTANTS.STORAGE;
    if (requestedExpiry !== undefined &&
        (typeof requestedExpiry !== "number" || Number.isNaN(requestedExpiry) || requestedExpiry < min || requestedExpiry > max)) {
      throw new AppError({
        statusCode: 400,
        code: "AUTH_INVALID_EXPIRY_WINDOW",
        message: `Requested expiry outside the 10-15 minute window (${min}-${max} seconds).`,
        details: { min_allowed_seconds: min, max_allowed_seconds: max, requested_seconds: requestedExpiry },
      });
    }
    const expiresIn = requestedExpiry ?? this.config.defaultSignedUrlTtl;
    const signed = await this.client.sign(`${this.url(key)}?X-Amz-Expires=${expiresIn}`, {
      method: "GET",
      aws: { signQuery: true },
    });
    return {
      signed_url: signed.url,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      expires_in_seconds: expiresIn,
    };
  }
}
