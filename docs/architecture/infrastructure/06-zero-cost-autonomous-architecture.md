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

## 5. The Ultimate Failsafe: Local Offline Backup
To mitigate the risk of cloud providers suspending free-tier accounts, a `local_backup.sh` script is maintained for local execution.

*   When executed on a local machine, the script iterates over the central `.env` credentials.
*   It executes `pg_dump` for all Supabase Postgres clusters.
*   It executes `mongodump` for all MongoDB Atlas clusters.
*   It uses the AWS CLI to sync all Cloudflare R2 buckets to a local hard drive.
*   **Result:** A 100% complete, vendor-agnostic snapshot of the entire Zolexora Platform, completely insulated from cloud provider policies.
