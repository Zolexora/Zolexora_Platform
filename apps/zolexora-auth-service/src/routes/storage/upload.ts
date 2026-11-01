import { FastifyRequest } from "fastify";
import { AppError } from "../../plugins/error-handler.js";
import { CONSTANTS } from "../../config/constants.js";
import { detectMimeFromBuffer } from "../../services/storage.service.js";

// Crockford Base32 (no I, L, O, U)
const C = "[0-9A-HJKMNP-TV-Z]{4}";
export const USER_ID_RE = new RegExp(`^ZX-${C}-${C}-${C}$`);
export const ORG_ID_RE = new RegExp(`^ZX-ORG-${C}-${C}-${C}$`);

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

function detect(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 512).toString("utf8").trimStart();
  if (/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  return detectMimeFromBuffer(buffer);
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
  const detected = detect(u.buffer);
  if (detected !== u.mime) {
    throw new AppError({
      statusCode: 415,
      code: "AUTH_INVALID_MIME_TYPE",
      message: `File content does not match declared MIME type ${u.mime}.`,
    });
  }
  return u.buffer;
}

export const forbidden = (message: string) =>
  new AppError({ statusCode: 403, code: "AUTH_FORBIDDEN", message });

export const isOrgAdmin = (role?: string) => role === "admin" || role === "owner";
