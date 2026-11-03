import { createHmac } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { AppError } from "../plugins/error-handler.js";

/**
 * Short-lived signed record of the sign-up steps a new user has completed (verified email,
 * verified phone, Google identity). It is signed with a key derived from SESSION_SECRET for this
 * purpose only, so it can never be used as a session token and vice versa.
 */
export interface SignupFacts {
  email?: string;
  phone_number?: string;
  /** False when the number was typed in without PNV/SMS (MOBILE_OTP_VERIFICATION=false). */
  phone_verified?: boolean;
  firebase_uid?: string;
  /** How the user started: decides which steps are required. */
  started_with: "email" | "phone" | "google";
}

const AUDIENCE = "zolexora-track1-signup";

const invalidTicket = () =>
  new AppError({ statusCode: 401, code: "AUTH_SIGNUP_TOKEN_INVALID", message: "Sign-up session expired. Please start again." });

export class SignupTicketService {
  private readonly key: Uint8Array;

  constructor(sessionSecret: string, private readonly ttlSeconds: number) {
    this.key = createHmac("sha256", sessionSecret).update("zolexora:track1-signup-ticket").digest();
  }

  public issue(facts: SignupFacts): Promise<string> {
    return new SignJWT({ ...facts })
      .setProtectedHeader({ alg: "HS256", typ: "signup" })
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.key);
  }

  public async read(token: unknown): Promise<SignupFacts> {
    if (typeof token !== "string" || !token) throw invalidTicket();
    const { payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"], audience: AUDIENCE, typ: "signup" }).catch(() => {
      throw invalidTicket();
    });
    const { email, phone_number, phone_verified, firebase_uid, started_with } = payload as Record<string, any>;
    if (!["email", "phone", "google"].includes(started_with)) throw invalidTicket();
    return { email, phone_number, phone_verified, firebase_uid, started_with };
  }
}
