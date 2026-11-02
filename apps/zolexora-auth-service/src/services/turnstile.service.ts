import { AppError } from "../plugins/error-handler.js";

export interface VerifyTurnstileOptions {
  remoteIp?: string;
  expectedAction?: string;
  idempotencyKey?: string;
}

export interface TurnstileServiceConfig {
  timeoutMs: number;
  expectedHostnames: string[];
}

const fail = (message: string, code = "AUTH_TURNSTILE_FAILED") =>
  new AppError({ statusCode: 403, code, message: `Turnstile verification failed: ${message}` });

/** Verifies every token with Cloudflare siteverify. There are no local shortcuts. */
export class TurnstileService {
  private readonly expectedHostnames: Set<string>;

  constructor(
    private readonly secretKey: string,
    private readonly verifyUrl: string,
    private readonly config: TurnstileServiceConfig,
  ) {
    this.expectedHostnames = new Set(config.expectedHostnames);
  }

  public async verifyToken(token?: string | null, options: VerifyTurnstileOptions = {}): Promise<void> {
    const trimmed = typeof token === "string" ? token.trim() : "";
    if (!trimmed) {
      throw new AppError({
        statusCode: 400,
        code: "AUTH_TURNSTILE_REQUIRED",
        message: "Turnstile verification failed: Token is missing.",
      });
    }
    // Cloudflare tokens are at most 2048 characters.
    if (trimmed.length > 2048) throw fail("Token exceeds maximum permitted length.");

    const form = new URLSearchParams({ secret: this.secretKey, response: trimmed });
    if (options.remoteIp) form.append("remoteip", options.remoteIp);
    if (options.idempotencyKey) form.append("idempotency_key", options.idempotencyKey);

    let data: { success: boolean; "error-codes"?: string[]; hostname?: string; action?: string };
    try {
      const res = await fetch(this.verifyUrl, {
        method: "POST",
        body: form,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!res.ok) throw fail(`Gateway rejected token with status ${res.status}.`);
      data = (await res.json()) as typeof data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err?.name === "AbortError" || err?.name === "TimeoutError") {
        throw fail("Network timeout contacting verification gateway.");
      }
      throw fail("Unexpected remote error.");
    }

    if (!data.success) {
      const codes = data["error-codes"] ?? [];
      if (codes.includes("timeout-or-duplicate")) {
        throw fail("Token expired or already consumed.", "AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE");
      }
      throw fail(codes.join(", ") || "Token validation rejected by Cloudflare.");
    }
    if (options.expectedAction && data.action !== options.expectedAction) {
      throw fail(`Action mismatch (expected "${options.expectedAction}", received "${data.action}").`);
    }
    if (!data.hostname || !this.expectedHostnames.has(data.hostname)) {
      throw fail(`Hostname "${data.hostname}" is not authorized.`);
    }
  }
}
