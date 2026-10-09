# Northflank Deployment Guide

## Recommended Services

- Container service for backend using the Docker image built from this repository.
- Container service for scheduler and async workers.
- Managed MariaDB or external SQL database service.
- Managed Redis or Redis container services for cache, queue, and socketio.
- Volume mounts for persistent `sites`, `logs`, and `backups`.

## Secrets

Map environment variables from `config/envs/zolexora-erp/erp.env.example` to Northflank secrets:

- MYSQL_ROOT_PASSWORD
- MYSQL_USER
- MYSQL_PASSWORD
- MAIL_LOGIN
- MAIL_PASSWORD
- CLOUDFLARE_API_TOKEN

## Networking

Use internal service names for backend-to-Redis and backend-to-DB connections.
Expose HTTP/HTTPS through Northflank routes with TLS.

## Deployment Strategy

- Build the Docker image in Northflank from repository source.
- Release to staging first, then production.
- Use health-check probes against `/api/method/frappe.ping` or root URL.
