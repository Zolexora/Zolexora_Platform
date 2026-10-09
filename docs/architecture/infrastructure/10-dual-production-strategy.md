# 10 Dual-Production Deployment & Monitoring Strategy

This document outlines the **Dual-Production Strategy** (Production 1 and Production 2) designed to provide extreme redundancy, high availability, and horizontal scalability for the Zolexora Platform using zero-cost cloud resources and modern container orchestration.

## 1. The Dual-Production Concept

We maintain two completely independent production environments to guarantee uptime if one provider goes down or if free tiers are exhausted.

### Production-1 (P1): The Serverless & PaaS Edge
**Focus:** Speed, CDN distribution, and managed auto-scaling.
**Stack:**
- **Frontends (Next.js / React):** Vercel & Cloudflare Pages. Global edge caching.
- **APIs / Backends (NestJS / FastAPI):** Fly.io (Dockerized) & Render (Dockerized). 
- **API Gateway:** Cloudflare Workers (distributed across 13 accounts).
- **Traffic Routing:** CNAMEs dynamically route users to P1 by default.

### Production-2 (P2): The Sovereign Kubernetes Cluster
**Focus:** Dedicated resources, background processing, and complete control without PaaS limits.
**Stack:**
- **Infrastructure:** Oracle Cloud "Always Free" ARM Compute Instances (4 ARM instances, 24GB RAM total).
- **Orchestration:** **K3s (Lightweight Kubernetes)**. We run a lightweight K8s cluster across the Oracle nodes.
- **Container Runtime:** Docker & containerd.
- **Ingress / Load Balancing:** **Nginx Ingress Controller** inside K3s.
- **Storage:** Local path provisioning and Rclone sync to Google Drive.

---

## 2. P2 Architecture: K3s + Docker + Nginx

The Oracle K3s cluster serves as our robust fallback and heavy-lifting environment.

1. **Load Balancer (Nginx):** 
   - Receives traffic from Cloudflare.
   - Handles SSL termination (Let's Encrypt / Certbot).
   - Routes traffic to the internal K3s services based on subdomains (e.g., `erp.zolexora.com` -> ERP Pods).
2. **Kubernetes Deployments:**
   - Every product (TMS, ERP, Auth) is built as a Docker container.
   - Deployed as K8s `Deployment` resources with `HorizontalPodAutoscaler` (HPA).
3. **Background Workers:**
   - Heavy tasks (PDF generation, bulk email sending, data import) run *exclusively* on P2 to save Fly.io/Render compute credits in P1.
4. **Internal Networking:**
   - Pods communicate securely via K3s internal DNS (`service.namespace.svc.cluster.local`).

---

## 3. Global Monitoring Panel (The Zolexora Command Center)

A centralized monitoring panel is essential to visualize the health of 11 products, 13 Cloudflare accounts, P1 (Fly/Render/Vercel), P2 (Oracle K3s), and the database clusters (Supabase/MongoDB).

### Tech Stack for Monitoring Panel
- **Data Collection (Agents):** 
  - *Prometheus* running in P2 (Oracle).
  - *Promtail/Loki* for log aggregation from Docker containers.
- **Log Drain (P1 to P2):**
  - Cloudflare Workers, Fly.io, and Render are configured to send their logs and metrics to the Prometheus/Loki instance on P2.
- **Dashboard UI:**
  - **Grafana** deployed on P2 (Oracle). Access restricted behind Cloudflare Access (Zero Trust) to admins only.

### Key Metrics Monitored in the Panel:
1. **Cloudflare 13-Account Quotas:** Tracks the 100k/day limit per account. Alerts via Slack if any account hits 90%.
2. **P1 Health:** Latency and HTTP 5xx errors from Fly.io and Render.
3. **P2 Health:** Node CPU/Memory usage, Pod restarts, Nginx Ingress traffic on the Oracle K3s cluster.
4. **Database Connections:** Supabase pgBouncer connections, MongoDB Atlas connection pools.
5. **Email Delivery Logs:** Bounces, drops, and delivery rates from Resend / SendGrid / Brevo.

---

## 4. Failover & Routing Strategy

We use **Cloudflare Load Balancing** (or manual DNS scripting if on the free tier) to handle failover.

1. **Primary Route:** Traffic hits Cloudflare Worker -> P1 (Fly.io / Render).
2. **Health Checks:** Cloudflare constantly pings `/health` on P1.
3. **Automatic Failover:** If P1 goes down or hits compute limits, Cloudflare DNS updates the CNAME to point to P2 (Oracle K3s + Nginx).
4. **Data Consistency:** Because both P1 and P2 connect to the same centralized database clusters (Supabase/MongoDB), failover is stateless and instant.
