# ADR 0012: Marketplace Cloud-Agnostic Baseline and Architecture Reset

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Marketplace Architecture & Platform Core Engineering
- **Supersedes:** [ADR 0002: Oracle Cloud Target](0002-oracle-cloud-target.md), [ADR 0010: Oracle Marketplace Persistence Foundation](0010-oracle-marketplace-persistence-foundation.md)

## Context

Phase 5 successfully demonstrated proof-of-concept relational persistence, forward-only Alembic migrations, constraints, and request-level storefront context resolution using an isolated disposable local Oracle Database 23ai Free environment. However, committing the platform runtime permanently to Oracle Database and OCI Autonomous Database introduced vendor lock-in, heavy proprietary SDK dependencies (`python-oracledb`), and cloud platform coupling.

To ensure long-term platform resilience, cost control, and flexibility, the active architecture direction for Zolexora Marketplace must transition to a cloud-agnostic, provider-neutral repository baseline.

## Decisions

1. **Supersede Oracle & OCI Targets:**
   Oracle Database and OCI Autonomous Database are no longer active infrastructure or database targets for Zolexora Marketplace. Application code, data access abstractions, and packaging must remain provider-neutral.

2. **Phase 5 Remains Historical Evidence:**
   Phase 4 and Phase 5 Oracle implementations, Alembic migration `0001_oracle_foundation`, dictionary introspection verification, and audit reports (`docs/status/audits/phase-5-oracle-runtime-validation.md`) are retained as historical engineering evidence. They must not be erased, rewritten, or deleted.

3. **PostgreSQL Recommendation & Decision Gate DG-01:**
   PostgreSQL is recommended as the future canonical relational database for Zolexora Marketplace. However, actual PostgreSQL schema design, migration creation, and driver adoption are deferred to Decision Gate DG-01 and MR-02. No PostgreSQL implementation or migration occurred in MR-00.

4. **Canonical Admin Hostname Adoption:**
   The canonical active domain for the shared Marketplace Admin panel is `admin.marketplace.zolexora.com`. The legacy hostname `marketplaceadmin.zolexora.com` is retired from all active configuration, CORS allowlists, and surface registries. The retired hostname must fail closed and never resolve to an authorized admin surface.

5. **Repository & Deployment Boundary:**
   This repository (`ZolexoraMarketplace`) owns application source code, product-local Dockerfiles, local Docker Compose contracts, health check endpoints, and Nginx reverse proxy templates. External cloud infrastructure provisioning (AWS, OCI, Cloudflare), DNS management, global monitoring, and server installation belong outside this repository (e.g., in separate deployment/infrastructure tooling).

6. **Marketplace and ERP Independence:**
   Zolexora Marketplace and Zolexora ERP remain completely independent commercial entities and codebases. They share no databases, authentication, sessions, secrets, deployments, or runtime infrastructure. Integration occurs solely via versioned asynchronous contracts (`contracts/zolexora-erp/v1`).

7. **No Data Migration in MR-00:**
   This ADR authorizes an architectural reset and configuration alignment only. No database migration, data mutation, schema alteration, or service deletion is authorized by this decision.

## Consequences

- Active application configuration and CORS rules recognize `admin.marketplace.zolexora.com`.
- Historical Oracle DDL and test scripts remain in place for reference until replaced in approved future phases.
- The codebase remains clean, provider-neutral, and ready for PostgreSQL foundation work under Decision Gate DG-01.
