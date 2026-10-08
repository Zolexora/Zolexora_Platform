# Centralized Containers & Orchestration

This directory houses all containerization specifications, Compose stacks, and Nginx reverse proxy templates for the platform.

## Directory Layout

```text
infrastructure/containers/
├── compose/
│   ├── api-scale.yml       # Multi-replica API scaling compose definition
│   ├── dev-services.yml    # Standard development service stack (Postgres, Redis, API)
│   ├── nginx.conf          # Core platform reverse proxy configuration
│   └── postgres-test.yml   # Ephemeral Postgres + Redis integration test stack
├── docker/
│   ├── Dockerfile          # Core Frappe / ERP platform image
│   ├── Dockerfile.api-node # Node.js TypeScript API runtime
│   ├── Dockerfile.api-python # Python FastAPI wheel-cached runtime
│   ├── Dockerfile.cra      # Static React / CRA build container
│   ├── Dockerfile.frontend # Multi-app monorepo frontend container
│   ├── Dockerfile.nextjs   # Next.js SSR Turbo-pruned container
│   ├── Dockerfile.vite-frontend # Vite frontend build container
│   └── postgres-test.compose.yml # Compose integration test runner
└── nginx/
    ├── api-docker.conf     # Internal Docker network API proxy
    ├── api-gateway.conf    # SSL terminating rate-limited API gateway
    ├── reverse-proxy.conf  # Upstream reverse proxy definition
    └── spa.conf            # Single-page application fallback routing
```

## Backward Compatibility

Symlinks are maintained at `infrastructure/compose` and `infrastructure/docker` to ensure zero breaking changes for existing commands and CI workflows.
