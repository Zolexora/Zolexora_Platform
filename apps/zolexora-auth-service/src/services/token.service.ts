import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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
  type?: "user" | "employee" | "platform_admin";
  iat: number;
  exp: number;
}

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
    public readonly maxClockSkewSeconds: number = CONSTANTS.TOKEN.CLOCK_SKEW_TOLERANCE_SECONDS,
  ) {
    if (!secret) throw new Error("[CONFIG_FATAL] SESSION_SECRET must come from Infisical");
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
    const expected = this.sign(`${h}.${p}`);
    const actual = Buffer.from(s, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return { valid: false, reason: "INVALID_SIGNATURE" };
    }

    let header: any;
    let payload: TokenPayload;
    try {
      header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
      payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    } catch {
      return { valid: false, reason: "MALFORMED_PAYLOAD" };
    }
    if (header?.alg !== "HS256" || typeof payload?.uid !== "string" || typeof payload.jti !== "string" ||
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
