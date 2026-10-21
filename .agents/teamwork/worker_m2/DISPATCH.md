# Worker Dispatch — Milestone 2: Command Center Fleet Dashboard (Next.js 14 Frontend)

**Agent Working Directory**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m2`
**Project Root**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform`
**Authoritative Request**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md` (under `## Follow-up — 2026-10-20T18:25:06Z`)
**Project Scope & Interfaces**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4/PROJECT.md`
**Architectural Blueprint**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/handoff.md` (Section 2.3)

## Write Ownership
You exclusively own:
`apps/platform-admin/frontend/`
- `src/lib/types.ts`
- `src/lib/api.ts`
- `src/components/` (`Header.tsx`, `DiagnosticBanner.tsx`, `FleetGrid.tsx`, `CapacityGauge.tsx`, `HotTableTable.tsx`, `AccountTable.tsx`, `EmailQuotaBar.tsx`, `EmailLogViewer.tsx`)
- `src/app/` (`layout.tsx`, `page.tsx`, `databases/page.tsx`, `accounts/page.tsx`, `email/page.tsx`, `globals.css`)
- `package.json`, `tailwind.config.ts`, `tsconfig.json`

## Requirements to Implement (R4):
1. **Fleet Overview Grid (`page.tsx`)**:
   - Real-time status grid of all registered accounts, databases, and microservices across Production-1 (Vercel, Fly.io, Render) and Production-2 (K3s).
   - Live status indicator (Operational, Degraded, Critical), latency, endpoint URLs.
2. **Database & Storage Capacity (`databases/page.tsx`)**:
   - Visual progress gauges for 500MB free-tier PostgreSQL limit (Supabase Core, Commerce, Business, AI & ERP) and 512MB free-tier MongoDB limit.
   - Color coding: `<70%` green, `70-89%` amber warning, `>=90%` red critical with archive recommendation.
   - Table size breakdowns and hot data profiling (`ims.products`, `marketplace.sellers`, `tms.shipments`, etc.).
   - Table pinning control (`[ 🔒 Pin to Hot Storage ]`).
3. **Dynamic Account Manager (`accounts/page.tsx`)**:
   - Status inspection table (`ACTIVE`, `DRAINING`, `DISCONNECTED`, `QUOTA_THROTTLED`) with monthly/daily quota progress.
   - Manual trigger button to re-sync secrets (`POST /api/accounts/sync`).
   - Diagnostic alert banners for missing credentials or degraded accounts (`ROUTER_CREDENTIAL_MISSING`).
   - Account status toggle dropdown (`PUT /api/accounts/{account_id}/status`).
4. **Email Operations Panel (`email/page.tsx`)**:
   - Daily provider quota progress gauges (Resend 100/d, Brevo 300/d, SendGrid 100/d).
   - Delivery health metrics cards (Total sent today, delivery rate, bounce rate).
   - Searchable permanent delivery logs table querying `GET /api/email/logs` with filter by product, recipient, provider, and status.
5. **App Layout & Navigation (`layout.tsx`, `Header.tsx`)**:
   - Clean top header with platform title, environment badge, quick health pill, and navigation links (`/` Fleet, `/databases` Capacity, `/accounts` Accounts, `/email` Email Operations).
   - Responsive Tailwind CSS styling.
6. **API Integration & Fallbacks (`src/lib/api.ts`, `types.ts`)**:
   - Target `NEXT_PUBLIC_API_URL` (default `http://localhost:3081`).
   - Handle server-side fetching, client-side revalidation, and graceful fallback when backend is temporarily offline.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Criteria:
- Next.js application compiles cleanly: `pnpm --filter @zolexora/platform-admin-frontend build` succeeds with zero errors.
- ESLint and TypeScript checks pass: `pnpm --filter @zolexora/platform-admin-frontend lint` and `tsc` clean.
- Dashboard pages correctly query and render live data from the backend API endpoints.
- Handoff report written to `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m2/handoff.md`.
- Notify orchestrator via `send_message`.

## 2026-10-20T21:55:47Z
You are worker_m2.
Your working directory is /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m2.
Read your dispatch file at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m2/DISPATCH.md.
Read the authoritative request at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md.
Read the project scope & interface contracts at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4/PROJECT.md.
Read the architectural blueprint at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/handoff.md (Section 2.3).

Implement Milestone 2: Command Center Fleet Dashboard (Next.js 14 Frontend - Requirement R4) in apps/platform-admin/frontend/.
Ensure pnpm build and lint succeed cleanly with zero errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m2/handoff.md.
Notify me via send_message when complete.
