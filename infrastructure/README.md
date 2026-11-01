# Platform Infrastructure

This directory houses shared container, database and cloud infrastructure for the Zolexora Platform monorepo. Product stacks (`compose.yaml`, Dockerfiles, deploy targets) live in each product; only cross-product pieces live here.

## Centralized Structure

```text
infrastructure/
├── cloud/
│   └── render.yaml                     # Render service specifications
├── containers/
│   ├── README.md
│   ├── compose/                        # Shared nginx gateway image
│   │   ├── Dockerfile.nginx
│   │   ├── nginx.conf
│   │   └── nginx-conf.d/default.conf
│   └── docker/                         # Reusable Dockerfile blueprints
│       ├── Dockerfile                  # Frappe / ERP image
│       ├── Dockerfile.api-python       # FastAPI runtime (+ .dockerignore)
│       ├── Dockerfile.cra              # Static React / CRA build
│       ├── Dockerfile.nextjs           # Next.js SSR, Turbo-pruned (+ .dockerignore)
│       └── postgres-test.compose.yml   # Ephemeral Postgres + Redis test stack
├── database/
│   ├── README.md
│   ├── migrations/                     # Baseline SQL migrations
│   └── schemas/                        # schema.sql, schema_v2.sql
├── supabase/
│   ├── config.toml
│   └── migrations -> ../database/migrations
├── compose -> containers/compose       # compatibility symlink
└── docker  -> containers/docker        # compatibility symlink
```

## Quick Reference

| Operational Tier | Path | Purpose |
|------------------|------|---------|
| **Cloud** | [`cloud/`](./cloud/) | PaaS specifications and cloud service definitions. |
| **Containers** | [`containers/`](./containers/) | Reusable Dockerfiles, the shared nginx gateway image, and a Postgres test stack. |
| **Database** | [`database/`](./database/) | Centralized database schemas, migrations, and operational tooling. |
| **Supabase** | [`supabase/`](./supabase/) | Centralized Supabase local development and migration management. |

## Canonical Paths and Compatibility Symlinks

For seamless backward compatibility with existing build tooling and workflows:
- `infrastructure/compose` -> `containers/compose`
- `infrastructure/docker` -> `containers/docker`
- `infrastructure/supabase/migrations` -> `database/migrations`

There is no host-level deployment framework here; ERP backup/restore scripts live in `products/zolexora-erp/scripts/`.
