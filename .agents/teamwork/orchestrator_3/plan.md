# Execution Plan: Zolexora Platform Monorepo Audit & Reorganization Architecture

## Objective
Execute a comprehensive, repository-wide Ponytail audit, author a phased codebase reorganization architecture blueprint, formulate a high-confidence dead code / cleanup target inventory, and validate repository verification tooling baseline, strictly observing the critical user gate (no codebase file deletions/moves prior to approval).

## Phases & Verification Steps

### Phase 1: Survey & Parallel Exploration
1. Spawn Explorer 1 (Ponytail Audit Specialist): Scan all packages, products, platform services, scripts, and root configs for over-engineering, dead code, single-implementation abstractions, redundant wrappers, hand-rolled standard library features. Deliver findings categorized by ponytail tags (`delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`) with net metrics.
2. Spawn Explorer 2 (Monorepo Architecture Specialist): Deeply inspect monorepo directories, workspace structures (`packages/*`, `products/*`, `platform/*`, `apps/*`, `scripts/*`), package.json workspace configs, inter-package dependencies, circular/leaky imports, and design target modular architecture.
3. Spawn Explorer 3 (Verification & Monorepo Tooling Specialist): Identify package manager (pnpm/npm/yarn), workspace scripts, TypeScript configs, ESLint configs, test runners (vitest/jest), run non-destructive baseline checks (typecheck, lint, test, build), and document health status.

### Phase 2: Author Documentation Artifacts & Cleanup Plan
1. Spawn Worker: Synthesize Explorer findings and author:
   - `docs/PONYTAIL_AUDIT.md`: Categorized, ranked findings, standard tags, line/dependency net reduction estimates.
   - `docs/REORGANIZATION_PLAN.md`: Target directory layout, package/product boundary rules, dependency graph, deprecation matrices, phased migration stages (Phase 0 preparation -> Phase 1 cleanup -> Phase 2 restructuring -> Phase 3 tooling & DX), and automated verification pipeline definitions.
2. Verify artifacts match requirements in `ORIGINAL_REQUEST.md` and follow Ponytail and monorepo best practices.

### Phase 3: Gate & Independent Verification
1. Spawn 2 Reviewers independently to verify completeness, consistency, feasibility, and adherence to requirements.
2. Spawn 2 Challengers to stress-test the reorganization plan (boundary conflicts, missing dependencies, broken imports risk, migration sequencing risks).
3. Spawn Forensic Auditor to verify integrity (no fake/hardcoded reports, thorough coverage across monorepo).
4. Evaluate gate status in `GATE_STATUS.md`.

### Phase 4: User Approval Proposal Presentation
1. Present comprehensive findings, executive summary, ponytail audit metrics, reorganization blueprint, cleanup targets, and baseline verification results to the user / parent sentinel.
2. Wait for user approval before any file modifications/deletions.
