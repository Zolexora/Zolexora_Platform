# 09 API Security & Rate Limiting Strategy (Zero-Cost 13-Account Sharding)

This document outlines the API Security and Rate Limiting strategy for the Zolexora Platform, utilizing **13 free Cloudflare accounts** to bypass standard free-tier limits, providing **1.3 million requests/day** capacity via Cloudflare Workers without incurring any costs.

## 1. 13-Account Cloudflare Sharding Architecture

The free tier of Cloudflare Workers provides 100,000 requests per day per account. By sharding our traffic across 13 accounts, we can achieve 1.3 million requests per day. 

### Sharding Strategy (Subdomain Routing)
Traffic is distributed across accounts using dedicated API subdomains. The Main DNS (Account 1) uses CNAME records to route traffic to the Workers hosted in the other 12 accounts.

| Account # | Assigned Purpose | Daily Limit | Products Handled |
| :--- | :--- | :--- | :--- |
| **Account 1** | **Main DNS & Auth Gateway** | 100k req/day | ZolexoraAuth, DNS Zone |
| **Account 2** | **Marketplace B2C Gateway** | 100k req/day | ZolexoraMarketplace (Read-heavy) |
| **Account 3** | **Marketplace Sellers Gateway** | 100k req/day | ZolexoraMarketplace (Sellers API) |
| **Account 4** | **B2B Procurement Gateway** | 100k req/day | ZolexoraB2B (Buyers) |
| **Account 5** | **B2B Suppliers Gateway** | 100k req/day | ZolexoraB2B (Suppliers) |
| **Account 6** | **MaunKavach Telemedicine Gateway**| 100k req/day | MaunKavach |
| **Account 7** | **Aura Beauty Gateway** | 100k req/day | ZolexoraAura |
| **Account 8** | **Fresh Gateway** | 100k req/day | ZolexoraFresh |
| **Account 9** | **Farm (Agri) Gateway** | 100k req/day | ZolexoraFarm |
| **Account 10** | **SaaS/ERP Gateway (Part 1)** | 100k req/day | ZolexoraSaaS, ZolexoraERP (Core) |
| **Account 11** | **SaaS/ERP Gateway (Part 2)** | 100k req/day | ZolexoraERP (Modules), ZolexoraHRMS |
| **Account 12** | **Media/Webhooks Gateway** | 100k req/day | Cloudinary webhooks, payment webhooks |
| **Account 13** | **Failover / Backup Gateway** | 100k req/day | Hot standby for any exhausted account |

**Total Capacity: 1.3 Million requests/day**

---

## 2. API Security Layers implemented in Cloudflare Workers

Instead of doing all rate limiting and security on the application servers (Vercel/Fly.io/Oracle), we push this to the edge using Cloudflare Workers. 

### A. Edge Rate Limiting (Token Bucket)
Since Cloudflare's native Rate Limiting rules are paid, we implement our own Rate Limiter inside the Worker using **Cloudflare KV or Durable Objects**. 
- **Anonymous Users:** Rate limited by IP Address (e.g., 50 req / 5 min).
- **Authenticated Users:** Rate limited by JWT `sub` (User ID) (e.g., 500 req / 5 min).
- **Abuse Prevention:** If an IP exceeds limits repeatedly, the Worker caches a block for 1 hour locally in the Worker memory, preventing KV reads.

### B. JWT Edge Validation
The Worker intercepts all `Authorization: Bearer <token>` headers.
- Fetches public JWKS keys from `ZolexoraAuth`.
- Caches the public key in the Worker memory (Cache API).
- Validates the JWT signature at the edge.
- If invalid or expired, returns `401 Unauthorized` instantly. **Zero compute load reaches the backend.**
- If valid, injects `X-User-ID`, `X-User-Role` headers and forwards the request to the backend.

### C. Bot & DDoS Mitigation (Zero-cost WAF)
- **Turnstile integration:** Requires Cloudflare Turnstile token for critical endpoints (login, register, checkout).
- **IP Reputation Check:** Uses Cloudflare's `cf.threatScore`. If threat score > 40, immediately block or challenge.
- **Geo-Blocking:** Uses `cf.country`. Block traffic from known high-risk countries if they are not our target market.

---

## 3. Worker Implementation Example (Gateway)

Each of the 13 accounts will deploy a similar Worker script using `wrangler`.

```typescript
export default {
  async fetch(request, env, ctx) {
    const ip = request.headers.get("cf-connecting-ip");
    const country = request.cf?.country;
    
    // 1. Basic Geo & Threat filtering
    if (["RU", "CN", "KP"].includes(country)) return new Response("Blocked", { status: 403 });
    if (request.cf?.threatScore > 40) return new Response("High Threat", { status: 403 });

    // 2. JWT Edge Validation (for protected routes)
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/protected")) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader) return new Response("Missing Token", { status: 401 });
      
      const isValid = await verifyJWTAtEdge(authHeader, env.JWKS_CACHE);
      if (!isValid) return new Response("Invalid Token", { status: 401 });
    }

    // 3. Custom Rate Limiting using KV
    const rateLimitKey = `rl:${ip}`;
    const requests = await env.RATE_LIMIT_KV.get(rateLimitKey) || 0;
    if (Number(requests) > 100) {
      return new Response("Too Many Requests", { status: 429 });
    }
    ctx.waitUntil(env.RATE_LIMIT_KV.put(rateLimitKey, Number(requests) + 1, { expirationTtl: 60 }));

    // 4. Forward to actual backend (Fly.io / Oracle / Render)
    const backendUrl = "https://backend-prod-1.fly.dev" + url.pathname + url.search;
    return fetch(new Request(backendUrl, request));
  }
}
```

---

## 4. Monitoring Panel (Multi-Account Aggregation)

To monitor 13 different Cloudflare accounts without logging into 13 dashboards, we will build a centralized **Monitoring Panel**.

### Aggregation Strategy
- Every Cloudflare Worker uses `ctx.waitUntil()` to asynchronously send log metrics to a centralized **Log Drain**.
- **Log Drain:** A dedicated Fly.io internal service or an InfluxDB / TimescaleDB instance on our Oracle K3s cluster.
- **Grafana Dashboard:** Hosted on Oracle Cloud (Production 2).
  - Pulls metrics from the log drain.
  - Displays Total Requests, Blocked Requests, Average Latency, and Remaining Quota for each of the 13 accounts.
  - Alerts via Slack/Discord if an account reaches 90% of its 100k daily limit, triggering an automatic DNS failover to Account 13.
