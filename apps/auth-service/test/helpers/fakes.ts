// TEST ONLY fakes for external services. These fixtures used to live in src/ — they must never ship.
import { AwsClient } from "aws4fetch";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { buildApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { AppError } from "../../src/plugins/error-handler.js";
import { MailService } from "../../src/services/mail.service.js";
import { TokenService } from "../../src/services/token.service.js";
import { FirebaseService } from "../../src/services/firebase.service.js";
import { TurnstileService, VerifyTurnstileOptions } from "../../src/services/turnstile.service.js";
import { InMemoryAuthRepository } from "./in-memory-auth.repository.js";

export const TURNSTILE = {
  VALID_TOKEN: "0.valid-cf-turnstile-token",
  TIMEOUT_DUPLICATE_TOKEN: "0.timeout-or-duplicate-token",
  INVALID_TOKEN: "0.invalid-cf-turnstile-token",
};

const fail = (message: string, code = "AUTH_TURNSTILE_FAILED") =>
  new AppError({ statusCode: 403, code, message: `Turnstile verification failed: ${message}` });

/** Emulates Cloudflare siteverify with fixture tokens. */
export class FakeTurnstile extends TurnstileService {
  constructor() {
    super("fake", "https://turnstile.test/siteverify", { timeoutMs: 1, expectedHostnames: env.TURNSTILE_EXPECTED_HOSTNAMES });
  }

  override async verifyToken(token?: string | null, options: VerifyTurnstileOptions = {}): Promise<void> {
    const t = typeof token === "string" ? token.trim() : "";
    if (!t) {
      throw new AppError({ statusCode: 400, code: "AUTH_TURNSTILE_REQUIRED", message: "Turnstile verification failed: Token is missing." });
    }
    if (t.length > 2048) throw fail("Token exceeds maximum permitted length.");
    if (t.includes("timeout-or-duplicate")) throw fail("Token expired or already consumed.", "AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE");
    const valid = t.startsWith("0.valid") || t === "1x00000000000000000000AA" || t.startsWith("mock_valid_") || t.startsWith("test_valid_");
    if (!valid) throw fail("Invalid bot defense token.");
    if (t.includes("action-mismatch")) throw fail(`Action mismatch (expected "${options.expectedAction}").`);
    if (t.includes("hostname-mismatch")) throw fail("Hostname is not authorized.");
  }
}

/** Captures outgoing email instead of calling Resend. */
export class FakeMail extends MailService {
  public sent: { to: string; subject: string; text: string }[] = [];

  constructor() {
    super({ apiUrl: "https://mail.test", apiKey: "fake", from: "test@zolexora.test" });
  }

  override async send(to: string, subject: string, text: string): Promise<void> {
    this.sent.push({ to, subject, text });
  }

  /** Latest 6-digit code emailed to `to`. */
  public lastCode(to: string): string | undefined {
    const mail = [...this.sent].reverse().find((m) => m.to === to);
    return mail?.subject.match(/\d{6}/)?.[0];
  }
}

export const testTokens = () => new TokenService(env.SESSION_SECRET, env.TOKEN_TTL_SECONDS);

// Local stand-ins for Google's Firebase signing keys: real signatures, verified by the real FirebaseService.
const authKey = await generateKeyPair("RS256");
const pnvKey = await generateKeyPair("ES256");
const jwkSet = async (key: CryptoKey, alg: string) => createLocalJWKSet({ keys: [{ ...(await exportJWK(key)), kid: alg, alg }] });
const authJwks = await jwkSet(authKey.publicKey, "RS256");
const pnvJwks = await jwkSet(pnvKey.publicKey, "ES256");

export const testFirebase = (withPnv = true) =>
  new FirebaseService(
    {
      projectId: env.FIREBASE_PROJECT_ID,
      authIssuer: env.FIREBASE_AUTH_ISSUER,
      authJwksUrl: env.FIREBASE_AUTH_JWKS_URL,
      pnv: withPnv ? { jwksUrl: env.FIREBASE_PNV_JWKS_URL!, issuer: env.FIREBASE_PNV_ISSUER!, audience: env.FIREBASE_PNV_AUDIENCE! } : undefined,
    },
    { auth: authJwks, pnv: withPnv ? pnvJwks : undefined },
  );

interface IdTokenOptions {
  uid?: string;
  provider?: "google.com" | "phone" | "password";
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  name?: string;
  issuer?: string;
  audience?: string;
  issuedAt?: number;
}

/** A Firebase Auth ID token, as returned by `user.getIdToken()` on the client. */
export function firebaseIdToken(o: IdTokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = { firebase: { sign_in_provider: o.provider ?? "google.com" } };
  if (o.email) Object.assign(claims, { email: o.email, email_verified: o.emailVerified ?? true });
  if (o.phoneNumber) claims.phone_number = o.phoneNumber;
  if (o.name) claims.name = o.name;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "RS256" })
    .setIssuer(o.issuer ?? env.FIREBASE_AUTH_ISSUER)
    .setAudience(o.audience ?? env.FIREBASE_PROJECT_ID)
    .setSubject(o.uid ?? `fb_${Math.random().toString(36).slice(2)}`)
    .setIssuedAt(o.issuedAt ?? now)
    .setExpirationTime((o.issuedAt ?? now) + 3600)
    .sign(authKey.privateKey);
}

/** A Firebase Phone Number Verification token whose subject is the verified number. */
export function pnvToken(phoneNumber: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: "ES256" })
    .setIssuer(env.FIREBASE_PNV_ISSUER!)
    .setAudience(env.FIREBASE_PNV_AUDIENCE!)
    .setSubject(phoneNumber)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pnvKey.privateKey);
}

export async function buildTestApp(
  repo = new InMemoryAuthRepository(),
  mail = new FakeMail(),
  extra: { mobileVerificationRequired?: boolean; firebase?: FirebaseService } = {},
) {
  const app = await buildApp({ repo, mail, turnstile: new FakeTurnstile(), firebase: extra.firebase ?? testFirebase(), mobileVerificationRequired: extra.mobileVerificationRequired, logger: false });
  await app.ready();
  return Object.assign(app, { mail });
}

/** Recomputes a SigV4 presigned GET URL with the configured credentials and checks the signature. */
export async function verifyPresignedUrl(signedUrl: string): Promise<boolean> {
  const url = new URL(signedUrl);
  const signature = url.searchParams.get("X-Amz-Signature");
  const datetime = url.searchParams.get("X-Amz-Date");
  const expires = url.searchParams.get("X-Amz-Expires");
  if (!signature || !datetime || !expires) return false;
  const client = new AwsClient({
    accessKeyId: env.KYC_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.KYC_STORAGE_SECRET_ACCESS_KEY,
    region: env.KYC_STORAGE_S3_REGION,
    service: "s3",
  });
  const resigned = await client.sign(`${url.origin}${url.pathname}?X-Amz-Expires=${expires}`, {
    method: "GET",
    aws: { signQuery: true, datetime },
  });
  return new URL(resigned.url).searchParams.get("X-Amz-Signature") === signature;
}
