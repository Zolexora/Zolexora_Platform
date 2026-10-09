# Zolexora Platform — Zero-Cost Autonomous Architecture
**The Vendor-Agnostic Strategy for Infinite Free-Tier Scaling**

> **Status:** Approved Strategy  
> **Date:** 2026-10-09

---

## 1. Core Philosophy: Vendor Agnosticism
The platform utilizes free tiers from Supabase, Cloudflare, and MongoDB Atlas. However, to prevent vendor lock-in and allow instantaneous migration, **the application layer must never use proprietary SDKs for database interactions.**

| Service | Core Technology | Connection Method (No Lock-in) | Migration Impact |
| :--- | :--- | :--- | :--- |
| **Supabase** | PostgreSQL | `asyncpg` or `SQLAlchemy` (Raw SQL) | Change URL to AWS RDS or self-hosted Postgres. Zero code changes. |
| **Cloudflare R2** | S3-Compatible Object Storage | `boto3` (AWS S3 Python SDK) | Change Endpoint URL to AWS, MinIO, or DO Spaces. Zero code changes. |
| **MongoDB Atlas** | MongoDB | `motor` (Standard Python Async Driver) | Change Mongo URI. Zero code changes. |
| **Cloudflare D1** | SQLite (Edge) | Abstracted `EdgeDatabase` Python class | Rewrite one Python adapter class. Zero business logic changes. |

---

## 2. Media Storage: The Warehouse vs. The Display Window
To avoid Cloudinary's strict free-tier storage limits while utilizing its powerful on-the-fly media transformations, we decouple storage from processing.

1. **The Warehouse (Cloudflare R2):** All original, high-resolution media uploaded by users is saved directly to R2. This leverages Cloudflare's massive 10GB/account free tier and **zero egress fees**. The database only stores the relative path (e.g., `products/image.jpg`).
2. **The Display Window (Cloudinary):** Cloudinary is configured to *fetch* master images from the R2 bucket. It resizes, compresses (WebP/AVIF), and caches them on the fly for the frontend.
3. **The Result:** We own 100% of the raw files. If Cloudinary changes its pricing, we simply unplug it and plug in a different image optimization CDN (like imgix or Cloudflare Images).

---

## 3. Infinite NoSQL Storage (MongoDB Atlas Hack)
MongoDB Atlas restricts users to one free M0 cluster (512MB) per Project. 

*   **The Scaling Strategy:** A single MongoDB *Organization* can contain up to 250 *Projects*. This effectively provides **128 GB of free NoSQL storage** (250 × 512MB) per Organization.
*   **Data Classification:** MongoDB is strictly used for flexible JSON data (Zolexora AI chat logs, TMS tracking streams, Engage email logs). **No files are ever stored in MongoDB** (GridFS is banned) to protect the 512MB limits.
*   **Routing:** The Platform Admin router dynamically maps products to different MongoDB URIs to balance the load across the multiple free clusters.

---

## 4. The Zolexora Control Plane (Autonomous Scaling)
Because free tier Postgres databases are hard-capped at 500MB, relying on humans to monitor them is risky. We are building a custom Control Plane inside `platform-admin` to manage this fleet autonomously.

### The Problem with Relational Scaling
If a tightly coupled table (like `order_items`) hits 500MB, moving just that table to a new database breaks SQL `JOIN`s and crashes the backend. 

### The Solution: Dynamic Time-Based Archiving (Hot/Cold Storage)
Data is managed based on capacity, not hardcoded dates.

1. **Telemetry:** A background cron job pings all Supabase databases constantly.
2. **The Threshold Trigger:** If `zolexora-marketplace-db1` hits **90% capacity** (450MB), the Autonomous Archiver activates.
3. **The Action:** The script calculates the exact amount of historical data (e.g., orders from 8 months ago) that must be moved to reach **40% capacity**.
4. **Execution:** It moves that historical data to a Cold Archive Database (DB 2), verifies integrity, and deletes it from the Hot Database (DB 1).
5. **Result:** DB 1 drops back to 40% capacity. Joins are preserved. If users need old data, the router directs that specific query to the Cold Archive Database.

---

## 5. The Hybrid CI/CD & Backup Automation Engine

### Three Platforms, One Unified Strategy
We use **GitHub Actions**, **GitLab CI/CD**, and **Fly.io** together. Each platform is used for what it does best, and all free-tier minutes are preserved for light jobs only.

```
Fly.io (Always-On Self-Hosted Runner)
    │
    ├── GitHub Self-Hosted Runner  ── Heavy CI/CD jobs (Docker build, deploy)
    └── GitLab Self-Hosted Runner  ── Nightly backups (pg_dump → rclone → GDrive/OneDrive)
```

### Free Minutes are Still Used (Hybrid Mode)
Self-hosted runners on Fly.io handle heavy, long-running jobs. Fast, lightweight jobs intentionally run on the free cloud runners to conserve the Fly.io VM's resources.

| Job | Runner | Free Minutes Consumed |
| :--- | :--- | :--- |
| Code lint & type checks | GitHub cloud (`ubuntu-latest`) | ~30 seconds each run |
| Unit & integration tests | GitHub cloud (`ubuntu-latest`) | ~2 minutes each run |
| Security scans | GitLab cloud | ~3 minutes each run |
| Docker image builds | Fly.io self-hosted (`self-hosted`) | **0 minutes** |
| Production deployments | Fly.io self-hosted (`self-hosted`) | **0 minutes** |
| Nightly database backup | Fly.io self-hosted (`self-hosted`) | **0 minutes** |
| rclone upload to GDrive/OneDrive | Fly.io self-hosted (`self-hosted`) | **0 minutes** |

### Free Compute Budget Per Month
| Platform | Free Minutes | After Hybrid Strategy |
| :--- | :--- | :--- |
| GitHub Actions | 2,000 min/month | Lasts the entire year (only lint/tests) |
| GitLab CI/CD | 400 min/month | Lasts the entire year (only security scans) |
| Fly.io Self-Hosted | **Unlimited** | Handles all heavy workloads |

### The Backup Pipeline (Fly.io → rclone)
The nightly backup workflow runs exclusively on the Fly.io self-hosted runner and:
1. Runs `pg_dump` across all 4 Supabase Postgres clusters.
2. Runs `mongodump` across all MongoDB Atlas clusters.
3. Compresses everything into a single encrypted archive.
4. Uses `rclone` to push the archive to all three personal cloud drives simultaneously:
    *   **Google Drive (10 accounts × 15GB = 150GB):** via Google Service Account JSON key.
    *   **OneDrive (multiple accounts):** via offline OAuth refresh token.
    *   **Nextcloud (self-hosted):** via standard WebDAV credentials.
5. The Fly.io VM stays running, ready for the next night.


---

## 6. Email Infrastructure (Router + Log Backup + Monitor)

### The Problem with Free Email Tiers
Resend keeps logs for **1 day only**. SendGrid keeps them for **3 days only**. If we don't pull and store them before they expire, all email delivery records are permanently lost — no audit trail, no proof of delivery for invoices or OTPs.

### Free Tier Capacity Across Multiple Accounts

| Provider | Free/Day | Free/Month | Accounts | **Total Free/Month** |
| :--- | :--- | :--- | :--- | :--- |
| **Resend** | 100 | 3,000 | 10 | **30,000** |
| **Brevo** | 300 | 9,000 | 10 | **90,000** |
| **SendGrid** | 100 | 3,000 | 10 | **30,000** |
| **Grand Total** | | | | **150,000/month** |

### The Email Router (Platform Admin FastAPI)
A central routing layer in Platform Admin automatically selects the correct provider account based on daily usage. When Account 1 hits 90% of its daily limit, all new emails are transparently routed to Account 2 — no manual intervention required.

```
All 11 Products
     │
     ▼
Platform Admin Email Router
     ├── Resend Account 1  (87/100 today) → Full, skip
     ├── Resend Account 2  (23/100 today) → ✅ Send here
     ├── Brevo Account 1   (0/300 today)  → Fallback
     └── SendGrid Account 1 (41/100 today) → Fallback
```

### The Nightly Log Backup (Fly.io GitLab Runner)
Every night at 1:00 AM (before Resend's 1-day logs expire), a GitLab CI job runs on the Fly.io self-hosted runner:
1. Calls the Resend API and pulls all sent email records for the day.
2. Calls the SendGrid Activity API and pulls all delivery events.
3. Calls the Brevo Transactional API and pulls all send statistics.
4. Saves every record as a structured JSON document into **MongoDB** (`email_logs` collection) permanently.

Each saved document captures:
```json
{
  "message_id": "resend_01abc...",
  "provider": "resend",
  "account": "resend-account-2",
  "product": "zolexora-ims",
  "to": "customer@example.com",
  "subject": "Invoice #INV-001",
  "status": "delivered",
  "opened": true,
  "sent_at": "2026-10-09T14:30:00Z",
  "bounce_reason": null
}
```

### The Email Control Center UI (Platform Admin Dashboard)
The Platform Admin Next.js frontend exposes a dedicated **Email Control Center** tab:

1. **Live Usage Gauges:** Real-time progress bars showing daily limit consumption per provider account. Turns red at 90%.
2. **Delivery Health Table:** Per-product breakdown of sent, delivered, bounced, and open rates — aggregated from MongoDB.
3. **Permanent Log Search:** A searchable, filterable table of every email ever sent across all accounts and all time. Works for emails sent 2 years ago because logs are stored in MongoDB permanently.
4. **Alert Rules:** Configurable webhook alerts (Slack/Discord) when an account nears its daily limit or when a product's bounce rate exceeds a set threshold.
