# Zolexora Platform Ports

Here is the complete registry of ports running locally for your ecosystem:

> [!NOTE] All frontend applications and backend APIs are now routed through their respective stack's Nginx gateway. The Nginx gateways listen on the host in the `307X-310X` range, resolving all local port conflicts system-wide.
> The `.env` file at the repo root controls the ERP/infra ports.

## Core Backend (ERP / Root Compose)
| Service | Port | Local URL | Note |
|---------|------|-----------|------|
| **Zolexora Backend (Frappe)** | `9100` | [http://localhost:9100](http://localhost:9100) |
| **Nginx (HTTP)** | `9180` | [http://localhost:9180](http://localhost:9180) |
| **Nginx (HTTPS)** | `9543` | [https://localhost:9543](https://localhost:9543) |

## Product Nginx Gateways

| Product Family | Nginx Gateway Port | Local URL |
|----------------|--------------------|-----------|
| **Maun Kavach** | `3071` | [http://localhost:3071](http://localhost:3071) |
| **Zolexora IMS** | `3072` | [http://localhost:3072](http://localhost:3072) |
| **Zolexora TMS** | `3074` | [http://localhost:3074](http://localhost:3074) |
| **ClarityFi** | `3075` | [http://localhost:3075](http://localhost:3075) |
| **Rento Easy** | `3076` | [http://localhost:3076](http://localhost:3076) |
| **Zolexora Engage** | `3077` | [http://localhost:3077](http://localhost:3077) |
| **Zolexora Marketplace** | `3079` | [http://localhost:3079](http://localhost:3079) |
| **The Textile Care** | `3080` | [http://localhost:3080](http://localhost:3080) |
| **Zolexora AI** | `3091` | [http://localhost:3091](http://localhost:3091) |

> [!NOTE] Platform Admin does not use a central Nginx gateway currently.
| **Platform Admin** | `3081` (Backend) | [http://localhost:3081](http://localhost:3081) |
| | `3082` (Frontend) | [http://localhost:3082](http://localhost:3082) |

> [!NOTE] Mobile apps (like Expo for Seller Mobile on `8082`, etc.) are also actively running, but usually require an emulator or LAN-connected physical device.

## Infrastructure Services
| Service | Port | Local URL |
|---------|------|-----------|
| **Redis Cache** | `6379` | `redis://localhost:6379` |
| **PostgreSQL DB** | `5432` | `postgresql://postgres:postgres@localhost:5432` |
