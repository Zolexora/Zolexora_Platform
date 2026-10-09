# Zolexora Platform Architecture & Onboarding Guide

Welcome to the Zolexora Platform! This document outlines our Big Tech-standard monorepo architecture and provides a quick onboarding guide for running the platform locally.

## 🏗️ Monorepo Architecture

The repository is structured as a **pnpm workspace** orchestrated by **Turborepo**.

### Key Directories
- `products/` and `apps/`: Contains the deployable microservices and frontends (e.g., Zolexora ERP, Marketplace, Platform Admin).
- `packages/`: Contains shared internal packages that can be imported across products.
  - `@zolexora/eslint-config`: Single source of truth for linting.
  - `@zolexora/tsconfig`: Single source of truth for TypeScript compilation.
  - `api-contracts`: Shared TypeScript types and API interfaces.
- `.github/`: Contains reusable CI/CD workflows and automation scripts.
- `docs/`: Architecture Decision Records (ADRs) and documentation.
- `scripts/`: DevX scripts (including the universal startup script).

### Tech Stack Standards
- **Package Manager:** `pnpm` (required to resolve workspace dependencies).
- **Task Runner:** `turbo` (enables caching and parallel execution of builds and tests).
- **Containerization:** Every product has a local `compose.yaml` (with memory limits and health checks) and multi-stage `Dockerfile`s.
- **Testing:** Configured centrally via Vitest workspaces.

---

## 🚀 Onboarding: How to Run the Platform Locally

We use a universal startup script to make local development frictionless.

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Docker** and **Docker Compose**
- **Node.js** (v20+)
- **pnpm** (If not installed, the script will attempt to install it for you)

### 2. Start the Platform
Run the interactive startup script from the root of the repository:

```bash
./scripts/setup/start.sh
```

**What the script does:**
1. Installs all workspace dependencies via `pnpm install`.
2. Scans the repository for Dockerized products.
3. Prompts you with an interactive menu to select which product(s) to run.
4. Auto-generates missing `.env` files from `.env.example` templates.
5. Boots up the selected microservices via Docker Compose in the background.

### 3. Stopping Services
To tear down the containers, you can run `./scripts/setup/start.sh` and select the **Stop/Down all products** option, or manually run:
```bash
docker compose -f products/<product-name>/compose.yaml down
```

---

## 🔐 Security Standards
- **Gitleaks:** We use `gitleaks` via a pre-commit hook to prevent API keys and `.env` files from being committed. Ensure you run `pre-commit install` locally.
- **Docker Limits:** All containers are explicitly limited to 512MB RAM and 1 CPU core to prevent local resource exhaustion.
