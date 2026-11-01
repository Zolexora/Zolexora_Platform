# @zolexora/api-shield (Pillar 2: Cloudflare Worker API Shield)

Production-ready, lightweight API Security, Edge CORS Termination, and Rate Limiting Gateway for the Zolexora Platform, operating strictly on the **Cloudflare Workers Free Tier ($0/month)**.

---

## 1. Architecture Overview

```
                      +-------------------------------+
                      |   Client / Browser / Mobile   |
                      +---------------+---------------+
                                      |
                                      | HTTPS (Any Zolexora Domain)
                                      v
                      +-------------------------------+
                      |    Cloudflare Edge Worker     |
                      |     (@zolexora/api-shield)    |
                      +---------------+---------------+
                                      |
               +----------------------+----------------------+
               |                      |                      |
      [1. Edge CORS Preflight] [2. Threat & Bot Filter] [3. Rate Limiter]
      - OPTIONS -> 204 (<2ms)  - cf.threatScore > 40    - 15 req/min (auth)
      - Allowed origins check   - Bad user agents       - 100 req/min (general)
      - Instant termination    - Traversal/probes      - Sliding window (Free)
               |                      |                      |
               +----------------------+----------------------+
                                      |
                           [4. Origin Router / Reverse Proxy]
                                      |
        +-----------------------------+-----------------------------+
        |                             |                             |
        v                             v                             v
+------------------+         +------------------+         +------------------+
| TMS FastAPI      |         | Marketplace API  |         | Platform Admin   |
| (127.0.0.1:4030) |         | (127.0.0.1:8000) |         | (127.0.0.1:4000) |
+------------------+         +------------------+         +------------------+
```

---

## 2. Core Capabilities

### A. Edge CORS Termination (<2ms Latency)
- Terminates browser `OPTIONS` preflight requests directly at the edge in $<2\text{ms}$ without forwarding traffic to backend origins.
- Allows `https://zolexora.com` and all `https://*.zolexora.com` subdomains, as well as `localhost` and `127.0.0.1` during development.
- Injects standard credentials, max-age (`86400`), methods, and custom headers (`X-Tenant-Id`, `X-Organisation-Id`, `Idempotency-Key`, `CF-Connecting-IP`).

### B. Sliding-Window Rate Limiting ($0 Free Tier)
- **Sensitive Routes** (`/api/v1/auth/*`, `/auth/*`, `/onboarding/*`, `/login`, `/register`, `/forgot-password`):
  - Strict ceiling: **15 requests per minute** per client IP.
- **General Routes** (all remaining REST API endpoints):
  - Ceiling: **100 requests per minute** per client IP.
- **Exempt Routes** (`/__shield/health`, `/health`):
  - Unrestricted for health monitors and keep-alives.
- **Storage Strategy**:
  - In-memory sliding-window counter inside Worker isolates handles rapid spikes with 0 network latency.
  - Asynchronous background synchronization to `RATE_LIMIT_KV` (via `ctx.waitUntil(...)`) without blocking request latency or exceeding Free Tier write limits.
- **Headers & 429 Response**:
  - Emits `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`.

### C. Threat & Bot Filtering
- **Cloudflare Threat Score**: Blocks requests where `cf.threatScore > 40` with `403 Forbidden`.
- **Automated Exploit Scanners**: Blocks known scanning tools (`sqlmap`, `nikto`, `masscan`, `nmap`, `gobuster`, `dirbuster`, `wpscan`, `acunetix`, `havij`, etc.).
- **Path Traversal & Probe Defenses**: Rejects directory traversal sequences (`..`, `%252e%252e`), null bytes (`%00`), and attempts to probe OS or configuration files (`/etc/passwd`, `/.env`, `/.git`).

### D. Reverse Proxy & Domain Routing
- **Path-based dispatch**:
  - `/api/v1/tms/*` $\to$ `TMS_ORIGIN` (`http://127.0.0.1:4030`)
  - `/api/v1/marketplace/*` $\to$ `MARKETPLACE_ORIGIN` (`http://127.0.0.1:8000`)
  - `/api/v1/admin/*` $\to$ `ADMIN_ORIGIN` (`http://127.0.0.1:4000`)
- **Host-based dispatch**:
  - `tms.*` $\to$ `TMS_ORIGIN`
  - `marketplace.*` $\to$ `MARKETPLACE_ORIGIN`
  - `admin.*` $\to$ `ADMIN_ORIGIN`
- Preserves client IP with `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Proto`, and `X-Request-Id`.
- Full streaming body support (`duplex: 'half'`).

---

## 3. Strict Platform Constraints

1. **No Cross-Product SSO**: Each product maintains completely isolated authentication tokens and sessions; the API Shield acts as a transparent, secure proxy without unifying user sessions across products.
2. **No Programmatic Account Creation**: The shield proxies and protects backend routes without issuing automated accounts.
3. **100% Free Plan ($0/month)**: Engineered to operate within Cloudflare's 100,000 requests/day free tier without requiring paid Enterprise WAF or Cloudflare Rulesets add-ons.

---

## 4. Scripts & Commands

```bash
# Type check TypeScript
pnpm --filter @zolexora/api-shield type-check

# Run unit and integration tests
pnpm --filter @zolexora/api-shield test

# Run local development worker
pnpm --filter @zolexora/api-shield dev

# Deploy to Cloudflare Workers
pnpm --filter @zolexora/api-shield deploy
```
