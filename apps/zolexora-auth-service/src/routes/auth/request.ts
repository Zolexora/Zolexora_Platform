import { FastifyRequest } from "fastify";
import { hashPassword, MAX_PASSWORD_BYTES, validatePassword } from "@zolexora/utils";
import { AppError } from "../../plugins/error-handler.js";

/** Turnstile token: body field first, then the CF-Turnstile-Token header. */
export function getTurnstileToken(req: FastifyRequest): string | undefined {
  const body = req.body as { turnstile_token?: string } | undefined;
  const header = req.headers["cf-turnstile-token"];
  return body?.turnstile_token || (Array.isArray(header) ? header[0] : header);
}

/** Client IP resolved by Fastify using the TRUST_PROXY setting; client-supplied headers are never read directly. */
export const getRemoteIp = (req: FastifyRequest): string => req.ip;

const policyError = (message: string) =>
  new AppError({ statusCode: 400, code: "AUTH_PASSWORD_POLICY_VIOLATION", message });

/** Rejects oversized passwords before any hashing work (algorithmic DoS defence). */
export function assertPasswordSize(password: string): void {
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw policyError(`Password exceeds maximum allowed size of ${MAX_PASSWORD_BYTES} bytes.`);
  }
}

/** Applies the password policy and returns a scrypt hash (supported on every Node version). */
export async function hashNewPassword(password: unknown): Promise<string> {
  if (typeof password !== "string" || !password) throw policyError("Password is required.");
  try {
    validatePassword(password);
  } catch (err: any) {
    throw policyError(err.message);
  }
  return hashPassword(password, "scrypt");
}

export const isOrgAdmin = (role?: string) => role === "admin" || role === "owner";

export const forbidden = (message: string) => new AppError({ statusCode: 403, code: "AUTH_FORBIDDEN", message });
