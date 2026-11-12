import { AppError } from "../plugins/error-handler.js";

export interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
  lockoutSeconds: number;
}

interface Entry {
  lockedUntil: number;
  timestamps: number[];
}

// Per-instance sliding window. Run behind a single replica or front it with a shared limiter.
export class RateLimitService {
  private store = new Map<string, Entry>();

  constructor(private readonly config: RateLimitConfig) {}

  private limited(retryAfter: number): AppError {
    return new AppError({
      statusCode: 429,
      code: "AUTH_RATE_LIMITED",
      message: "Rate limit exceeded. Too many failed attempts.",
      details: { retry_after_seconds: retryAfter },
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  private prune(entry: Entry, now: number): void {
    const windowMs = this.config.windowSeconds * 1000;
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  }

  public checkAllowed(key: string): void {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return;
    if (entry.lockedUntil > now) throw this.limited(Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)));

    this.prune(entry, now);
    if (entry.timestamps.length === 0) {
      this.store.delete(key);
      return;
    }
    if (entry.timestamps.length >= this.config.maxAttempts) {
      entry.lockedUntil = now + this.config.lockoutSeconds * 1000;
      throw this.limited(this.config.lockoutSeconds);
    }
  }

  public recordFailure(key: string): void {
    const now = Date.now();
    const entry = this.store.get(key) ?? { lockedUntil: 0, timestamps: [] };
    this.store.set(key, entry);
    this.prune(entry, now);
    entry.timestamps.push(now);
    if (entry.timestamps.length >= this.config.maxAttempts) {
      entry.lockedUntil = now + this.config.lockoutSeconds * 1000;
    }
  }

  public recordSuccess(key: string): void {
    this.store.delete(key);
  }

  public pruneExpired(now = Date.now()): void {
    for (const [key, entry] of this.store) {
      if (entry.lockedUntil > now) continue;
      this.prune(entry, now);
      if (entry.timestamps.length === 0) this.store.delete(key);
    }
  }
}
