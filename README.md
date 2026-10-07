# Zolexora ERP

Zolexora ERP is an enterprise-ready, modular, and upgrade-safe ERP platform built on top of Frappe and ERPNext v16. It leverages a clean separation of concerns using four custom applications inside the `backend/` directory.

---

## Repository Structure

- `backend/`
  - `zolexora_core/` - Core business logic, setup scripts, base APIs, and DB validation.
  - `zolexora_branding/` - Stylesheets, javascript hooks, and logo assets for whitelabeling.
  - `zolexora_platform/` - Fleet management, logistics, manufacturing, and AI forecast integration.
  - `zolexora_integrations/` - Marketplace synchronization (e.g. buyer/inventory sync) and messaging channels.
- `infrastructure/compose/` - Nginx configuration containing full WebSocket routing support.
- `infrastructure/docker/` - Hardened Dockerfile installing Zolexora applications in dependency order.
- `scripts/` - Production site setup, database restore, and automated backup scripts.
- `docs/` - Complete architecture, deployment, developer, backup, and security guides.
- `compose.yaml` - Main Docker Compose manifest with network, volume, and service definitions.
- `.env.example` - Template for environment variables.

---

## Quick Start

### 1. Configure Environment
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

### 2. Run Containers
Build and launch the Docker stack:
```bash
docker compose -f compose.yaml up -d
```

### 3. Initialize Site & Install Applications
Run the provided bootstrap script to create the database, site, default roles, and install Zolexora's application packages:
```bash
./scripts/init-site.sh
```

---

## Key Maintenance Commands

### Taking Backups
To take a complete backup of the site database and files:
```bash
./scripts/backup.sh
```

### Restoring Site
To restore from an existing backup:
```bash
./scripts/restore.sh backups/<timestamp>
```
