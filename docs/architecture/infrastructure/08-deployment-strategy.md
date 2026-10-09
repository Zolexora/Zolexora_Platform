# Zolexora Platform — Deployment Strategy
**Dual Production Architecture with Unified Monitoring**

> **Status:** Approved Strategy
> **Date:** 2026-10-09

---

## Overview: Two Production Environments Running Simultaneously

The Zolexora Platform runs **two production environments in parallel** at all times. Cloudflare Workers act as the intelligent traffic director between them. If Production-1 has an outage, traffic automatically shifts to Production-2 in under 3 seconds — with zero manual intervention.

```
Internet Traffic
      │
      ▼
Cloudflare (DDoS Shield + DNS + CDN — 13 accounts)
      │
      ├──► Production-1 (Primary)     → Vercel + Fly.io + Render
      │         │ If P1 healthy: serve from here
      │
      └──► Production-2 (Hot Standby) → K3s on Oracle Cloud
                │ If P1 down: automatically failover here
```

---

## Production-1: Free Cloud Tiers (Primary)

### Architecture
```
User → Cloudflare Worker (per product)
           │
           ├──► Next.js Frontend  → Vercel (always on, global CDN)
           └──► FastAPI Backend   → Fly.io (always on, 3 free VMs)
                                    Render (kept awake via UptimeRobot)
```

### Product Mapping

| Product | Frontend | Backend | CF Account |
| :--- | :--- | :--- | :--- |
| Platform Admin | Vercel | Fly.io VM 1 | CF Account 1 |
| Zolexora IMS | Vercel | Fly.io VM 2 | CF Account 2 |
| Zolexora Marketplace | Vercel | Fly.io VM 2 | CF Account 3 |
| Zolexora TMS | Vercel | Fly.io VM 3 | CF Account 4 |
| Zolexora Engage | Vercel | Render (UptimeRobot) | CF Account 5 |
| Clarity FI | Vercel | Render (UptimeRobot) | CF Account 6 |
| Maun Kavach | Vercel | Render (UptimeRobot) | CF Account 7 |
| Textile Care | Cloudflare Pages | Render (UptimeRobot) | CF Account 8 |
| Rento Easy | Cloudflare Pages | Render (UptimeRobot) | CF Account 9 |
| Zolexora AI | Vercel | Fly.io VM 3 | CF Account 10 |
| ERP (Frappe) | Render | Render | CF Account 11 |
| Backup Runners | — | Fly.io VM 1 | CF Account 12 |
| Media CDN | — | — | CF Account 13 |

### Fly.io VM Packing Strategy
```
Fly.io VM 1 (256MB RAM — Always On)
  ├── Platform Admin FastAPI  :8000
  ├── GitHub self-hosted runner
  └── GitLab self-hosted runner

Fly.io VM 2 (256MB RAM — Always On)
  ├── Zolexora IMS FastAPI    :8001
  └── Marketplace FastAPI     :8002

Fly.io VM 3 (256MB RAM — Always On)
  ├── TMS FastAPI             :8003
  └── Zolexora AI FastAPI     :8004
```

### Render Keep-Awake Strategy
UptimeRobot (200 free monitors) pings every Render service URL every 5 minutes, preventing the 15-minute sleep timeout permanently.

### Free Capacity Summary

| Resource | Per Account | Accounts | Total |
| :--- | :--- | :--- | :--- |
| Vercel bandwidth | 100GB/month | 2 | 200GB/month |
| CF Worker requests | 100K/day | 13 | 1.3M req/day |
| CF Pages bandwidth | Unlimited | 13 | Unlimited |
| Fly.io always-on VMs | 3 | 1 | 3 VMs |
| Render services | 750hr/month | 1 | 5 services |

---

## Production-2: Self-Hosted K3s on Oracle Cloud (Hot Standby)

### Why Oracle Cloud Always Free
Oracle Cloud permanently provides (no credit card after setup, no expiry):
- **VM 1:** 4 CPU, 24GB RAM, 200GB storage (Control Plane)
- **VM 2:** 4 CPU, 24GB RAM, 200GB storage (Worker Node)
- **Total:** 8 CPU cores, 48GB RAM, 400GB storage — free forever

### Architecture
```
Cloudflare (DNS + CDN + DDoS)
      │
      ▼
Oracle VM 1 — K3s Control Plane
  ├── Nginx Ingress Controller  (routes by domain)
  ├── cert-manager              (auto Let's Encrypt SSL)
  ├── Prometheus                (metrics scraping)
  └── Grafana                   (dashboards + alerts)
      │
      ▼
Oracle VM 2 — K3s Worker Node
  ├── ims-frontend        (Next.js container)
  ├── ims-backend         (FastAPI container)
  ├── marketplace-frontend
  ├── marketplace-backend
  ├── tms-frontend + backend
  ├── engage-frontend + backend
  ├── clarity-fi-frontend + backend
  ├── maun-kavach-frontend + backend
  ├── textile-care-frontend + backend
  ├── rento-easy-frontend + backend
  └── zolexora-ai-frontend + backend
```

### Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Containers** | Docker | Package every service |
| **Orchestration** | K3s (lightweight Kubernetes) | Manage all containers |
| **Reverse Proxy** | Nginx Ingress Controller | Route domains to services |
| **SSL** | cert-manager + Let's Encrypt | Automatic free HTTPS |
| **Auto-Scaling** | K8s HPA | Scale on CPU/RAM threshold |
| **Container Registry** | GitHub Container Registry (ghcr.io) | Free Docker image storage |
| **Secrets** | K8s Secrets + Infisical | Secure credentials |
| **Metrics** | Prometheus | Collect all container metrics |
| **Dashboards** | Grafana | Visualize metrics and alerts |
| **Log Aggregation** | Grafana Loki | Search all 11 products' logs |

### Zero-Downtime Deployments
K3s uses Rolling Updates — it starts a new container, waits for it to be healthy, then stops the old one. Users never see downtime during deployments.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # Start 1 new pod before killing old
    maxUnavailable: 0  # Never allow 0 running pods
```

### Auto-Scaling Example
```yaml
# Scale IMS backend between 1-5 replicas based on CPU
minReplicas: 1
maxReplicas: 5
targetCPUUtilizationPercentage: 70
```

---

## The CI/CD Pipeline (Both Environments)

```
git push to main
      │
      ▼
GitHub Actions — Lint + Test (ubuntu-latest — free cloud minutes)
      │
      ▼
Build Docker image → push to ghcr.io (free)
      │
      ├──► Deploy to Production-1
      │         Fly.io: fly deploy
      │         Vercel: auto-deploy on push
      │
      └──► Deploy to Production-2
                GitLab CI (Fly.io self-hosted runner — zero minutes)
                kubectl set image deployment/... → K3s rolling update
```

---

## The Unified Monitoring Panel (Platform Admin Dashboard)

The Platform Admin Next.js dashboard has a dedicated **Infrastructure Monitor** tab that gives a single-pane-of-glass view of both production environments.

### Monitor Tab 1 — Service Health (All 11 Products)
Real-time health status of every service in both environments:
```
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE HEALTH                          P1 Status  P2 Status   │
├─────────────────────────────────────────────────────────────────┤
│  ✅ IMS Frontend        (Vercel)         Healthy    Healthy      │
│  ✅ IMS Backend         (Fly.io)         Healthy    Healthy      │
│  ✅ Marketplace Frontend (Vercel)        Healthy    Healthy      │
│  ⚠️  Engage Backend     (Render)         Slow 340ms Healthy      │
│  ✅ Platform Admin      (Fly.io)         Healthy    Healthy      │
└─────────────────────────────────────────────────────────────────┘
```

### Monitor Tab 2 — Resource Usage (K3s Grafana Embedded)
The Grafana dashboard from Production-2 is embedded directly inside the Platform Admin UI via iframe. Shows:
- CPU usage per container
- RAM usage per container
- Request rate per second per service
- Error rate per service (5xx responses)

### Monitor Tab 3 — Cloudflare Traffic (13 Accounts)
- Total requests served per Cloudflare account today
- Cache hit rate per product (higher = fewer backend calls)
- Bandwidth saved by caching
- Countries where traffic originates

### Monitor Tab 4 — Uptime History (30 Days)
UptimeRobot data pulled via API showing 30-day uptime percentage per service with incident history.

### Monitor Tab 5 — Deployment History
A log of every deployment made to both environments — who deployed, what version, when, and whether it succeeded or rolled back.

### Alert Channels
All monitoring alerts are dispatched via:
- **Email** (via the Email Router we built)
- **Webhook** (Slack, Discord, or any HTTP endpoint)
- **Platform Admin Dashboard** (red badge on the Monitor tab)

---

## Automatic Failover (P1 → P2)

A Cloudflare Worker (running in CF Account 12) pings every Production-1 service every 60 seconds. If a service fails 3 consecutive health checks, the Worker automatically updates the DNS routing to point that product's domain to its Production-2 equivalent on K3s.

```
Health check fails 3× on ims.zolexora.com (Vercel)
      │
      ▼
CF Worker updates routing:
  ims.zolexora.com → K3s Oracle VM (ims-frontend pod)
      │
      ▼
Alert sent via email + Slack
      │
      ▼
Once P1 recovers, CF Worker automatically switches back
```
