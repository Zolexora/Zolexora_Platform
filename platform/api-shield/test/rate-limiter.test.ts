import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyRoute,
  extractClientIp,
  evaluateRateLimit,
  createRateLimitExceededResponse,
  resetMemoryRateLimiter,
} from '../src/rate-limiter';
import type { Env } from '../src/types';

describe('Sliding-Window Rate Limiter', () => {
  const mockEnv: Env = {
    GENERAL_RATE_LIMIT: '100',
    SENSITIVE_RATE_LIMIT: '15',
    RATE_LIMIT_WINDOW_SECONDS: '60',
  };

  beforeEach(() => {
    resetMemoryRateLimiter();
  });

  describe('classifyRoute', () => {
    it('should correctly classify sensitive authentication and onboarding routes', () => {
      expect(classifyRoute('/api/v1/auth/login')).toBe('sensitive');
      expect(classifyRoute('/auth/token')).toBe('sensitive');
      expect(classifyRoute('/api/v1/onboarding/organization')).toBe('sensitive');
      expect(classifyRoute('/onboarding/setup')).toBe('sensitive');
      expect(classifyRoute('/register')).toBe('sensitive');
      expect(classifyRoute('/login')).toBe('sensitive');
      expect(classifyRoute('/forgot-password')).toBe('sensitive');
    });

    it('should identify exempt health check endpoints', () => {
      expect(classifyRoute('/__shield/health')).toBe('exempt');
      expect(classifyRoute('/health')).toBe('exempt');
      expect(classifyRoute('/favicon.ico')).toBe('exempt');
    });

    it('should classify standard business endpoints as general', () => {
      expect(classifyRoute('/api/v1/tms/shipments')).toBe('general');
      expect(classifyRoute('/api/v1/marketplace/search')).toBe('general');
      expect(classifyRoute('/api/v1/admin/tenants')).toBe('general');
    });
  });

  describe('extractClientIp', () => {
    it('should prioritize cf-connecting-ip', () => {
      const req = new Request('https://api.zolexora.com', {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 192.0.2.1',
        },
      });
      expect(extractClientIp(req)).toBe('203.0.113.195');
    });

    it('should fallback to first entry in x-forwarded-for', () => {
      const req = new Request('https://api.zolexora.com', {
        headers: {
          'x-forwarded-for': '198.51.100.1, 192.0.2.1',
        },
      });
      expect(extractClientIp(req)).toBe('198.51.100.1');
    });

    it('should fallback to 127.0.0.1 when no headers present', () => {
      const req = new Request('https://api.zolexora.com');
      expect(extractClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('evaluateRateLimit thresholds', () => {
    it('should enforce sensitive rate limit of 15 requests per minute', async () => {
      const clientIp = '198.51.100.42';

      // Send 15 requests on sensitive route
      for (let i = 0; i < 15; i++) {
        const req = new Request('https://api.zolexora.com/api/v1/auth/login', {
          headers: { 'cf-connecting-ip': clientIp },
        });
        const res = await evaluateRateLimit(req, mockEnv);
        expect(res.allowed).toBe(true);
        expect(res.limit).toBe(15);
        expect(res.remaining).toBe(15 - (i + 1));
      }

      // 16th request must be blocked
      const blockedReq = new Request('https://api.zolexora.com/api/v1/auth/login', {
        headers: { 'cf-connecting-ip': clientIp },
      });
      const blockedRes = await evaluateRateLimit(blockedReq, mockEnv);
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.retryAfter).toBeGreaterThan(0);
    });

    it('should allow up to general rate limit on general routes', async () => {
      const clientIp = '198.51.100.99';
      const customEnv: Env = {
        ...mockEnv,
        GENERAL_RATE_LIMIT: '5',
      };

      for (let i = 0; i < 5; i++) {
        const req = new Request('https://api.zolexora.com/api/v1/tms/trips', {
          headers: { 'cf-connecting-ip': clientIp },
        });
        const res = await evaluateRateLimit(req, customEnv);
        expect(res.allowed).toBe(true);
      }

      // 6th request blocked
      const blockedReq = new Request('https://api.zolexora.com/api/v1/tms/trips', {
        headers: { 'cf-connecting-ip': clientIp },
      });
      const blockedRes = await evaluateRateLimit(blockedReq, customEnv);
      expect(blockedRes.allowed).toBe(false);
    });

    it('should never rate limit exempt routes', async () => {
      const clientIp = '198.51.100.12';

      for (let i = 0; i < 30; i++) {
        const req = new Request('https://api.zolexora.com/__shield/health', {
          headers: { 'cf-connecting-ip': clientIp },
        });
        const res = await evaluateRateLimit(req, mockEnv);
        expect(res.allowed).toBe(true);
      }
    });

    it('should generate proper 429 response structure', async () => {
      const result = {
        allowed: false,
        limit: 15,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 45,
        retryAfter: 45,
        ip: '198.51.100.1',
        endpointType: 'sensitive' as const,
      };

      const res = createRateLimitExceededResponse(result);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('45');
      expect(res.headers.get('X-RateLimit-Limit')).toBe('15');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');

      const body = await res.json() as { error: string; retry_after: number };
      expect(body.error).toBe('Too Many Requests');
      expect(body.retry_after).toBe(45);
    });
  });
});
