# Northflank Deployment Guide

Steps for deploying Zolexora ERP to Northflank container cloud.

---

## 1. Container Services

Configure four container services on Northflank referencing this repository:
1. **Backend Service:** Runs `bench start --port 8000`. Exposes port 8000 to the load balancer.
2. **Scheduler Service:** Runs `bench schedule`.
3. **Queue Workers (Short):** Runs `bench worker --queue short`.
4. **Queue Workers (Long):** Runs `bench worker --queue long`.
5. **WebSocket Service:** Runs `bench socketio` (exposing port 9000).

All services build from the same `docker/Dockerfile` base image.

---

## 2. Managed Add-ons

Create the following database and caching instances using Northflank add-ons:
- **MariaDB Database:** 10.11 or later. Set root password credentials as project-level secrets.
- **Redis (Cache):** Dedicated instance for memory storage.
- **Redis (Queue):** Dedicated instance with persistence enabled.
- **Redis (SocketIO):** Dedicated socket connection coordinator.

---

## 3. Persistent Volumes

Mount persistent volumes for:
- `/home/frappe/frappe-bench/sites` (shared across all container instances).
- `/home/frappe/frappe-bench/logs`.
- `/home/frappe/frappe-bench/backups`.
