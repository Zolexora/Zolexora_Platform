# 2. Monorepo Tooling and Dependency Management

Date: 2026-10-09

## Status
Accepted

## Context
The Zolexora Platform contains 10+ distinct products and shared packages. Previously, there was no root lockfile and no formal workspace linkage, leading to duplicate dependencies and inconsistent builds.

## Decision
We have adopted **pnpm workspaces** along with **Turborepo** (`turbo.json`) for task orchestration. 

## Consequences
- All developers must run `pnpm install` from the root.
- Builds are now cached and run in parallel using Turborepo.
- `packages/*` can be natively imported by `products/*` without symlinks.
