import { describe, it, expect, vi, beforeEach } from 'vitest';
import shieldWorker from '../src/index';
import type { Env } from '../src/types';
import { resetMemoryRateLimiter } from '../src/rate-limiter';

describe('API Shield Worker Integration', () => {
  const env: Env = {
    ENVIRONMENT: 'test',
    TMS_ORIGIN: 'http://127.0.0.1:4030',
    MARKETPLACE_ORIGIN: 'http://127.0.0.1:8000',
    ADMIN_ORIGIN: 'http://127.0.0.1:4000',
    DEFAULT_ORIGIN: 'http://127.0.0.1:4030',
    GENERAL_RATE_LIMIT: '50',
    SENSITIVE_RATE_LIMIT: '5',
    RATE_LIMIT_WINDOW_SECONDS: '60',
    MAX_THREAT_SCORE: '40',
  };

  const mockCtx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
    tracing: {} as unknown,
  } as unknown as ExecutionContext;

  beforeEach(() => {
    resetMemoryRateLimiter();
    vi.restoreAllMocks();
  });

  it('should serve /__shield/health with status 200 and shield metadata', async () => {
    const req = new Request('https://api.zolexora.com/__shield/health', {
      headers: { Origin: 'https://tms.zolexora.com' },
    });

    const res = await shieldWorker.fetch(req, env, mockCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tms.zolexora.com');

    const data = await res.json() as { status: string; service: string; rate_limits: { general: number; sensitive: number } };
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('@zolexora/api-shield');
    expect(data.rate_limits.general).toBe(50);
    expect(data.rate_limits.sensitive).toBe(5);
  });

  it('should terminate OPTIONS preflight at the edge with 204 without contacting origin', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const req = new Request('https://api.zolexora.com/api/v1/tms/drivers', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://tms.zolexora.com',
        'Access-Control-Request-Method': 'POST',
      },
    });

    const res = await shieldWorker.fetch(req, env, mockCtx);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tms.zolexora.com');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    // Origin fetch was never invoked!
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should block malicious user agents with 403', async () => {
    const req = new Request('https://api.zolexora.com/api/v1/tms/drivers', {
      headers: { 'User-Agent': 'sqlmap/1.5-dev' },
    });

    const res = await shieldWorker.fetch(req, env, mockCtx);
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Forbidden');
  });

  it('should block path traversal attacks with 400', async () => {
    const req = new Request('https://api.zolexora.com/etc/shadow');
    const res = await shieldWorker.fetch(req, env, mockCtx);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Bad Request');
  });

  it('should forward legitimate requests to backend origin with proxy and rate limit headers', async () => {
    // Mock the upstream backend response
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (info: RequestInfo | URL) => {
      const urlStr = typeof info === 'string' ? info : info.toString();
      expect(urlStr).toContain('http://127.0.0.1:4030/api/v1/tms/trips');

      return new Response(JSON.stringify({ trips: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const req = new Request('https://api.zolexora.com/api/v1/tms/trips', {
      headers: {
        Origin: 'https://tms.zolexora.com',
        'CF-Connecting-IP': '203.0.113.88',
      },
    });

    const res = await shieldWorker.fetch(req, env, mockCtx);
    expect(res.status).toBe(200);

    // Verify rate limit headers injected by shield
    expect(res.headers.get('X-RateLimit-Limit')).toBe('50');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('49');
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();

    // Verify CORS headers injected by shield
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tms.zolexora.com');
  });

  it('should route marketplace path to MARKETPLACE_ORIGIN', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (info: RequestInfo | URL) => {
      const urlStr = typeof info === 'string' ? info : info.toString();
      expect(urlStr).toContain('http://127.0.0.1:8000/api/v1/marketplace/catalog');
      return new Response(JSON.stringify({ products: [] }), { status: 200 });
    });

    const req = new Request('https://api.zolexora.com/api/v1/marketplace/catalog', {
      headers: { 'CF-Connecting-IP': '203.0.113.89' },
    });

    const res = await shieldWorker.fetch(req, env, mockCtx);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('should enforce 429 when rate limit is exceeded', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const ip = '198.51.100.77';

    // Sensitive limit is 5 in this test environment
    for (let i = 0; i < 5; i++) {
      const req = new Request('https://api.zolexora.com/api/v1/auth/login', {
        headers: { 'CF-Connecting-IP': ip },
      });
      const res = await shieldWorker.fetch(req, env, mockCtx);
      expect(res.status).toBe(200);
    }

    // 6th request triggers 429
    const blockedReq = new Request('https://api.zolexora.com/api/v1/auth/login', {
      headers: {
        'CF-Connecting-IP': ip,
        Origin: 'https://tms.zolexora.com',
      },
    });

    const res = await shieldWorker.fetch(blockedReq, env, mockCtx);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tms.zolexora.com');
  });
});
