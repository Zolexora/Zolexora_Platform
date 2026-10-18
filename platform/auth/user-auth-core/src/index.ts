import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { Pool } from "pg";
import { Resend } from "resend";
import { createPostgresAuthStore } from "./postgres";
import type { StoredZolexoraUser, ZolexoraAuthOptions, ZolexoraUser } from "./types";
import { generateZolexoraId, isValidZolexoraId, normalizeZolexoraId } from "./zolexora-id";

export type { StoredZolexoraUser, ZolexoraAuthOptions, ZolexoraAuthStore, ZolexoraTokenPurpose, ZolexoraUser } from "./types";
export { createPostgresAuthStore } from "./postgres";
export { generateZolexoraId, isValidZolexoraId, normalizeZolexoraId } from "./zolexora-id";

const scrypt = (password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const KEY_LENGTH = 64;
const TOKEN_BYTES = 32;
const DEFAULT_VERIFY_TTL = 24 * 60 * 60 * 1000;
const DEFAULT_RESET_TTL = 60 * 60 * 1000;
const DEFAULT_SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address.");
  return normalized;
}

function validatePassword(password: string): void {
  const length = Buffer.byteLength(password, "utf8");
  if (length < 12) throw new Error("Password must be at least 12 characters.");
  if (length > 1024) throw new Error("Password is too long.");
}

async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltHex, keyHex] = encoded.split("$");
  if (Buffer.byteLength(password, "utf8") > 1024 || algorithm !== "scrypt" || Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P || !/^[a-f0-9]{32}$/i.test(saltHex ?? "") || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  try {
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function publicUser(user: StoredZolexoraUser): ZolexoraUser {
  return { id: user.id, zolexoraId: user.zolexoraId, email: user.email, emailVerifiedAt: user.emailVerifiedAt };
}

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function createZolexoraAuth(options: ZolexoraAuthOptions = {}) {
  const databaseUrl = options.databaseUrl ?? process.env.ZOLEXORA_AUTHENTICATION_DATABASE_URL;
  if (!options.store && !databaseUrl) throw new Error("Set ZOLEXORA_AUTHENTICATION_DATABASE_URL.");

  const resendApiKey = options.resendApiKey ?? process.env.ZOLEXORA_PRODUCTION_RESEND_API_KEY;
  if (!resendApiKey) throw new Error("Set ZOLEXORA_PRODUCTION_RESEND_API_KEY.");

  const from = options.from ?? process.env.AUTH_FROM_EMAIL ?? "Zolexora <auth@zolexora.com>";
  const configuredAppUrl = options.appUrl ?? process.env.AUTH_APP_URL ?? "https://auth.zolexora.com";
  const appUrl = new URL(configuredAppUrl);
  if (appUrl.protocol !== "https:" && appUrl.hostname !== "localhost") throw new Error("appUrl must use HTTPS.");
  const maxConnections = options.maxDbConnections ?? 5;
  if (!Number.isInteger(maxConnections) || maxConnections < 1) throw new Error("maxDbConnections must be a positive integer.");
  const pool = options.store ? null : (() => {
    const parsed = new URL(databaseUrl!);
    const isSsl = parsed.searchParams.get("sslmode") === "require" || parsed.hostname.includes("supabase.com") || parsed.hostname.includes("render.com") || parsed.hostname.includes("neon.tech");
    return new Pool({
      host: parsed.hostname,
      port: Number(parsed.port) || 5432,
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      max: maxConnections,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    });
  })();
  const store = options.store ?? createPostgresAuthStore(pool!);
  const resend = new Resend(resendApiKey);
  const verificationTtl = options.verificationTokenTtlMs ?? DEFAULT_VERIFY_TTL;
  const resetTtl = options.passwordResetTokenTtlMs ?? DEFAULT_RESET_TTL;
  const sessionTtl = options.sessionTtlMs ?? DEFAULT_SESSION_TTL;

  function generateOtp(): string {
    const num = randomBytes(4).readUInt32BE(0) % 1000000;
    return num.toString().padStart(6, "0");
  }

  async function sendLink(user: StoredZolexoraUser, purpose: "verify-email" | "reset-password", ttl: number) {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    const otp = purpose === "verify-email" ? generateOtp() : null;

    // Save magic link token
    await store.createToken({
      userId: user.id,
      tokenHash: digestToken(token),
      purpose,
      expiresAt: new Date(Date.now() + ttl),
    });

    // Save 6-digit OTP token if verify-email
    if (otp) {
      await store.createToken({
        userId: user.id,
        tokenHash: digestToken(otp),
        purpose: "verify-email",
        expiresAt: new Date(Date.now() + Math.min(ttl, 15 * 60 * 1000)), // 15 min OTP TTL
      });
    }

    const path = purpose === "verify-email" ? options.verificationPath ?? "/verify-email" : options.passwordResetPath ?? "/reset-password";
    const link = new URL(path, appUrl);
    link.searchParams.set("token", token);
    const subject = purpose === "verify-email" ? "Verify your Zolexora email" : "Reset your Zolexora password";
    const action = purpose === "verify-email" ? "Verify email" : "Reset password";

    const otpHtml = otp ? `
      <div style="margin: 24px 0; padding: 16px; background-color: #f4f4f5; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #71717a;">Your 6-digit Verification Code:</p>
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #18181b; font-family: monospace;">${otp}</span>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #a1a1aa;">Valid for 15 minutes</p>
      </div>
      <p style="text-align: center; color: #71717a; font-size: 14px;">— OR —</p>
    ` : "";

    const { error } = await resend.emails.send({
      from,
      to: [user.email],
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>${subject}</h2>
          <p>Your Zolexora ID: <strong>${user.zolexoraId}</strong></p>
          ${otpHtml}
          <p>Click below to verify via direct link:</p>
          <p><a href="${escapeHtml(link.toString())}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px;">${action}</a></p>
          <p style="font-size: 12px; color: #71717a; margin-top: 24px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    }, { idempotencyKey: `${purpose}/${user.id}/${digestToken(token).slice(0, 24)}` });
    if (error) throw new Error(`Could not send authentication email: ${error.message}`);
  }

  return {
    async signUp(email: string, password: string): Promise<ZolexoraUser> {
      const zolexoraId = generateZolexoraId();
      const user = await store.createUser({
        email: normalizeEmail(email),
        passwordHash: await hashPassword(password),
        zolexoraId,
      });
      await sendLink(user, "verify-email", verificationTtl);
      return publicUser(user);
    },

    async verifyEmail(token: string): Promise<void> {
      const userId = await store.consumeToken({ tokenHash: digestToken(token), purpose: "verify-email", now: new Date() });
      if (!userId) throw new Error("Verification link is invalid or expired.");
      await store.setEmailVerified(userId, new Date());
    },

    async verifyEmailOtp(email: string, otp: string): Promise<void> {
      const normalized = normalizeEmail(email);
      const user = await store.findUserByEmail(normalized);
      if (!user) throw new Error("No account found with this email.");
      const cleanOtp = otp.trim();
      const userId = await store.consumeToken({ tokenHash: digestToken(cleanOtp), purpose: "verify-email", now: new Date() });
      if (!userId || userId !== user.id) throw new Error("Invalid or expired 6-digit OTP code.");
      await store.setEmailVerified(userId, new Date());
    },

    async resendVerification(email: string): Promise<void> {
      const user = await store.findUserByEmail(normalizeEmail(email));
      if (user && !user.emailVerifiedAt) await sendLink(user, "verify-email", verificationTtl);
    },

    async signIn(email: string, password: string): Promise<{ user: ZolexoraUser; sessionToken: string; expiresAt: Date }> {
      const user = await store.findUserByEmail(normalizeEmail(email));
      if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw new Error("Invalid email or password.");
      if (!user.emailVerifiedAt) throw new Error("Verify your email before signing in.");
      const sessionToken = randomBytes(TOKEN_BYTES).toString("base64url");
      const expiresAt = new Date(Date.now() + sessionTtl);
      await store.createSession({ userId: user.id, tokenHash: digestToken(sessionToken), expiresAt });
      return { user: publicUser(user), sessionToken, expiresAt };
    },

    async getUser(sessionToken: string): Promise<ZolexoraUser | null> {
      const user = await store.findUserBySession({ tokenHash: digestToken(sessionToken), now: new Date() });
      return user ? publicUser(user) : null;
    },

    async getUserByZolexoraId(zolexoraId: string): Promise<ZolexoraUser | null> {
      if (!store.findUserByZolexoraId) return null;
      const user = await store.findUserByZolexoraId(zolexoraId);
      return user ? publicUser(user) : null;
    },

    async signOut(sessionToken: string): Promise<void> {
      await store.deleteSession(digestToken(sessionToken));
    },

    async requestPasswordReset(email: string): Promise<void> {
      const user = await store.findUserByEmail(normalizeEmail(email));
      if (user) await sendLink(user, "reset-password", resetTtl);
    },

    async resetPassword(token: string, newPassword: string): Promise<void> {
      validatePassword(newPassword);
      const userId = await store.consumeToken({ tokenHash: digestToken(token), purpose: "reset-password", now: new Date() });
      if (!userId) throw new Error("Password reset link is invalid or expired.");
      await store.updatePassword(userId, await hashPassword(newPassword));
    },

    async close(): Promise<void> {
      await pool?.end();
    },
  };
}
