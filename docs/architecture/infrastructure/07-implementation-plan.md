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

## Phase 6: The Serverless Cloud Backup System
*Goal: Ultimate peace-of-mind defense against cloud provider lockouts, completely automated.*

- [ ] **GitHub Actions Workflow:** Create `.github/workflows/daily-backup.yml` to trigger every night at 2:00 AM.
- [ ] **Authentication Setup:** Add Google Drive Service Account JSON / OneDrive OAuth refresh tokens into GitHub Secrets.
- [ ] **Postgres Backups:** Automate `pg_dump` iteration across all configured Postgres URIs.
- [ ] **Mongo Backups:** Automate `mongodump` execution.
- [ ] **rclone Pipeline:** Automate `rclone copy` to sync the zipped database dumps directly into the external cloud drives (GDrive, OneDrive, Nextcloud).
