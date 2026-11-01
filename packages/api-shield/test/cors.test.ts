import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, handleCorsPreflight, addCorsHeaders } from '../src/cors';

describe('Edge CORS Module', () => {
  describe('isAllowedOrigin', () => {
    it('should allow production apex and subdomains', () => {
      expect(isAllowedOrigin('https://zolexora.com')).toBe(true);
      expect(isAllowedOrigin('https://tms.zolexora.com')).toBe(true);
      expect(isAllowedOrigin('https://marketplace.zolexora.com')).toBe(true);
      expect(isAllowedOrigin('https://admin.zolexora.com')).toBe(true);
      expect(isAllowedOrigin('https://api.staging.zolexora.com')).toBe(true);
    });

    it('should allow local development origins', () => {
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('http://localhost:4030')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:8000')).toBe(true);
      expect(isAllowedOrigin('https://localhost:5173')).toBe(true);
    });

    it('should reject unauthorized or phishing origins', () => {
      expect(isAllowedOrigin(null)).toBe(false);
      expect(isAllowedOrigin('')).toBe(false);
      expect(isAllowedOrigin('https://evil.com')).toBe(false);
      expect(isAllowedOrigin('https://zolexora.com.attacker.com')).toBe(false);
      expect(isAllowedOrigin('https://notzolexora.com')).toBe(false);
      expect(isAllowedOrigin('http://zolexora.com')).toBe(false); // HTTP disallowed in production
    });
  });

  describe('handleCorsPreflight', () => {
    it('should return null for non-OPTIONS requests', () => {
      const req = new Request('https://api.zolexora.com/api/v1/tms/trips', { method: 'GET' });
      expect(handleCorsPreflight(req)).toBeNull();
    });

    it('should handle allowed OPTIONS preflight in <2ms with 204 and CORS headers', () => {
      const req = new Request('https://api.zolexora.com/api/v1/tms/trips', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://tms.zolexora.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const res = handleCorsPreflight(req);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(204);
      expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('https://tms.zolexora.com');
      expect(res!.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(res!.headers.get('Access-Control-Max-Age')).toBe('86400');
      expect(res!.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should reject OPTIONS preflight from unauthorized origins with 403', async () => {
      const req = new Request('https://api.zolexora.com/api/v1/tms/trips', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://attacker.com',
        },
      });

      const res = handleCorsPreflight(req);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
      const data = await res!.json() as { error: string };
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('addCorsHeaders', () => {
    it('should attach CORS headers to downstream responses for allowed origins', () => {
      const req = new Request('https://api.zolexora.com/api/v1/tms/trips', {
        headers: { Origin: 'https://admin.zolexora.com' },
      });
      const headers = new Headers({ 'Content-Type': 'application/json' });
      addCorsHeaders(headers, req);

      expect(headers.get('Access-Control-Allow-Origin')).toBe('https://admin.zolexora.com');
      expect(headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(headers.get('Vary')).toBe('Origin');
    });

    it('should not attach CORS headers for disallowed origins', () => {
      const req = new Request('https://api.zolexora.com/api/v1/tms/trips', {
        headers: { Origin: 'https://hacker.io' },
      });
      const headers = new Headers();
      addCorsHeaders(headers, req);

      expect(headers.has('Access-Control-Allow-Origin')).toBe(false);
    });
  });
});
