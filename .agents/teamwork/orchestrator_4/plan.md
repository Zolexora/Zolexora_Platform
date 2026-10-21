# Implementation Plan: Zolexora Platform Admin Control Plane (`apps/platform-admin`)

## Overview
Build and verify the Zolexora Platform Admin control plane, consisting of:
1. High-performance FastAPI backend (`apps/platform-admin/backend` or configured package) on port `3081`
2. Next.js 14 fleet management dashboard (`apps/platform-admin/frontend` or configured package) on port `3082`
3. Monorepo container orchestration (`apps/platform-admin/compose.yaml`) with PostgreSQL on port `5440`

## Authoritative Requirements & References
- Request: `ORIGINAL_REQUEST.md` (Follow-up 2026-10-20T18:25:06Z)
- Architecture & Infrastructure: `docs/architecture/infrastructure/` (Docs 01–14 & `CREDENTIAL_STORAGE_PLAN.md`)
- Database Schema Migrations: `scripts/db/migrate-schemas.sql`
- Port Allocation Registry: `docs/architecture/infrastructure/14-monorepo-port-allocation-registry.md`
- Master Environment Template: `config/envs/platform-admin/.env.example`

## Milestones
- **M0: Survey & Technical Mapping (Phase 0)**
  - Map existing codebase, dependencies, documentation, ports, and schema migrations.
  - Survey Explorers / Spec Miners define concrete component breakdown and interfaces.
- **M1: Central Database Connection & Telemetry Router (FastAPI Backend - R1)**
  - Supabase PostgreSQL connection management routing (`core`, `commerce`, `business`, `ai_erp`) via Supavisor pooler port 6543.
  - MongoDB Atlas client pooling (`db_ai`, `db_tms`, `db_engage`).
  - Cloudflare R2 presigned URL generator.
  - Real-time capacity monitoring and query telemetry (500MB PG / 512MB Mongo).
  - Graceful degradation when credentials are missing or degraded.
- **M2: Dynamic Account Router & Multi-Provider Email Gateway (Backend - R2 & R3)**
  - Infisical runtime multi-account discovery and quota management (`/shared/`, `/platform-admin/`).
  - Dynamic failover and quota throttling (90% threshold).
  - Multi-provider email gateway (Resend, Brevo, SendGrid) with intelligent failover and usage quotas.
  - MongoDB email logging and permanent event archiving (`email_logs`).
- **M3: Command Center Fleet Dashboard (Next.js 14 Frontend - R4)**
  - Next.js 14 App Router on port 3082 connecting to backend on 3081.
  - Fleet Overview grid (microservices, accounts, databases across Vercel, Fly.io, Render, K3s).
  - Database & Storage Capacity visual gauges and hot data profiling.
  - Dynamic Account Manager with secret re-sync trigger and diagnostic banners.
  - Email Operations Panel with provider quota gauges, delivery health metrics, and searchable logs.
- **M4: Monorepo Port Standard & Container Orchestration (R5)**
  - Compose configuration (`apps/platform-admin/compose.yaml`) with healthchecks and prebuilt image tags.
  - Strict port alignment (`3081`, `3082`, `5440`).
  - Monorepo package scripts in root `package.json`.
- **M5: Comprehensive Verification & Gate Review**
  - Backend test suite execution (`pytest`).
  - Frontend compile and lint verification (`pnpm build`, `pnpm lint`, `tsc`).
  - Compose configuration validation.
  - Independent review, challenge, and forensic audit.
