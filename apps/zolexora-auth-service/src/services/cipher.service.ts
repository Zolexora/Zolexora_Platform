import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for PAN, GSTIN, bank numbers and MFA secrets, plus keyed hashes for lookups (PAN uniqueness,
 * invite and refresh tokens). One key from Infisical (AUTH_ENCRYPTION_KEY); sub-keys are derived with HKDF.
 */
export class CipherService {
  private readonly encKey: Buffer;
  private readonly macKey: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32) throw new Error("[CONFIG_FATAL] AUTH_ENCRYPTION_KEY must be base64 of 32 bytes");
    this.encKey = Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), "zolexora-auth/enc/v1", 32));
    this.macKey = Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), "zolexora-auth/mac/v1", 32));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.encKey, iv);
    const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${ct.toString("base64url")}`;
  }

  decrypt(token: string): string {
    const [v, iv, tag, ct] = token.split(".");
    if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("Unsupported ciphertext");
    const d = createDecipheriv("aes-256-gcm", this.encKey, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  }

  encryptJson = (v: unknown) => this.encrypt(JSON.stringify(v));
  decryptJson = <T>(t: string): T => JSON.parse(this.decrypt(t)) as T;

  /** Deterministic keyed hash (lookup without storing the value). */
  hash(value: string): string {
    return createHmac("sha256", this.macKey).update(value).digest("base64url");
  }

  /** A random secret for links and refresh tokens; store only `hash(secret)`. */
  static token(): string {
    return randomBytes(32).toString("base64url");
  }
}

export const last4 = (v: string) => v.replace(/[^0-9A-Za-z]/g, "").slice(-4);
