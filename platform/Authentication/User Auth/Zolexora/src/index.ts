import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { Resend } from "resend";
import type { StoredZolexoraUser, ZolexoraAuthOptions, ZolexoraUser } from "./types.js";

export type { StoredZolexoraUser, ZolexoraAuthOptions, ZolexoraAuthStore, ZolexoraTokenPurpose, ZolexoraUser } from "./types.js";

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const KEY_LENGTH = 64;
const TOKEN_BYTES = 32;
const DEFAULT_VERIFY_TTL = 24 * 60 * 60 * 1000;
const DEFAULT_RESET_TTL = 60 * 60 * 1000;

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
  const key = (await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltHex, keyHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  try {
    const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    })) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function publicUser(user: StoredZolexoraUser): ZolexoraUser {
  return { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt };
}

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function createZolexoraAuth(options: ZolexoraAuthOptions) {
  const appUrl = new URL(options.appUrl);
  if (appUrl.protocol !== "https:" && appUrl.hostname !== "localhost") throw new Error("appUrl must use HTTPS.");
  const resend = new Resend(options.resendApiKey);
  const verificationTtl = options.verificationTokenTtlMs ?? DEFAULT_VERIFY_TTL;
  const resetTtl = options.passwordResetTokenTtlMs ?? DEFAULT_RESET_TTL;

  async function sendLink(user: StoredZolexoraUser, purpose: "verify-email" | "reset-password", ttl: number) {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    await options.store.createToken({
      userId: user.id,
      tokenHash: digestToken(token),
      purpose,
      expiresAt: new Date(Date.now() + ttl),
    });
    const path = purpose === "verify-email" ? "/verify-email" : "/reset-password";
    const link = new URL(path, appUrl);
    link.searchParams.set("token", token);
    const subject = purpose === "verify-email" ? "Verify your Zolexora email" : "Reset your Zolexora password";
    const action = purpose === "verify-email" ? "Verify email" : "Reset password";
    const { error } = await resend.emails.send({
      from: options.from,
      to: [user.email],
      subject,
      html: `<p>Use this link to ${action.toLowerCase()}:</p><p><a href="${escapeHtml(link.toString())}">${action}</a></p><p>This link expires soon. If you did not request it, ignore this email.</p>`,
    }, { idempotencyKey: `${purpose}/${user.id}/${digestToken(token).slice(0, 24)}` });
    if (error) throw new Error(`Could not send authentication email: ${error.message}`);
  }

  return {
    async signUp(email: string, password: string): Promise<ZolexoraUser> {
      const user = await options.store.createUser({ email: normalizeEmail(email), passwordHash: await hashPassword(password) });
      await sendLink(user, "verify-email", verificationTtl);
      return publicUser(user);
    },

    async verifyEmail(token: string): Promise<void> {
      const userId = await options.store.consumeToken({ tokenHash: digestToken(token), purpose: "verify-email", now: new Date() });
      if (!userId) throw new Error("Verification link is invalid or expired.");
      await options.store.setEmailVerified(userId, new Date());
    },

    async signIn(email: string, password: string): Promise<ZolexoraUser> {
      const user = await options.store.findUserByEmail(normalizeEmail(email));
      if (!user || !(await verifyPassword(password, user.passwordHash))) throw new Error("Invalid email or password.");
      if (!user.emailVerifiedAt) throw new Error("Verify your email before signing in.");
      return publicUser(user);
    },

    async requestPasswordReset(email: string): Promise<void> {
      const user = await options.store.findUserByEmail(normalizeEmail(email));
      if (user) await sendLink(user, "reset-password", resetTtl);
    },

    async resetPassword(token: string, newPassword: string): Promise<void> {
      const passwordHash = await hashPassword(newPassword);
      const userId = await options.store.consumeToken({ tokenHash: digestToken(token), purpose: "reset-password", now: new Date() });
      if (!userId) throw new Error("Password reset link is invalid or expired.");
      await options.store.updatePassword(userId, passwordHash);
    },
  };
}
