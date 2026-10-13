/**
 * Edge CORS Termination Module
 * Handles OPTIONS preflight requests in <2ms at the Cloudflare Edge
 * without forwarding them to Python FastAPI backends.
 */

// Production and development origin patterns
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  // Root domain and any subdomain of zolexora.com (e.g. tms.zolexora.com, api.zolexora.com)
  /^https:\/\/([a-zA-Z0-9-]+\.)*zolexora\.com$/i,
  // Local development origins
  /^https?:\/\/localhost(:[0-9]+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/i,
];

export const CORS_ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD';

export const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'Origin',
  'User-Agent',
  'X-Requested-With',
  'X-Tenant-Id',
  'X-Organisation-Id',
  'X-Product-Slug',
  'Idempotency-Key',
  'Sentry-Trace',
  'Baggage',
  'CF-Connecting-IP',
].join(', ');

export const CORS_EXPOSED_HEADERS = [
  'Content-Length',
  'Content-Range',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
].join(', ');

export const CORS_MAX_AGE = '86400'; // 24 hours

/**
 * Checks if the request origin matches allowed Zolexora domains or local dev hosts.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Edge CORS Preflight Handler:
 * If the incoming request is an OPTIONS preflight, handles it immediately.
 * Returns null if the request is not an OPTIONS preflight.
 */
export function handleCorsPreflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const origin = request.headers.get('Origin');

  // If no Origin header, standard non-CORS OPTIONS request
  if (!origin) {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: CORS_ALLOWED_METHODS,
      },
    });
  }

  // Validate Origin
  if (!isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Origin not allowed by CORS policy.',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Vary': 'Origin',
        },
      }
    );
  }

  // Return instant 204 No Content with CORS preflight headers
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
  headers.set('Access-Control-Expose-Headers', CORS_EXPOSED_HEADERS);
  headers.set('Access-Control-Max-Age', CORS_MAX_AGE);
  headers.set('Vary', 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method');

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Appends standard CORS headers to downstream responses.
 */
export function addCorsHeaders(headers: Headers, request: Request): void {
  const origin = request.headers.get('Origin');
  if (origin && isAllowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Expose-Headers', CORS_EXPOSED_HEADERS);
    headers.set('Vary', 'Origin');
  }
}
