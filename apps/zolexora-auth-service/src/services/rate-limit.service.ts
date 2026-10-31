import { CONSTANTS } from "../config/constants.js";
import { AppError } from "../plugins/error-handler.js";

export interface RateLimitEntry {
  failures: number;
  lockedUntil: number;
  timestamps: number[];
}

export class RateLimitService {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxAttempts = CONSTANTS.RATE_LIMIT.MAX_FAILURES;
  private readonly windowMs = CONSTANTS.RATE_LIMIT.WINDOW_MS;
  private readonly lockoutSeconds = CONSTANTS.RATE_LIMIT.LOCKOUT_SECONDS;

  public checkAllowed(key: string): void {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return;

    // 1. Check active lockout
    if (entry.lockedUntil > now) {
      const retryAfter = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
      throw new AppError({
        statusCode: 429,
        code: "AUTH_RATE_LIMITED",
        message: "Rate limit exceeded. Too many failed attempts.",
        details: { retry_after_seconds: retryAfter },
        headers: { "Retry-After": String(retryAfter) },
      });
    }

    // 2. Sliding-window timestamp pruning
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    // Opportunistic cleanup: remove stale expired entries from memory
    if (entry.timestamps.length === 0 && entry.lockedUntil <= now) {
      this.store.delete(key);
      return;
    }

    if (entry.timestamps.length >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockoutSeconds * 1000;
      throw new AppError({
        statusCode: 429,
        code: "AUTH_RATE_LIMITED",
        message: "Rate limit exceeded. Too many failed attempts.",
        details: { retry_after_seconds: this.lockoutSeconds },
        headers: { "Retry-After": String(this.lockoutSeconds) },
      });
    }
  }

  public recordFailure(key: string): void {
    const now = Date.now();
    let entry = this.store.get(key);
    if (!entry) {
      entry = { failures: 0, lockedUntil: 0, timestamps: [] };
      this.store.set(key, entry);
    }

    // Prune timestamps older than sliding window BEFORE checking threshold
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
    entry.failures++;
    entry.timestamps.push(now);

    if (entry.timestamps.length >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockoutSeconds * 1000;
    }
  }

  public recordSuccess(key: string): void {
    this.store.delete(key);
  }

  public pruneExpired(now = Date.now()): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.lockedUntil <= now) {
        entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
        if (entry.timestamps.length === 0) {
          this.store.delete(key);
        }
      }
    }
  }

  public reset(): void {
    this.store.clear();
  }
}
