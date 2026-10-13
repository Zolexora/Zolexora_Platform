/**
 * Cloudflare Worker API Shield - Main Entrypoint
 * Zolexora Platform - Pillar 2: API Security & Edge Rate Limiting
 *
 * Implements:
 * 1. Edge CORS Preflight Termination (<2ms)
 * 2. Sliding-Window IP Rate Limiting (100 req/min general, 15 req/min sensitive)
 * 3. Bot, Scanner, Threat Score & Path Traversal Filtering
 * 4. Zero-SSO Isolated Header Reverse Proxying with Body Streaming
 */

import type { Env } from './types';
import { handleCorsPreflight, addCorsHeaders } from './cors';
import { checkThreat } from './threat-filter';
import {
  evaluateRateLimit,
  createRateLimitExceededResponse,
  addRateLimitHeaders,
  extractClientIp,
} from './rate-limiter';
import { forwardToOrigin } from './proxy';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const clientIp = extractClientIp(request);
    const cfRay = request.headers.get('cf-ray') || 'local';

    // 1. Edge CORS Preflight Termination (<2ms edge latency)
    const corsPreflightResponse = handleCorsPreflight(request);
    if (corsPreflightResponse) {
      return corsPreflightResponse;
    }

    // 2. Health & Shield Inspection Endpoints
    if (url.pathname === '/__shield/health' || url.pathname === '/health') {
      const healthData = {
        status: 'healthy',
        service: '@zolexora/api-shield',
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'production',
        timestamp: new Date().toISOString(),
        client_ip: clientIp,
        ray_id: cfRay,
        rate_limits: {
          general: parseInt(env.GENERAL_RATE_LIMIT || '100', 10),
          sensitive: parseInt(env.SENSITIVE_RATE_LIMIT || '15', 10),
          window_seconds: parseInt(env.RATE_LIMIT_WINDOW_SECONDS || '60', 10),
        },
      };

      const healthHeaders = new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      addCorsHeaders(healthHeaders, request);

      return new Response(JSON.stringify(healthData, null, 2), {
        status: 200,
        headers: healthHeaders,
      });
    }

    try {
      // 3. Threat, Scanner, Bot & Traversal Filtering
      const maxThreatScore = parseInt(env.MAX_THREAT_SCORE || '40', 10);
      const threatResult = checkThreat(request, maxThreatScore);
      if (threatResult.blocked) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            event: 'threat_blocked',
            ip: clientIp,
            path: url.pathname,
            reason: threatResult.reason,
            ray_id: cfRay,
          })
        );

        const errorHeaders = new Headers({ 'Content-Type': 'application/json' });
        addCorsHeaders(errorHeaders, request);

        return new Response(
          JSON.stringify({
            error: threatResult.status === 400 ? 'Bad Request' : 'Forbidden',
            message: threatResult.reason,
            shield: 'zolexora-api-shield',
          }),
          {
            status: threatResult.status || 403,
            headers: errorHeaders,
          }
        );
      }

      // 4. Sliding-Window Rate Limiting
      const rateLimitResult = await evaluateRateLimit(request, env, ctx);
      if (!rateLimitResult.allowed) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            event: 'rate_limit_exceeded',
            ip: clientIp,
            path: url.pathname,
            endpoint_type: rateLimitResult.endpointType,
            limit: rateLimitResult.limit,
            retry_after: rateLimitResult.retryAfter,
            ray_id: cfRay,
          })
        );

        const rateLimitResponse = createRateLimitExceededResponse(rateLimitResult);
        addCorsHeaders(rateLimitResponse.headers, request);
        return rateLimitResponse;
      }

      // 5. Reverse Proxy Dispatch to Upstream Origin
      const originResponse = await forwardToOrigin(request, env);

      // 6. Append Rate Limit & CORS Headers to the Outgoing Response
      const finalHeaders = new Headers(originResponse.headers);
      addRateLimitHeaders(finalHeaders, rateLimitResult);
      addCorsHeaders(finalHeaders, request);

      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: finalHeaders,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'unhandled_shield_error',
          error: errorMessage,
          ip: clientIp,
          path: url.pathname,
          ray_id: cfRay,
        })
      );

      const internalErrorHeaders = new Headers({ 'Content-Type': 'application/json' });
      addCorsHeaders(internalErrorHeaders, request);

      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'An edge gateway processing error occurred.',
          ray_id: cfRay,
        }),
        {
          status: 500,
          headers: internalErrorHeaders,
        }
      );
    }
  },
} satisfies ExportedHandler<Env>;
