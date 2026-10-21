# Survey Dispatch — Spec Miner 1: Infrastructure & Specifications

**Agent Working Directory**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_spec_miner_1`
**Project Root**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform`
**Authoritative Request**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md` (specifically under `## Follow-up — 2026-10-20T18:25:06Z`)

## Objectives
You are `survey_spec_miner_1` (archetype: `teamwork_preview_spec_miner`).
Your task is to conduct an authoritative specification extraction for the Zolexora Platform Admin control plane (`apps/platform-admin`):
1. Read `ORIGINAL_REQUEST.md` (under `## Follow-up — 2026-10-20T18:25:06Z`).
2. Read and extract exact specifications from:
   - `docs/architecture/infrastructure/` (Docs 01–14 and `CREDENTIAL_STORAGE_PLAN.md`)
   - `docs/architecture/infrastructure/14-monorepo-port-allocation-registry.md`
   - `scripts/db/migrate-schemas.sql`
   - `config/envs/platform-admin/.env.example`
3. Specifically detail:
   - Database connection architecture: Supabase Postgres projects (`core`, `commerce`, `business`, `ai_erp`) on port 6543 (Supavisor pooler); MongoDB Atlas databases (`db_ai`, `db_tms`, `db_engage`); Cloudflare R2 presigned URLs.
   - Telemetry & capacity thresholds: 500MB free-tier for PostgreSQL, 512MB for MongoDB Atlas, hot table stats.
   - Infisical paths (`/shared/`, `/platform-admin/`) and dynamic account failover rules (90% threshold).
   - Email provider integration contracts (Resend, Brevo, SendGrid), quota tracking, failover, and MongoDB `email_logs` schema.
   - Port allocations: Backend 3081, Frontend 3082, PostgreSQL offset 5440.

## Output Requirements
Produce a comprehensive handoff report at `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_spec_miner_1/handoff.md`.
Use `send_message` to notify the orchestrator when finished.


## 2026-10-20T19:20:38Z
[Message] timestamp=2026-10-20T19:20:38Z sender=484a39ec-460c-47ea-b91b-abd786450704 priority=MESSAGE_PRIORITY_HIGH content=You are survey_spec_miner_1.
Your working directory is /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_spec_miner_1.
Read your dispatch file at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_spec_miner_1/DISPATCH.md.
Read the authoritative request at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md.
Extract all relevant specifications from docs/architecture/infrastructure/, scripts/db/migrate-schemas.sql, config/envs/platform-admin/.env.example.
Write your complete handoff report to: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_spec_miner_1/handoff.md.
Notify me via send_message when complete.
