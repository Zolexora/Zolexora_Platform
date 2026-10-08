# Platform Infrastructure

This directory houses all operational, container, database, cloud, and host deployment infrastructure for the Zolexora Platform monorepo. Infrastructure is entirely centralized by technical and operational concern without product-specific silos.

## Centralized Structure

```text
infrastructure/
├── cloud/                  # Cloud platform and PaaS specifications
│   └── render.yaml         # Cloud application service specifications
│
├── containers/             # Container builds, Compose orchestration, and Nginx ingress
│   ├── compose/            # Modular Docker Compose specifications
│   │   ├── api-scale.yml   # Multi-replica API scaling compose definition
│   │   ├── dev-services.yml# Standard development service stack (Postgres, Redis, API)
│   │   ├── nginx.conf      # Platform core reverse proxy configuration
│   │   └── postgres-test.yml # Ephemeral Postgres + Redis integration test stack
│   ├── docker/             # Standardized Dockerfile blueprints
│   │   ├── Dockerfile      # Core Frappe / ERP platform image
│   │   ├── Dockerfile.api-node    # Node.js TypeScript API runtime
│   │   ├── Dockerfile.api-python  # Python FastAPI wheel-cached runtime
│   │   ├── Dockerfile.cra         # Static React / CRA build container
│   │   ├── Dockerfile.frontend    # Multi-app monorepo frontend container
│   │   ├── Dockerfile.nextjs      # Next.js SSR Turbo-pruned container
│   │   └── Dockerfile.vite-frontend # Vite frontend build container
│   └── nginx/              # Reusable Nginx proxy, gateway, and routing configurations
│       ├── api-docker.conf # Internal Docker network API proxy
│       ├── api-gateway.conf# SSL terminating rate-limited API gateway
│       ├── reverse-proxy.conf # Upstream reverse proxy definition
│       └── spa.conf        # Single-page application fallback routing
│
├── database/               # Centralized database schemas, migrations, and runbooks
│   ├── README.md           # Database architecture and operational procedures
│   ├── migrations/         # Baseline database migrations
│   │   ├── 001_auth_migration.sql
│   │   ├── 20260530151849_init_schema.sql
│   │   └── 202609100001_phase1_foundation.sql
│   └── schemas/            # Canonical database schemas
│       ├── schema.sql
│       └── schema_v2.sql
│
├── deployment/             # Host-level bare-metal/VPS deployment & DR framework
│   ├── backup.sh           # System backup automation
│   ├── deploy.sh           # Immutable release deployment runner
│   ├── doctor.sh           # Read-only host diagnostics & health audits
│   ├── healthcheck.sh      # Service health verification
│   ├── install.sh          # Qualified system package & filesystem provisioning
│   ├── restore.sh          # Disaster recovery restore runner
│   ├── rollback.sh         # Fast rollback to previous release
│   ├── verify-backup.sh    # Cryptographic & structural backup verification
│   ├── adapters/           # Modular adapters (DNS, TLS, SSH, Backup)
│   ├── applications/       # Application deployment contracts
│   ├── core/               # Shell runtime, validation, and execution libraries
│   ├── docs/               # Deployment architecture, ADRs, DR runbooks
│   └── tests/              # Contract, unit, and integration test suite
│
└── supabase/               # Centralized Supabase BaaS configuration
    ├── config.toml         # Base Supabase platform configuration
    ├── .gitignore          # Supabase environment and cache exclusions
    └── migrations/         # Symlinked to database/migrations/
```

## Quick Reference

| Operational Tier | Path | Purpose |
|------------------|------|---------|
| **Cloud** | [`cloud/`](./cloud/) | PaaS specifications and cloud service definitions. |
| **Containers** | [`containers/`](./containers/) | Reusable Dockerfiles, Compose stacks, and Nginx proxy configs. |
| **Database** | [`database/`](./database/) | Centralized database schemas, migrations, and operational tooling. |
| **Deployment** | [`deployment/`](./deployment/) | Bare-metal/VPS deployment engine, system diagnostics, and disaster recovery. |
| **Supabase** | [`supabase/`](./supabase/) | Centralized Supabase local development and migration management. |

## Canonical Paths and Compatibility Symlinks

For seamless backward compatibility with existing build tooling and workflows:
- `infrastructure/compose` -> `containers/compose`
- `infrastructure/docker` -> `containers/docker`
- `infrastructure/deployment/` is the canonical deployment directory (legacy `infrastructure/ZolexoraDeployment` removed).
