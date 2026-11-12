# Deployment Guide

Detailed steps to deploy Zolexora ERP to production.

---

## 1. Local & On-Premise Deployment

### Configuration
1. Add the ERP keys from `docs/secrets.md` to Infisical (`/Zolexora_ERP`) and run `infisical login`.
2. Update the credentials, port maps, and site parameters.
3. Keep default Redis configuration (cache, queue, and socketio addresses are mapped via container hostnames).

### Start Services
```bash
pnpm docker:erp:start   # pulls images, then up -d; Infisical injects secrets
```

### Initialize Setup
```bash
./scripts/bootstrap-frappe-site.sh
```

---

## 2. Production Upgrades & Migrations

Zolexora ERP isolates custom logic into distinct apps (`zolexora_core`, `zolexora_branding`, etc.), keeping ERPNext and Frappe cores unmodified.

### Upgrading ERPNext Core
1. Update the base image tag in `docker/Dockerfile` (e.g. replacing `version-16` with a specific tag/release).
2. Merge to `main` (or run the ERP Docker images workflow); GitHub CI builds and pushes the new images to GHCR. Images are never built locally.
3. Pull the new images, then run container updates and database migrations:
   ```bash
   bash apps/platform-core/zolexora-erp/scripts/docker-start.sh pull
   bash apps/platform-core/zolexora-erp/scripts/docker-start.sh start
   docker compose exec backend bench --site site1.example.com migrate
   ```
This updates database tables, runs hooks setup, and builds compiled frontend assets without modifying Zolexora's code.
