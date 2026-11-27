/**
 * Auth middleware for Zolexora Orbit API.
 *
 * Verifies business-session tokens (ES256) issued by the Zolexora Auth Service.
 * Tokens are verified by calling GET /api/v1/auth/me on the Auth Service.
 * Results are cached for 30 seconds to match the pattern used across all Zolexora products.
 *
 * The decoded identity is stored on request.actor and request.orgContext.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";
import { unauthorized, forbidden } from "../plugins/error-handler.js";
import type { OrbitPermission } from "../config/constants.js";

// ── Auth Service response type ────────────────────────────────────────────────

export interface AuthMeResponse {
  id: string;
  zolexora_id: string;
  email?: string | null;
  phone?: string | null;
  display_name?: string | null;
  org_id: string;
  role: string | null;
  permissions: string[];
  session_id: string;
  product: string;
  mfa_verified: boolean;
}

// ── Simple 30-second in-memory cache ─────────────────────────────────────────

interface CacheEntry {
  data: AuthMeResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getFromCache(token: string): AuthMeResponse | null {
  const entry = cache.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(token);
    return null;
  }
  return entry.data;
}

function setCache(token: string, data: AuthMeResponse) {
  // Evict stale entries periodically to prevent unbounded growth
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiresAt < now) cache.delete(k);
    }
  }
  cache.set(token, { data, expiresAt: Date.now() + 30_000 });
}

// ── Auth Service caller ───────────────────────────────────────────────────────

async function verifyWithAuthService(
  token: string,
): Promise<AuthMeResponse | null> {
  const cached = getFromCache(token);
  if (cached) return cached;

  const res = await fetch(`${env.AUTH_SERVICE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as AuthMeResponse;
  setCache(token, data);
  return data;
}

// ── Fastify hook factories ────────────────────────────────────────────────────

/**
 * Require a valid business-session token. Populates req.actor.
 * Optionally enforces that the token belongs to the requested org.
 */
export function requireAuth(opts: { enforceOrg?: boolean } = {}) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw unauthorized("Missing authorization header");
    }

    const token = authHeader.slice(7);
    const actor = await verifyWithAuthService(token);

    if (!actor) throw unauthorized("Invalid or expired session");
    if (actor.product !== env.ORBIT_PRODUCT_ID) {
      throw unauthorized("Token not issued for this product");
    }

    // Attach actor to request
    (req as AuthenticatedRequest).actor = actor;

    // Enforce org boundary if the route carries :orgId
    if (opts.enforceOrg) {
      const orgId = (req.params as Record<string, string>)?.orgId;
      if (orgId && orgId !== actor.org_id) {
        throw forbidden("Cross-organization access denied");
      }
    }
  };
}

/**
 * Check that the authenticated actor holds all listed Orbit permissions.
 * Must be used after requireAuth.
 */
export function requirePermissions(...permissions: OrbitPermission[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const actor = (req as AuthenticatedRequest).actor;
    if (!actor) throw unauthorized();

    const missing = permissions.filter((p) => !actor.permissions.includes(p));
    if (missing.length > 0) {
      throw forbidden(`Missing permissions: ${missing.join(", ")}`);
    }
  };
}

// ── Type augmentation ─────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends FastifyRequest {
  actor: AuthMeResponse;
}

declare module "fastify" {
  interface FastifyRequest {
    actor?: AuthMeResponse;
  }
}
