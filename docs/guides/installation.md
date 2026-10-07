# Installation Guide

## Prerequisites

- Docker 24+
- Docker Compose 2+
- Git
- Linux or macOS host environment

## Local Setup

1. Copy `.env.example` to `.env`.
2. Update environment values for your database, Redis, email, and site settings.
3. Start the containers:

```bash
docker compose -f compose.yaml up -d
```

4. Initialize the site:

```bash
chmod +x scripts/init-site.sh
./scripts/init-site.sh
```

5. Open the site in your browser at `http://localhost:8000`.
