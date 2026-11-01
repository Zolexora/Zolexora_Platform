/**
 * Sliding Window Token-Bucket Rate Limiter
 * Free-tier optimized: In-memory sliding-window counter with sub-millisecond execution,
 * zero network overhead, and asynchronous KV synchronization.
 */

import type { Env, RateLimitResult } from './types';

// Sensitive route prefixes requiring stricter rate limits (15 req/min)
const SENSITIVE_ROUTE_PATTERNS: RegExp[] = [
  /^\/api\/v[0-9]+\/auth(\/.*)?$/i,
  /^\/auth(\/.*)?$/i,
  /^\/api\/v[0-9]+\/onboarding(\/.*)?$/i,
  /^\/onboarding(\/.*)?$/i,
  /^\/(login|register|signup|forgot-password|reset-password|token)$/i,
];

// Exempt route patterns
const EXEMPT_ROUTE_PATTERNS: RegExp[] = [
  /^\/__shield\/health$/i,
  /^\/health$/i,
  /^\/favicon\.ico$/i,
];

interface WindowEntry {
  currentWindow: number;
  currentCount: number;
  previousCount: number;
}

// In-memory LRU counter map per isolate (handles fast local spikes at $0 cost)
const memoryRateLimitStore = new Map<string, WindowEntry>();
let requestCountSincePrune = 0;

/**
 * Extracts the client IP from Cloudflare or forwarder headers.
 */
export function extractClientIp(request: Request): string {
  // 1. Direct Cloudflare connecting IP (spoof-proof on Cloudflare Edge)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  // 2. Standard X-Forwarded-For header
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // 3. X-Real-IP
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  // Fallback
  return '127.0.0.1';
}

/**
 * Determines whether a route is sensitive, general, or exempt from rate limiting.
 */
export function classifyRoute(pathname: string): 'sensitive' | 'general' | 'exempt' {
  if (EXEMPT_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return 'exempt';
  }
  if (SENSITIVE_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return 'sensitive';
  }
  return 'general';
}

/**
 * Prunes expired windows to prevent memory exhaustion in the isolate.
 */
function pruneExpiredEntries(currentWindow: number): void {
  for (const [key, entry] of memoryRateLimitStore.entries()) {
    if (entry.currentWindow < currentWindow - 2) {
      memoryRateLimitStore.delete(key);
    }
  }
}

/**
 * Sliding Window Rate Limit Evaluator.
 * Returns rate limit decision, remaining quota, reset timestamp, and retry-after.
 */
export async function evaluateRateLimit(
  request: Request,
  env: Env,
  ctx?: ExecutionContext
): Promise<RateLimitResult> {
  const url = new URL(request.url);
  const endpointType = classifyRoute(url.pathname);
  const ip = extractClientIp(request);

  const windowSeconds = parseInt(env.RATE_LIMIT_WINDOW_SECONDS || '60', 10);
  const generalLimit = parseInt(env.GENERAL_RATE_LIMIT || '100', 10);
  const sensitiveLimit = parseInt(env.SENSITIVE_RATE_LIMIT || '15', 10);

  // Exempt routes bypass rate limits immediately
  if (endpointType === 'exempt') {
    return {
      allowed: true,
      limit: generalLimit,
      remaining: generalLimit,
      reset: Math.floor(Date.now() / 1000) + windowSeconds,
      retryAfter: 0,
      ip,
      endpointType,
    };
  }

  const limit = endpointType === 'sensitive' ? sensitiveLimit : generalLimit;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentWindowIndex = Math.floor(nowSeconds / windowSeconds);
  const windowKey = `${ip}:${endpointType}`;

  // Periodic pruning of in-memory store
  requestCountSincePrune++;
  if (requestCountSincePrune >= 1000 || memoryRateLimitStore.size > 5000) {
    pruneExpiredEntries(currentWindowIndex);
    requestCountSincePrune = 0;
  }

  let entry = memoryRateLimitStore.get(windowKey);
  if (!entry) {
    entry = {
      currentWindow: currentWindowIndex,
      currentCount: 0,
      previousCount: 0,
    };
    memoryRateLimitStore.set(windowKey, entry);
  } else if (entry.currentWindow === currentWindowIndex - 1) {
    // Window rolled over to the next 60s bucket
    entry.previousCount = entry.currentCount;
    entry.currentCount = 0;
    entry.currentWindow = currentWindowIndex;
  } else if (entry.currentWindow < currentWindowIndex - 1) {
    // Window rolled over past one full period
    entry.previousCount = 0;
    entry.currentCount = 0;
    entry.currentWindow = currentWindowIndex;
  }

  // Calculate sliding window weighted count
  const timeInCurrentWindow = nowSeconds % windowSeconds;
  const weight = (windowSeconds - timeInCurrentWindow) / windowSeconds;
  const estimatedCount = entry.previousCount * weight + entry.currentCount;

  const resetTimestamp = (currentWindowIndex + 1) * windowSeconds;
  const retryAfter = Math.max(1, resetTimestamp - nowSeconds);

  if (estimatedCount + 1 > limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: resetTimestamp,
      retryAfter,
      ip,
      endpointType,
    };
  }

  // Quota allowed: increment counter
  entry.currentCount += 1;
  const remaining = Math.max(0, Math.floor(limit - (estimatedCount + 1)));

  // If KV is bound and ctx is available, sync to KV in background without blocking response latency
  if (env.RATE_LIMIT_KV && ctx) {
    const kvKey = `rl:${windowKey}:${currentWindowIndex}`;
    ctx.waitUntil(
      env.RATE_LIMIT_KV.put(kvKey, entry.currentCount.toString(), {
        expirationTtl: windowSeconds * 2,
      }).catch(() => {
        // Suppress background KV write errors on quota exhaustion
      })
    );
  }

  return {
    allowed: true,
    limit,
    remaining,
    reset: resetTimestamp,
    retryAfter: 0,
    ip,
    endpointType,
  };
}

/**
 * Creates an HTTP 429 response when rate limit is exceeded.
 */
export function createRateLimitExceededResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: `Rate limit of ${result.limit} requests per minute exceeded for this endpoint.`,
      retry_after: result.retryAfter,
      limit: result.limit,
      remaining: 0,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.retryAfter.toString(),
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.reset.toString(),
      },
    }
  );
}

/**
 * Attaches X-RateLimit headers to allowed responses.
 */
export function addRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.reset.toString());
}

/**
 * Helper to reset in-memory rate limiter state (useful for tests).
 */
export function resetMemoryRateLimiter(): void {
  memoryRateLimitStore.clear();
  requestCountSincePrune = 0;
}
