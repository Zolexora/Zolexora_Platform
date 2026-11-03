import { FastifyRequest } from "fastify";
import { AppError } from "../../plugins/error-handler.js";
import { CONSTANTS } from "../../config/constants.js";
import { detectMimeFromBuffer } from "../../services/storage.service.js";

// The same patterns the IDs are generated and stored with.
export { ZOLEXORA_ID_REGEX as USER_ID_RE, ZOLEXORA_ORG_ID_REGEX as ORG_ID_RE } from "@zolexora/utils";

// Base64 JSON payloads: 10MB file + ~33% encoding overhead
export const UPLOAD_BODY_LIMIT = 15 * 1024 * 1024;

export interface UploadBody {
  file?: string;
  mime_type?: string;
  file_size?: number;
  document_type?: string;
}

export interface ParsedUpload {
  mime: string;
  size: number;
  buffer?: Buffer;
}

const header = (req: FastifyRequest, name: string) => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

/** Reads `file` (data URL) plus optional X-File-Mime / X-File-Size hints from a JSON body. */
export function parseUpload(req: FastifyRequest<{ Body: UploadBody }>): ParsedUpload {
  const body = req.body || {};
  let dataMime: string | undefined;
  let buffer: Buffer | undefined;
  if (typeof body.file === "string") {
    const m = /^data:([\w.+-]+\/[\w.+-]+);base64,(.*)$/s.exec(body.file);
    if (!m) {
      throw new AppError({ statusCode: 400, code: "AUTH_INVALID_FILE", message: "file must be a base64 data URL." });
    }
    dataMime = m[1];
    buffer = Buffer.from(m[2], "base64");
  }
  const mime = (header(req, "x-file-mime") || body.mime_type || dataMime || "").toLowerCase();
  const size = buffer?.length ?? Number(header(req, "x-file-size") ?? body.file_size ?? 0);
  return { mime, size, buffer };
}

/** Enforces MIME allow-list, size limit, magic bytes, and presence of the file. */
export function validateUpload(u: ParsedUpload, allowed: readonly string[]): Buffer {
  if (!allowed.includes(u.mime)) {
    throw new AppError({
      statusCode: 415,
      code: "AUTH_INVALID_MIME_TYPE",
      message: `Permitted MIME types: ${allowed.join(", ")}`,
    });
  }
  if (u.size > CONSTANTS.STORAGE.MAX_FILE_SIZE) {
    throw new AppError({ statusCode: 400, code: "AUTH_FILE_TOO_LARGE", message: "Maximum file size is 10MB." });
  }
  if (!u.buffer || u.buffer.length === 0) {
    throw new AppError({ statusCode: 400, code: "AUTH_FILE_REQUIRED", message: "file is required." });
  }
  const detected = detectMimeFromBuffer(u.buffer);
  if (detected !== u.mime) {
    throw new AppError({
      statusCode: 415,
      code: "AUTH_INVALID_MIME_TYPE",
      message: `File content does not match declared MIME type ${u.mime}.`,
    });
  }
  return u.buffer;
}
