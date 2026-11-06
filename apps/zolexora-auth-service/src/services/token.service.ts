import { createHash, createHmac, createPrivateKey, createPublicKey, KeyObject, randomUUID, sign, timingSafeEqual, verify } from "node:crypto";
import { CONSTANTS } from "../config/constants.js";

export interface CustomTokenClaims {
  zolexora_id: string;
  org_id?: string;
  role: string;
  product?: string;
  permissions: string[];
  is_platform_admin?: boolean;
}

export interface TokenVerificationResult {
  valid: boolean;
  expired?: boolean;
  futureIat?: boolean;
  payload?: TokenPayload;
  reason?: string;
}

export interface TokenPayload {
  uid: string;
  jti: string;
  email?: string;
  zolexora_id?: string;
  org_id?: string;
  role?: string;
  product?: string;
  permissions?: string[];
  is_platform_admin?: boolean;
  type?: "user" | "employee" | "platform_admin" | "member" | "login_ticket" | "mfa_ticket";
  // Business-session tokens (ADR 0005 §5): one member of one business, optionally in one product.
  member_id?: string;
  user_id?: string; // person (Track 1 account)
  employee_id?: string; // employee (Track 2)
  org_role?: string;
  sid?: string; // session id; refresh-token family
  mfa?: boolean; // the session was opened with an MFA code
  iat: number;
  exp: number;
}

/** Short-lived helper tokens that must never be accepted as access tokens. */
export const NON_ACCESS_TYPES = ["login_ticket", "mfa_ticket"];

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

export class TokenService {
  private readonly signingKey?: KeyObject;
  private readonly publicKey?: KeyObject;
  public readonly kid?: string;

  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
    public readonly maxClockSkewSeconds: number = CONSTANTS.TOKEN.CLOCK_SKEW_TOLERANCE_SECONDS,
    /** ES256 (P-256) PKCS#8 PEM for business-session tokens. */
    signingPrivateKeyPem?: string,
  ) {
    if (!secret) throw new Error("[CONFIG_FATAL] SESSION_SECRET must come from Infisical");
    if (signingPrivateKeyPem) {
      this.signingKey = createPrivateKey(signingPrivateKeyPem);
      if (this.signingKey.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
        throw new Error("[CONFIG_FATAL] AUTH_SIGNING_PRIVATE_KEY must be an EC P-256 key");
      }
      this.publicKey = createPublicKey(this.signingKey);
      const { x, y } = this.publicKey.export({ format: "jwk" });
      // RFC 7638 thumbprint
      this.kid = createHash("sha256").update(JSON.stringify({ crv: "P-256", kty: "EC", x, y })).digest("base64url");
    }
  }

  /** Public keys for products: GET /.well-known/jwks.json */
  public jwks() {
    if (!this.publicKey) return { keys: [] };
    return { keys: [{ ...this.publicKey.export({ format: "jwk" }), kid: this.kid, alg: "ES256", use: "sig" }] };
  }

  /** ES256 business-session token. */
  public signEs256(payload: Record<string, any>, expiresInSeconds: number): string {
    if (!this.signingKey) throw new Error("ES256 signing key is not configured");
    const now = Math.floor(Date.now() / 1000);
    const head = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT", kid: this.kid })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ ...payload, jti: randomUUID(), iat: now, exp: now + expiresInSeconds })).toString("base64url");
    const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key: this.signingKey, dsaEncoding: "ieee-p1363" });
    return `${head}.${body}.${sig.toString("base64url")}`;
  }

  private sign(data: string): Buffer {
    return createHmac("sha256", this.secret).update(data).digest();
  }

  public signJwt(payload: Record<string, any>, expiresInSeconds = this.ttlSeconds): string {
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(
      JSON.stringify({ ...payload, jti: randomUUID(), iat: payload.iat ?? now, exp: payload.exp ?? now + expiresInSeconds }),
    ).toString("base64url");
    const data = `${HEADER}.${body}`;
    return `${data}.${this.sign(data).toString("base64url")}`;
  }

  public verifyAndDecode(token: string, options: { maxClockSkewSeconds?: number } = {}): TokenVerificationResult {
    const parts = typeof token === "string" ? token.split(".") : [];
    if (parts.length !== 3) return { valid: false, reason: "MALFORMED_TOKEN" };

    const [h, p, s] = parts;
    let alg: unknown;
    try {
      alg = JSON.parse(Buffer.from(h, "base64url").toString("utf8"))?.alg;
    } catch {
      return { valid: false, reason: "MALFORMED_TOKEN" };
    }
    const actual = Buffer.from(s, "base64url");
    if (alg === "ES256") {
      if (!this.publicKey || actual.length !== 64 ||
          !verify("sha256", Buffer.from(`${h}.${p}`), { key: this.publicKey, dsaEncoding: "ieee-p1363" }, actual)) {
        return { valid: false, reason: "INVALID_SIGNATURE" };
      }
    } else {
      const expected = this.sign(`${h}.${p}`);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        return { valid: false, reason: "INVALID_SIGNATURE" };
      }
    }

    let header: any;
    let payload: TokenPayload;
    try {
      header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
      payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    } catch {
      return { valid: false, reason: "MALFORMED_PAYLOAD" };
    }
    if (!["HS256", "ES256"].includes(header?.alg) || (header.alg === "ES256") !== (payload?.type === "member") ||
        typeof payload?.uid !== "string" || typeof payload.jti !== "string" ||
        typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return { valid: false, reason: "MALFORMED_PAYLOAD" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) return { valid: false, expired: true, reason: "TOKEN_EXPIRED", payload };
    if (payload.iat > now + (options.maxClockSkewSeconds ?? this.maxClockSkewSeconds)) {
      return { valid: false, futureIat: true, reason: "TOKEN_FUTURE_IAT", payload };
    }
    return { valid: true, payload };
  }

  public mintUserCustomToken(uid: string, zolexoraId: string, email: string): string {
    return this.signJwt({ uid, zolexora_id: zolexoraId, email, type: "user" });
  }

  public mintEmployeeCustomToken(uid: string, claims: CustomTokenClaims, email: string): string {
    return this.signJwt({ uid, email, ...claims, type: "employee" });
  }

  public mintAdminCustomToken(adminId: string, claims: CustomTokenClaims, email: string): string {
    return this.signJwt({ uid: adminId, email, ...claims, type: "platform_admin" });
  }
}
