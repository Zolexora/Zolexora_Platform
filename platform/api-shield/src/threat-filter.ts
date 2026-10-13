/**
 * Edge Threat & Bot Filter Module
 * Inspects Cloudflare threat score, blocks known malicious user agents,
 * and defends against path traversal / probe attacks.
 */

import type { ThreatCheckResult } from './types';

// Malicious and abusive scanner user-agents (case-insensitive)
const BLOCKED_USER_AGENTS: RegExp[] = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /nmap/i,
  /gobuster/i,
  /dirbuster/i,
  /wpscan/i,
  /zgrab/i,
  /netsparker/i,
  /acunetix/i,
  /havij/i,
  /hydra/i,
  /metasploit/i,
];

// Dangerous path traversal, probe, and unauthorized file access patterns
const TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\./,                                     // Path traversal: ..
  /%2e%2e/i,                                 // URL-encoded: %2e%2e
  /%252e%252e/i,                             // Double-encoded: %252e%252e
  /\x00/,                                    // Null byte injection
  /%00/i,                                    // URL-encoded null byte
  /\/{2,}/,                                  // Double slash probing in path (e.g. //admin)
  /^\/(etc\/(passwd|shadow|hosts)|proc\/|sys\/|dev\/|root\/)/i, // OS files
  /^\/(\.env|\.git|\.aws|\.ssh|\.docker)($|\/)/i,              // Sensitive credential files
  /\.(php|asp|aspx|jsp|cgi)($|\?)/i,         // Common unmaintained probe extensions
];

/**
 * Evaluates whether an incoming request poses an immediate security threat.
 */
export function checkThreat(request: Request, maxThreatScore: number = 40): ThreatCheckResult {
  const url = new URL(request.url);

  // 1. Cloudflare Threat Score Inspection (available in production on Cloudflare Edge)
  const cf = (request as unknown as { cf?: { threatScore?: number } }).cf;
  if (cf && typeof cf.threatScore === 'number' && cf.threatScore > maxThreatScore) {
    return {
      blocked: true,
      reason: `Elevated Cloudflare threat score (${cf.threatScore} > ${maxThreatScore}).`,
      status: 403,
    };
  }

  // 2. User-Agent Bot / Exploit Scanner Filtering
  const userAgent = request.headers.get('User-Agent') || '';
  if (userAgent) {
    const isMaliciousAgent = BLOCKED_USER_AGENTS.some((pattern) => pattern.test(userAgent));
    if (isMaliciousAgent) {
      return {
        blocked: true,
        reason: 'Automated vulnerability scanner or abusive agent blocked.',
        status: 403,
      };
    }
  }

  // 3. Path Traversal & Malformed URI Protection (checked on path and query, excluding protocol)
  const pathAndQuery = `${url.pathname}${url.search}`;
  const isTraversalAttempt = TRAVERSAL_PATTERNS.some((pattern) =>
    pattern.test(url.pathname) || pattern.test(url.search) || pattern.test(pathAndQuery)
  );

  if (isTraversalAttempt) {
    return {
      blocked: true,
      reason: 'Malformed path, directory traversal, or unauthorized probe sequence detected.',
      status: 400,
    };
  }

  return { blocked: false };
}
