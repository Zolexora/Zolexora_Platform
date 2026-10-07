# Deployment Guide

Detailed steps to deploy Zolexora ERP to production.

---

## 1. Local & On-Premise Deployment

### Configuration
1. Copy `.env.example` to `.env`.
2. Update the credentials, port maps, and site parameters.
3. Keep default Redis configuration (cache, queue, and socketio addresses are mapped via container hostnames).

### Start Services
```bash
docker compose -f compose.yaml up -d --build
```

### Initialize Setup
```bash
./scripts/init-site.sh
```

---

## 2. Production Upgrades & Migrations

Zolexora ERP isolates custom logic into distinct apps (`zolexora_core`, `zolexora_branding`, etc.), keeping ERPNext and Frappe cores unmodified.

### Upgrading ERPNext Core
1. Update the base image tag in `docker/Dockerfile` (e.g. replacing `version-16` with a specific tag/release).
2. Rebuild container images:
   ```bash
   docker compose build --no-cache
   ```
3. Run container updates and database migrations:
   ```bash
   docker compose up -d
   docker compose exec backend bench --site site1.example.com migrate
   ```
This updates database tables, runs hooks setup, and builds compiled frontend assets without modifying Zolexora's code.
