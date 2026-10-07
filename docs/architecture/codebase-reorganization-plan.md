# Codebase Reorganization Plan

**Date:** 2026-10-08
**Project:** Zolexora_Platform
**Scope:** Stage A Architecture Audit

## Execution Strategy
The following steps will be executed sequentially during Stage B to realize the Target Architecture. All steps prioritize non-destructive deletion (only deleting provably empty or speculative folders) and avoid moving working code unnecessarily.

### Step 1: Purge `.gitkeep` Pandemic
- Execute a global find and delete for all `.gitkeep` files in the repository (excluding `.git/`).
- *Rationale*: `.gitkeep` files are artificially inflating the repository structure and preventing Git from cleaning up empty directories automatically.

### Step 2: Delete Empty Architectural Shells
- Remove the following top-level directories which contain no implementation code:
  - `rm -rf clients/`
  - `rm -rf packages/`
  - `rm -rf platform/`
  - `rm -rf solutions/`
  - `rm -rf tests/`
- *Rationale*: These directories were created speculatively and contain only scaffolding. Real tests exist inside `products/*/tests`.

### Step 3: Delete Speculative Products
- Remove the following product directories which contain only a `README.md` and empty subdirectories:
  - `rm -rf products/ads/`
  - `rm -rf products/analytics/`
  - `rm -rf products/cloud/`
- *Rationale*: "Avoid empty architectural shells." These products do not exist in code yet.

### Step 4: Clean up `infrastructure/` and `scripts/`
- Delete all empty subdirectories in `infrastructure/` (e.g., `environments/`, `monitoring/`) ensuring real code like `ZolexoraDeployment`, `docker/`, and `compose/` remains untouched.
- Delete all empty subdirectories in `scripts/` (e.g., `backup/`, `deployment/`) leaving the flat shell scripts in place.
- *Rationale*: Removes deeply nested but empty operational folders.

### Step 5: Post-Reorganization Verification
- Run `tree -a` to verify the resulting structure matches the `target-repository-architecture.md`.
- Verify the Frappe ERP boundary (`products/ZolexoraERP/backend/`) remains intact.
- Verify other product boundaries remain intact.
- Run `git status` to ensure only deletions of empty shells occurred, with no loss of `.py`, `.ts`, `.tsx`, `.sh`, etc.

## Rollback Plan
- Since no real files are being deleted (only `.gitkeep` files, empty folders, and speculative `README.md` files), a rollback is simply `git checkout -- .` and `git clean -fd`.
