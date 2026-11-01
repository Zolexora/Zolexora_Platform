/**
 * Cloudflare Worker API Shield Environment and Types
 * Zolexora Platform - Pillar 2
 */

export interface Env {
  ENVIRONMENT?: string;
  TMS_ORIGIN?: string;
  MARKETPLACE_ORIGIN?: string;
  ADMIN_ORIGIN?: string;
  DEFAULT_ORIGIN?: string;
  GENERAL_RATE_LIMIT?: string;
  SENSITIVE_RATE_LIMIT?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  MAX_THREAT_SCORE?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export interface ShieldConfig {
  environment: string;
  tmsOrigin: string;
  marketplaceOrigin: string;
  adminOrigin: string;
  defaultOrigin: string;
  generalRateLimit: number;
  sensitiveRateLimit: number;
  windowSeconds: number;
  maxThreatScore: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
  ip: string;
  endpointType: 'sensitive' | 'general' | 'exempt';
}

export interface ThreatCheckResult {
  blocked: boolean;
  reason?: string;
  status?: number;
}

export interface CorsConfig {
  allowedOrigins: (string | RegExp)[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposeHeaders: string[];
  maxAge: number;
  allowCredentials: boolean;
}
