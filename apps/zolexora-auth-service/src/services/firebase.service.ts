import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { CONSTANTS } from "../config/constants.js";
import { AppError } from "../plugins/error-handler.js";

/**
 * Verifies tokens produced by Firebase on the client:
 *  - Firebase Auth ID tokens (Google sign-in, phone SMS code sign-in / linkWithPhoneNumber)
 *  - Firebase Phone Number Verification (PNV) tokens, when configured
 * Only signatures, issuer, audience and freshness are trusted; nothing else from the client.
 */
export interface FirebaseConfig {
  projectId: string;
  authIssuer: string;
  authJwksUrl: string;
  pnv?: { jwksUrl: string; issuer: string; audience: string };
}

export interface FirebaseIdentity {
  uid: string;
  provider: string; // firebase.sign_in_provider, e.g. "google.com", "phone"
  email?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  name?: string;
}

const rejected = () =>
  new AppError({ statusCode: 401, code: "AUTH_FIREBASE_TOKEN_INVALID", message: "Firebase token is invalid or expired." });

export class FirebaseService {
  private readonly authKeys: JWTVerifyGetKey;
  private readonly pnvKeys?: JWTVerifyGetKey;

  constructor(private readonly config: FirebaseConfig, keys?: { auth: JWTVerifyGetKey; pnv?: JWTVerifyGetKey }) {
    this.authKeys = keys?.auth ?? createRemoteJWKSet(new URL(config.authJwksUrl));
    this.pnvKeys = keys?.pnv ?? (config.pnv ? createRemoteJWKSet(new URL(config.pnv.jwksUrl)) : undefined);
  }

  public get pnvEnabled(): boolean {
    return Boolean(this.config.pnv && this.pnvKeys);
  }

  public async verifyIdToken(token: unknown): Promise<FirebaseIdentity> {
    if (typeof token !== "string" || !token || token.length > 8192) throw rejected();
    const { payload } = await jwtVerify(token, this.authKeys, {
      algorithms: ["RS256"],
      issuer: this.config.authIssuer,
      audience: this.config.projectId,
      maxTokenAge: CONSTANTS.FIREBASE.MAX_TOKEN_AGE_SECONDS,
    }).catch(() => {
      throw rejected();
    });
    const firebase = (payload.firebase ?? {}) as { sign_in_provider?: string };
    if (typeof payload.sub !== "string" || !payload.sub) throw rejected();
    return {
      uid: payload.sub,
      provider: firebase.sign_in_provider ?? "",
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
      emailVerified: payload.email_verified === true,
      phoneNumber: typeof payload.phone_number === "string" ? payload.phone_number : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  }

  /** Returns the verified E.164 phone number carried in a PNV token's subject. */
  public async verifyPnvToken(token: unknown): Promise<string> {
    if (!this.config.pnv || !this.pnvKeys) {
      throw new AppError({ statusCode: 400, code: "AUTH_PNV_UNAVAILABLE", message: "Phone Number Verification is not enabled; use the SMS code." });
    }
    if (typeof token !== "string" || !token || token.length > 8192) throw rejected();
    const { payload } = await jwtVerify(token, this.pnvKeys, {
      issuer: this.config.pnv.issuer,
      audience: this.config.pnv.audience,
      maxTokenAge: CONSTANTS.FIREBASE.MAX_TOKEN_AGE_SECONDS,
    }).catch(() => {
      throw rejected();
    });
    if (typeof payload.sub !== "string" || !payload.sub) throw rejected();
    return payload.sub;
  }
}
