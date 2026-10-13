import { describe, it, expect } from 'vitest';
import { checkThreat } from '../src/threat-filter';

describe('Threat & Bot Filter Module', () => {
  it('should pass legitimate API requests', () => {
    const legitimateUrls = [
      'https://api.zolexora.com/api/v1/tms/trips',
      'https://api.zolexora.com/api/v1/marketplace/search?q=phone',
      'https://api.zolexora.com/api/v1/auth/login',
      'https://api.zolexora.com/__shield/health',
      'https://api.zolexora.com/health',
    ];

    for (const url of legitimateUrls) {
      const req = new Request(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      });
      const result = checkThreat(req, 40);
      expect(result.blocked).toBe(false);
    }
  });

  it('should block elevated Cloudflare threat score (> 40)', () => {
    const req = new Request('https://api.zolexora.com/api/v1/marketplace/search');
    // Simulate Cloudflare Edge cf metadata
    Object.defineProperty(req, 'cf', {
      value: { threatScore: 65 },
      writable: true,
    });

    const result = checkThreat(req, 40);
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(403);
    expect(result.reason).toContain('Elevated Cloudflare threat score');
  });

  it('should pass low Cloudflare threat score (<= 40)', () => {
    const req = new Request('https://api.zolexora.com/api/v1/marketplace/search');
    Object.defineProperty(req, 'cf', {
      value: { threatScore: 12 },
      writable: true,
    });

    const result = checkThreat(req, 40);
    expect(result.blocked).toBe(false);
  });

  it('should block known exploit scanners by User-Agent', () => {
    const scannerAgents = [
      'sqlmap/1.5.2#stable (http://sqlmap.org)',
      'Mozilla/5.0 (compatible; Nikto/2.1.6)',
      'masscan/1.0 (https://github.com/robertdavidgraham/masscan)',
      'Nmap Scripting Engine (https://nmap.org/book/nse.html)',
      'gobuster 3.1.0',
      'dirbuster/1.0',
      'WPScan v3.8.22',
      'Acunetix-Auto-Scanner',
    ];

    for (const agent of scannerAgents) {
      const req = new Request('https://api.zolexora.com/api/v1/auth/login', {
        headers: { 'User-Agent': agent },
      });
      const result = checkThreat(req, 40);
      expect(result.blocked).toBe(true);
      expect(result.status).toBe(403);
    }
  });

  it('should block path traversal and unauthorized probe attempts', () => {
    const traversalUrls = [
      'https://api.zolexora.com/etc/passwd',
      'https://api.zolexora.com/%252e%252e/secret.env',
      'https://api.zolexora.com/api/v1//admin/sensitive',
      'https://api.zolexora.com/.env',
      'https://api.zolexora.com/.git/HEAD',
      'https://api.zolexora.com/wp-login.php',
    ];

    for (const url of traversalUrls) {
      const req = new Request(url);
      const result = checkThreat(req, 40);
      expect(result.blocked).toBe(true);
      expect(result.status).toBe(400);
      expect(result.reason).toBeDefined();
    }
  });
});
