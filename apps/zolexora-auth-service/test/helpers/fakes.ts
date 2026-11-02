// TEST ONLY fakes for external services. These fixtures used to live in src/ — they must never ship.
import { buildApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { AppError } from "../../src/plugins/error-handler.js";
import { MailService } from "../../src/services/mail.service.js";
import { TokenService } from "../../src/services/token.service.js";
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

export async function buildTestApp(repo = new InMemoryAuthRepository(), mail = new FakeMail()) {
  const app = await buildApp({ repo, mail, turnstile: new FakeTurnstile(), logger: false });
  await app.ready();
  return Object.assign(app, { mail });
}
