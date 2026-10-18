## 2026-10-18T07:56:57Z
You are Worker 2 subagent (Role: "Plan Hardening Author & Verifier").
Your working directory is `/workspaces/Zolexora_Platform/.agents/teamwork/worker_m2_2`.

MANDATORY: Read `/workspaces/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md` (especially section `## Follow-up — 2026-10-17T12:15:26Z`), `/workspaces/Zolexora_Platform/.agents/teamwork/orchestrator_3/SCOPE.md`, and `/workspaces/Zolexora_Platform/.agents/teamwork/orchestrator_3/GATE_STATUS.md`.
Read the review feedback and findings from:
- `/workspaces/Zolexora_Platform/.agents/teamwork/reviewer_m3_2/handoff.md`
- `/workspaces/Zolexora_Platform/.agents/teamwork/challenger_m3_1/handoff.md`
- `/workspaces/Zolexora_Platform/.agents/teamwork/challenger_m3_2/handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL USER GATE & WRITE BOUNDARIES:
- Exclusive write ownership: You ONLY own updating `/workspaces/Zolexora_Platform/docs/REORGANIZATION_PLAN.md` and `/workspaces/Zolexora_Platform/docs/PONYTAIL_AUDIT.md`.
- STRICTLY NON-DESTRUCTIVE: Do NOT modify, delete, or move ANY existing source code files, config files, scripts, or directories in the monorepo.

Your Hardening Tasks:
1. In `/workspaces/Zolexora_Platform/docs/REORGANIZATION_PLAN.md`:
   a. Reconcile Auth Architecture: Remove `@zolexora/organization-auth` and `@zolexora/user-auth-supabase` from Section 3 (Target Topology tree) and Section 4.6 (auth packages), since they are verified dead code with 0 callers and scheduled for deletion in Section 5 & Stage 1.
   b. Explicit Git Submodule Invariant: Add a dedicated subsection in Section 2/3 explicitly documenting `.gitmodules` managing `products/zolexora-erp/backend/{frappe,erpnext,payments}` as strictly immutable upstream submodules that must never be altered or relocated.
   c. TMS Dockerfile.web & compose.yaml Synchronization: In Stage 3, explicitly detail updating `COPY` paths and `APP_PATH` in `products/zolexora-tms/Dockerfile.web` and `products/zolexora-tms/compose.yaml` when flattening `apps/frontend/zolexora-tms` to `apps/tms-web` and normalizing auth paths.
   d. Mobile Expo/Metro Hoisting: In Stage 4, add architectural guidance for React Native / Expo `metro.config.js` (`watchFolders`) to resolve hoisted packages in root pnpm store.
   e. Consumer Import Updating in Stage 2: Add explicit step that all internal source code import specifiers (`import from "@workspace/..."`) must be updated across consumer files when packages are renamed.
   f. Pre-Existing Typecheck Clusters: Add a dedicated "Pre-Existing Typecheck Clusters & Guardrails" section documenting the 4 pre-existing TypeScript error clusters (Rentoeasy JSX TS2786, TTC Next.js TS2742, TTC Marketplace TS2786, Engage composite TS6305) and the `zolexora-tms` duplicate name collision.
   g. CI Workflow Path Updating: In Stage 1 & Stage 3, include updating `.github/workflows/platform-ci.yml` paths for `compose.yaml` and doc paths so CI doesn't fail.
   h. Uncatalogued Symlink: Add `infrastructure/supabase/migrations -> ../database/migrations` to the deprecation/cleanup matrix.
   i. Dockerfile Lockfile Synchronization: In Stage 4, document updating all 10 Dockerfiles that currently `COPY` nested lockfiles to copy canonical root lockfile or use workspace packaging.

2. In `/workspaces/Zolexora_Platform/docs/PONYTAIL_AUDIT.md`:
   a. Clarify that `.pyc` files are untracked local disk artifacts from test runs (already gitignored), while 3 `tsconfig.tsbuildinfo` files are actively tracked in git index requiring `git rm --cached`.
   b. Clarify script case-sensitivity: exactly 5 script files contain 35+ broken PascalCase directory lookups failing on Linux.

3. Run the non-destructive verification pipeline commands to confirm zero regressions:
   - `pnpm -r ls --depth -1`
   - `pnpm vitest run platform/`
   - `python3 tests/e2e/tms/run_all.py`

Write your completion report to `/workspaces/Zolexora_Platform/.agents/teamwork/worker_m2_2/handoff.md` and send a message back to orchestrator (`d582eca5-d0cb-4338-af01-686a1da81ecd`).


## 2026-10-18T08:05:23Z
**Context**: Server restart recovery & Milestone 2 hardening execution.
**Content**: The server was restarted and the session was resumed. Your task instructions and progress are preserved in your directory.
**Action**: Please resume execution immediately:
1. Update `/workspaces/Zolexora_Platform/docs/REORGANIZATION_PLAN.md` with:
   - Reconcile Auth Architecture: remove `@zolexora/organization-auth` and `@zolexora/user-auth-supabase` from Section 3 & 4.6 (they are dead code marked for deletion).
   - Add explicit Git Submodule Invariant for `products/zolexora-erp/backend/{frappe,erpnext,payments}` managed by `.gitmodules`.
   - Add TMS Dockerfile.web and compose.yaml update instructions in Stage 3 for frontend flattening and auth path normalization.
   - Add React Native/Expo metro.config.js watchFolders hoisting guidance in Stage 4.
   - Add consumer import specifier updating in Stage 2.
   - Add dedicated section for the 4 pre-existing TypeScript error clusters.
   - Add `.github/workflows/platform-ci.yml` path updates in Stage 1 & 3.
   - Catalog `infrastructure/supabase/migrations` symlink in the cleanup matrix.
   - Add Dockerfile lockfile synchronization across the 10 Dockerfiles in Stage 4.
2. Update `/workspaces/Zolexora_Platform/docs/PONYTAIL_AUDIT.md`:
   - Clarify untracked `.pyc` files vs git-tracked `tsconfig.tsbuildinfo` files.
   - Clarify that 5 script files contain 35+ broken PascalCase directory lookups.
3. Run the non-destructive verification pipeline commands (`pnpm -r ls --depth -1`, `pnpm vitest run platform/`, `python3 tests/e2e/tms/run_all.py`).
4. Write `handoff.md` and report completion back to me. Keep all codebase source/config files strictly untouched.
