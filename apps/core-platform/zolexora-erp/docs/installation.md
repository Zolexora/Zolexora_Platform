# Installation Guide

## Prerequisites

- Docker 24+
- Docker Compose 2+
- Git
- Linux or macOS host environment

## Local Setup

1. Add the ERP keys from `docs/secrets.md` to Infisical (`/Zolexora_ERP`) and run `infisical login`.
2. Update environment values for your database, Redis, email, and site settings.
3. Start the containers:

```bash
pnpm docker:erp:start   # pulls images, then up -d; Infisical injects secrets
```

4. Initialize the site:

```bash
chmod +x scripts/init-site.sh
./scripts/bootstrap-frappe-site.sh
```

5. Open the site in your browser at `http://localhost:8000`.
