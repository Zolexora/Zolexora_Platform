import { AppError } from "../plugins/error-handler.js";
import { RateLimitConfig } from "./rate-limit.service.js";
import { SecurityStore } from "../stores/security.store.js";

/**
 * Track 2 login lockout kept in Postgres, so every replica sees it (ADR 0005 §6.3).
 * Same rule as RateLimitService: N failures inside the window lock the key; a success clears it.
 */
export class LockoutService {
  constructor(private readonly store: SecurityStore, private readonly config: RateLimitConfig) {}

  async check(keys: string[]): Promise<void> {
    const now = Date.now();
    const since = new Date(now - Math.max(this.config.windowSeconds, this.config.lockoutSeconds) * 1000);
    for (const key of keys) {
      const { count, last } = await this.store.failuresSince(key, since);
      if (count < this.config.maxAttempts || !last) continue;
      const until = new Date(last).getTime() + this.config.lockoutSeconds * 1000;
      if (until <= now) continue;
      const retry = Math.max(1, Math.ceil((until - now) / 1000));
      throw new AppError({
        statusCode: 429,
        code: "AUTH_RATE_LIMITED",
        message: "Rate limit exceeded. Too many failed attempts.",
        details: { retry_after_seconds: retry },
        headers: { "Retry-After": String(retry) },
      });
    }
  }

  failure = (keys: string[], ip: string | null) => this.store.recordAttempt(keys, false, ip);
  success = (keys: string[], ip: string | null) => this.store.recordAttempt(keys, true, ip);
}
