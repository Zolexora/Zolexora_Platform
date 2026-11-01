# Centralized Containers & Orchestration

This directory houses all containerization specifications, Compose stacks, and Nginx reverse proxy templates for the platform.

## Directory Layout

```text
infrastructure/containers/
├── compose/
│   ├── Dockerfile.nginx            # Shared nginx gateway image
│   ├── nginx.conf
│   └── nginx-conf.d/default.conf
└── docker/
    ├── Dockerfile                  # Frappe / ERP image
    ├── Dockerfile.api-python       # FastAPI runtime (+ .dockerignore)
    ├── Dockerfile.cra              # Static React / CRA build
    ├── Dockerfile.nextjs           # Next.js SSR, Turbo-pruned (+ .dockerignore)
    └── postgres-test.compose.yml   # Ephemeral Postgres + Redis test stack
```

## Backward Compatibility

Symlinks are maintained at `infrastructure/compose` and `infrastructure/docker` to ensure zero breaking changes for existing commands and CI workflows.
