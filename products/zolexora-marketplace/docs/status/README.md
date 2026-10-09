# Project status index

`docs/status/current-status.md` is the current project-status source of truth. Audit evidence belongs under `docs/status/audits/`; durable requirements and architecture belong under `docs/`. Root [`AGENTS.md`](../../AGENTS.md) defines required reading and maintenance rules.

- Current phase: Phase 1 — deterministic monorepo baseline (complete with blockers)
- Verdict: **PASS WITH BLOCKERS**
- Last verified commit: `87d751c455c6bd3dfd75d154389fb64745839e12` on `main`
- Last verification: 2026-07-14 (Asia/Kolkata)

## Documents

- [Current status](current-status.md) — phase, applications, architecture, blockers, and exact next action.
- [Phase 0 audit](audits/phase-0-baseline-audit.md) — complete repository evidence and recommendations.
- [Phase 1 audit](audits/phase-1-monorepo-baseline.md) — workspace, lockfile, CI, Docker, and command evidence.
- [Phase 4 audit](audits/phase-4-oracle-persistence-foundation.md) — Oracle schema, repository, migration, and verification evidence.
- [Feature matrix](feature-matrix.md) — verified/partial/missing capability by application.
- [Gap analysis](gap-analysis.md) — ranked gaps with evidence, dependencies, phases, and files.
- [Next actions](next-actions.md) — actionable work beginning with Phase 2 storefront foundation.
- [Test baseline](test-baseline.md) — commands, exits, classifications, and related gaps.
- [Durable project knowledge](../README.md).

Status files are evidence-based and updated at every phase end. Record the tested commit/date, preserve failures, use only the approved feature statuses, and never infer completion from UI/file existence.
