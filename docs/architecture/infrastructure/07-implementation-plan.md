# Zolexora Platform — Implementation Plan
**Roadmap for Building the Zero-Cost Autonomous Architecture & Control Plane**

> **Status:** Approved Roadmap  
> **Date:** 2026-10-09

This document outlines the step-by-step engineering plan to build the vendor-agnostic router, the telemetry dashboard, the hot-data profiler, the autonomous archiver, and the offline backup system.

---

## Phase 1: The Vendor-Agnostic Foundation (Routing & Secrets)
*Goal: Decouple the codebase from proprietary SDKs and establish the central router.*

- [ ] **Secrets Migration:** Map all generic URIs (`POSTGRES_CORE_URL`, `MONGO_URI`, `S3_ENDPOINT`) in the `platform-admin` Infisical vault.
- [ ] **Postgres Router:** Build `app/db/connections.py` using `asyncpg` to route traffic to the correct Postgres cluster based on the product mapping.
- [ ] **MongoDB Router:** Implement the `motor` routing logic to distribute NoSQL traffic across multiple free-tier Atlas clusters.
- [ ] **Media Router:** Implement the S3 (`boto3`) router to point to Cloudflare R2, decoupled from Cloudinary.

## Phase 2: Database Initialization (Schemas & Storage)
*Goal: Physically provision the free-tier infrastructure safely.*

- [ ] **Postgres Schemas:** Execute `scripts/db/migrate-schemas.sql` to create isolated namespaces (e.g., `ims`, `tms`) within the 4 core Supabase Postgres instances to prevent table collisions.
- [ ] **R2 & Cloudinary Sync:** Provision the Cloudflare R2 buckets and configure the 13+ Cloudinary accounts with "Auto-Upload/Fetch" to read directly from the R2 master copies.
- [ ] **MongoDB Clusters:** Provision initial M0 clusters across isolated Atlas projects.

## Phase 3: The Telemetry & Profiling Backend
*Goal: Gather the data required for the Advanced UI to make archiving decisions.*

- [ ] **Capacity Telemetry Script:** Write background tasks to query `pg_database_size()` and MongoDB `db.stats()` every 5 minutes.
- [ ] **Hot Data Profiler Script:** Write scripts to query Postgres `pg_stat_user_tables` (tracking `idx_scan`, `seq_scan`, `n_tup_ins`) and Mongo `$indexStats` to measure exactly which tables/collections are accessed most frequently.
- [ ] **API Layer:** Create FastAPI endpoints in `platform-admin` to expose this real-time data to the frontend.

## Phase 4: The Advanced UI (Zolexora Control Plane)
*Goal: Build the "Command Center" dashboard in the Platform Admin Next.js frontend.*

- [ ] **Capacity Dashboard:** Visual progress bars showing the 500MB (Postgres) and 512MB (MongoDB) limits for every routed database.
- [ ] **Hot Data Profiler UI:** A sorted list of the most heavily used tables across the platform.
- [ ] **Archive Exclusion Rules:** Implement the UI toggle switch (`[ 🔒 Pin to Hot Storage ]`) next to each table, which writes rules to the backend `archive_exclusions.json`.
- [ ] **Smart Archive Calculator UI:** A manual trigger UI featuring a date-slider that calculates and previews how much space will be freed (e.g., *"Archive before 2025-08-01 to free 200MB"*).

## Phase 5: The Autonomous Archiver (Auto-Migration)
*Goal: The background worker that prevents databases from crashing when they hit 90% capacity.*

- [ ] **Threshold Monitor:** Background worker that listens for the 90% capacity alert from the Telemetry system.
- [ ] **Exclusion Filter:** Logic to read `archive_exclusions.json` and skip any tables the admin has pinned.
- [ ] **Dynamic Archiving Logic:** Script that calculates the target date required to drop capacity below 40%, creates the Archive DB connection, safely copies the date-filtered rows, verifies the transfer, and deletes the original rows from the Hot DB.

## Phase 6: The Hybrid CI/CD & Backup Automation System
*Goal: Build the three-platform automation engine (GitHub + GitLab + Fly.io) for CI/CD and nightly backups.*

### 6a — Fly.io Self-Hosted Runner Setup
- [ ] Create a Fly.io account and provision a free always-on VM.
- [ ] Install the **GitHub Actions self-hosted runner** on the Fly.io VM.
- [ ] Install the **GitLab CI/CD self-hosted runner** on the same Fly.io VM.
- [ ] Install `rclone`, `pg_dump`, and `mongodump` on the VM.
- [ ] Verify both runners appear as "Online" in GitHub and GitLab dashboards.

### 6b — GitHub Actions Hybrid Workflow
- [ ] Create `.github/workflows/ci.yml`: route lint/tests to `ubuntu-latest` (free cloud minutes) and Docker builds/deploys to `self-hosted` (Fly.io, zero minutes).
- [ ] Store all Postgres and Mongo URIs as encrypted GitHub Secrets.

### 6c — GitLab Backup Workflow
- [ ] Create `.gitlab-ci.yml` with a `backup` stage scheduled at `0 2 * * *` (2:00 AM daily).
- [ ] Route the backup job exclusively to `self-hosted` (Fly.io runner, zero minutes consumed).
- [ ] **Postgres Backups:** Automate `pg_dump` iteration across all configured Postgres URIs.
- [ ] **Mongo Backups:** Automate `mongodump` execution.
- [ ] **rclone Pipeline:** Configure `rclone` remotes for GDrive, OneDrive, and Nextcloud.
- [ ] Store Google Service Account JSON, OneDrive refresh token, and Nextcloud WebDAV credentials as GitLab CI/CD Variables.
- [ ] Compress all dumps into a single encrypted archive and upload to all three destinations simultaneously.


## Phase 7: Email Infrastructure (Router + Log Backup + UI Monitor)
*Goal: Build the unified email sending router, the nightly log backup pipeline, and the Email Control Center in the Platform Admin UI.*

### 7a — Email Router (Platform Admin FastAPI)
- [ ] Create `app/email/config.py`: Map every provider account to a pool (Resend accounts, Brevo accounts, SendGrid accounts) with daily limits.
- [ ] Create `app/email/router.py`: Build the smart routing logic — check current daily usage per account, skip full accounts, automatically failover to the next available account.
- [ ] Create FastAPI endpoints so all 11 products can send emails via the central router without each product needing its own email credentials.
- [ ] Store all provider API keys in Infisical under `/platform-admin/email`.

### 7b — Nightly Log Backup (Fly.io GitLab Runner)
- [ ] Add a `log-backup` stage to `.gitlab-ci.yml` scheduled at `0 1 * * *` (1:00 AM daily, before Resend's 1-day logs expire).
- [ ] Write `scripts/email/backup_logs.py`:
  - Pull sent email records from Resend API (`/emails` endpoint).
  - Pull delivery events from SendGrid Activity API.
  - Pull statistics from Brevo Transactional API.
  - Upsert all records into MongoDB `email_logs` collection.
- [ ] Route the job to `self-hosted` (Fly.io runner, zero GitLab minutes consumed).

### 7c — Email Control Center UI (Platform Admin Next.js)
- [ ] **Live Usage Gauges:** Query the FastAPI router's usage counters and display real-time progress bars per provider account (turns red at 90%).
- [ ] **Delivery Health Table:** Aggregate MongoDB `email_logs` by product to show sent/delivered/bounced/open rates.
- [ ] **Permanent Log Search:** Build a searchable, paginated table over the MongoDB `email_logs` collection — filterable by product, provider, status, and date range.
- [ ] **Alert Rules UI:** Allow admin to configure per-product bounce rate thresholds and provider usage alerts, saving rules to `email_alert_rules.json`.

## Phase 8: Dual Production Deployment & Unified Monitoring
*Goal: Deploy all 11 products across both Production-1 and Production-2 simultaneously with automatic failover and a single monitoring panel.*

### 8a — Production-1 Setup (Free Cloud Tiers)
- [ ] Deploy all Next.js frontends to Vercel (one project per product, auto-deploy on push).
- [ ] Deploy Platform Admin FastAPI to Fly.io VM 1.
- [ ] Deploy IMS + Marketplace FastAPIs to Fly.io VM 2.
- [ ] Deploy TMS + Zolexora AI FastAPIs to Fly.io VM 3.
- [ ] Deploy Engage, Clarity FI, Maun Kavach, Textile Care, Rento Easy backends to Render.
- [ ] Register all Render service URLs on UptimeRobot (free, 5-min ping interval) to prevent sleep.
- [ ] Configure one Cloudflare Worker per product as the edge API gateway.

### 8b — Production-2 Setup (K3s on Oracle Cloud)
- [ ] Create Oracle Cloud Always Free account and provision 2 VMs (4 CPU, 24GB RAM each).
- [ ] Install K3s on VM 1 (control plane) and VM 2 (worker node).
- [ ] Install Nginx Ingress Controller and cert-manager inside K3s.
- [ ] Write Kubernetes Deployment and Service manifests for all 11 products.
- [ ] Write HPA (HorizontalPodAutoscaler) configs for all backends (scale 1→5 at 70% CPU).
- [ ] Configure GitHub Container Registry (ghcr.io) as the image registry.
- [ ] Configure rolling update strategy (maxUnavailable: 0) for zero-downtime deploys.

### 8c — CI/CD Pipeline (GitHub Actions + GitLab CI)
- [ ] GitHub Actions: Build and push Docker images to ghcr.io on every push to `main`.
- [ ] GitHub Actions: Deploy to Production-1 (Fly.io + Vercel) using `ubuntu-latest` runners.
- [ ] GitLab CI: Deploy to Production-2 (K3s via kubectl) using Fly.io self-hosted runner.
- [ ] Configure rollback trigger: if health check fails post-deploy, automatically `kubectl rollout undo`.

### 8d — Monitoring Stack (K3s)
- [ ] Install Prometheus inside K3s to scrape metrics from all 11 product containers.
- [ ] Install Grafana inside K3s and configure dashboards for CPU, RAM, request rate, error rate.
- [ ] Install Grafana Loki inside K3s for unified log aggregation across all containers.
- [ ] Expose Grafana via the Nginx Ingress at `grafana.admin.zolexora.com`.

### 8e — Unified Monitoring Panel (Platform Admin UI)
- [ ] **Service Health Tab:** FastAPI endpoint polls Fly.io, Render, Vercel, and K3s health endpoints every 60 seconds and displays a live status grid.
- [ ] **Grafana Embed Tab:** Embed the K3s Grafana dashboard inside Platform Admin via iframe.
- [ ] **Cloudflare Traffic Tab:** Pull request and bandwidth stats from all 13 Cloudflare accounts via API.
- [ ] **Uptime History Tab:** Pull 30-day uptime data from UptimeRobot API.
- [ ] **Deployment History Tab:** Log every CI/CD deployment event with version, timestamp, and status.
- [ ] **Alerts:** Send failure alerts via the Email Router (Phase 7) and configurable webhooks.

### 8f — Automatic Failover (P1 → P2)
- [ ] Create a Cloudflare Worker (CF Account 12) that pings every Production-1 service every 60 seconds.
- [ ] If 3 consecutive health checks fail, the Worker automatically updates DNS routing to point to the equivalent Production-2 K3s service.
- [ ] Send immediate alert via Email Router and webhook when failover is triggered.
- [ ] Auto-revert to Production-1 once health checks pass again.
