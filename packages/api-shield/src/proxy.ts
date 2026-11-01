/**
 * Reverse Proxy Dispatcher
 * Streams incoming requests to target backend origins with header forwarding,
 * product routing, and fail-safe error handling.
 */

import type { Env } from './types';
import { extractClientIp } from './rate-limiter';

/**
 * Resolves the target backend origin based on pathname prefix or host header.
 */
export function resolveTargetOrigin(url: URL, env: Env): string {
  const pathname = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  // 1. Path-based product routing
  if (pathname.startsWith('/api/v1/marketplace') || pathname.startsWith('/marketplace/')) {
    return env.MARKETPLACE_ORIGIN || 'http://127.0.0.1:8000';
  }
  if (pathname.startsWith('/api/v1/admin') || pathname.startsWith('/admin/')) {
    return env.ADMIN_ORIGIN || 'http://127.0.0.1:4000';
  }
  if (pathname.startsWith('/api/v1/tms') || pathname.startsWith('/tms/')) {
    return env.TMS_ORIGIN || 'http://127.0.0.1:4030';
  }

  // 2. Subdomain / Host-based routing fallback
  if (hostname.includes('marketplace.')) {
    return env.MARKETPLACE_ORIGIN || 'http://127.0.0.1:8000';
  }
  if (hostname.includes('admin.')) {
    return env.ADMIN_ORIGIN || 'http://127.0.0.1:4000';
  }
  if (hostname.includes('tms.')) {
    return env.TMS_ORIGIN || 'http://127.0.0.1:4030';
  }

  // 3. Platform default origin (TMS)
  return env.DEFAULT_ORIGIN || env.TMS_ORIGIN || 'http://127.0.0.1:4030';
}

/**
 * Proxies the request to the upstream origin using streaming bodies.
 */
export async function forwardToOrigin(request: Request, env: Env): Promise<Response> {
  const originalUrl = new URL(request.url);
  const targetOrigin = resolveTargetOrigin(originalUrl, env);
  const targetUrl = new URL(originalUrl.pathname + originalUrl.search, targetOrigin);

  const clientIp = extractClientIp(request);

  // Prepare upstream headers
  const forwardHeaders = new Headers(request.headers);

  // Set standard proxy headers
  const existingXff = forwardHeaders.get('x-forwarded-for');
  forwardHeaders.set('x-forwarded-for', existingXff ? `${existingXff}, ${clientIp}` : clientIp);
  forwardHeaders.set('x-real-ip', clientIp);
  forwardHeaders.set('x-forwarded-host', originalUrl.host);
  forwardHeaders.set('x-forwarded-proto', originalUrl.protocol.replace(':', '') || 'https');

  // Propagate Cloudflare metadata
  const cfRay = request.headers.get('cf-ray');
  if (cfRay) {
    forwardHeaders.set('x-request-id', cfRay);
  }

  // Host header should match target origin for direct backend dispatch
  forwardHeaders.set('host', targetUrl.host);

  // Prepare streaming request options
  const requestInit: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: forwardHeaders,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    requestInit.body = request.body;
    // duplex: 'half' is required for Node.js / workerd streaming request bodies
    requestInit.duplex = 'half';
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), requestInit);

    // Clone headers for downstream response
    const downstreamHeaders = new Headers(upstreamResponse.headers);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: downstreamHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        message: 'Proxy upstream connection failure',
        target: targetUrl.toString(),
        error: errorMessage,
      })
    );

    return new Response(
      JSON.stringify({
        error: 'Bad Gateway',
        message: 'The upstream backend origin is currently unreachable.',
        target: targetUrl.origin,
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
