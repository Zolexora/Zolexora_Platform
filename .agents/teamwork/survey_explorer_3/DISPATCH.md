# Survey Dispatch — Explorer 3: Backend & Frontend Architecture Requirements & Test Strategy

**Agent Working Directory**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3`
**Project Root**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform`
**Authoritative Request**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md` (specifically under `## Follow-up — 2026-10-20T18:25:06Z`)

## Objectives
You are `survey_explorer_3` (archetype: `teamwork_preview_explorer`).
Your task is to analyze the technical architecture, API schemas, and test strategy for requirements R1–R5:
1. Read `ORIGINAL_REQUEST.md` (under `## Follow-up — 2026-10-20T18:25:06Z`).
2. Analyze Backend Requirements:
   - FastAPI endpoints:
     - `GET /api/health`
     - `GET /api/health/databases` (latency & status across targets, graceful degradation with empty/missing credentials)
     - `GET /api/accounts` (runtime account discovery, quota status)
     - `GET /api/telemetry/capacity` (hot tables, storage metrics against free tier limits)
     - Email endpoints (transactional email dispatch, multi-provider failover)
   - Pytest strategy: unit tests and integration tests for routing, graceful degradation, failover logic.
3. Analyze Frontend Requirements:
   - Next.js 14 fleet management dashboard:
     - Fleet Overview (real-time status grid across Vercel, Fly.io, Render, K3s)
     - Database & Storage Capacity (visual progress gauges for 500MB/512MB limits, table size breakdowns)
     - Dynamic Account Manager (status inspection: ACTIVE, DRAINING, DISCONNECTED; secret re-sync trigger; diagnostic banners)
     - Email Operations Panel (provider quota gauges, delivery health, permanent searchable logs)
   - Clean compilation, ESLint & TypeScript clean pass.
4. Analyze Container & Monorepo Requirements:
   - `apps/platform-admin/compose.yaml` (ghcr.io image tags, pull_policy: missing, healthchecks)
   - Port registry adherence (3081 backend, 3082 frontend, 5440 postgres).

## Output Requirements
Produce a comprehensive handoff report at `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/handoff.md`.
Use `send_message` to notify the orchestrator when finished.

## 2026-10-20T19:20:38Z
You are survey_explorer_3.
Your working directory is /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3.
Read your dispatch file at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/DISPATCH.md.
Read the authoritative request at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md.
Analyze API schemas, test strategy, frontend dashboard requirements, and container orchestration specifications.
Write your complete handoff report to: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/handoff.md.
Notify me via send_message when complete.
