# Zolexora Platform Ports

Here is the complete registry of ports running locally for your ecosystem:

## Core Backend (ERP)
| Service | Port | Local URL |
|---------|------|-----------|
| **Zolexora Backend (Frappe)** | `8000` | [http://localhost:8000](http://localhost:8000) |
| **Nginx (HTTP)** | `8080` | [http://localhost:8080](http://localhost:8080) |
| **Nginx (HTTPS)** | `8443` | [https://localhost:8443](https://localhost:8443) |

## Frontend Applications

| Product Family | App Name | Port | Local URL |
|----------------|----------|------|-----------|
| **The Textile Care** | Admin Web | `3010` | [http://localhost:3010](http://localhost:3010) |
| | Marketplace Web | `3011` | [http://localhost:3011](http://localhost:3011) |
| | Seller Web | `3012` | [http://localhost:3012](http://localhost:3012) |
| | Backend API | `4010` | [http://localhost:4010](http://localhost:4010) |
| **Rento Easy** | Web Tenant | `3021` | [http://localhost:3021](http://localhost:3021) |
| | Web Owner | `3022` | [http://localhost:3022](http://localhost:3022) |
| | Web Admin | `3023` | [http://localhost:3023](http://localhost:3023) |
| | Backend API | `4020` | [http://localhost:4020](http://localhost:4020) |
| **Zolexora TMS** | TMS Frontend | `3031` | [http://localhost:3031](http://localhost:3031) |
| | TMS Admin | `3032` | [http://localhost:3032](http://localhost:3032) |
| | Backend API | `4030` | [http://localhost:4030](http://localhost:4030) |
| **Zolexora Engage** | Client Web | `3041` | [http://localhost:3041](http://localhost:3041) |
| | Backend API | `3040` | [http://localhost:3040](http://localhost:3040) |
| **Zolexora IMS** | Admin Frontend | `3051` | [http://localhost:3051](http://localhost:3051) |
| | User Frontend | `3052` | [http://localhost:3052](http://localhost:3052) |
| | Admin Backend | `4051` | [http://localhost:4051](http://localhost:4051) |
| | User Backend | `4050` | [http://localhost:4050](http://localhost:4050) |
| **Maun Kavach** | Web | `3071` | [http://localhost:3071](http://localhost:3071) |
| **ClarityFi** | Web | `3081` | [http://localhost:3081](http://localhost:3081) |
| **Zolexora AI** | Frontend | `3091` | [http://localhost:3091](http://localhost:3091) |
| | Backend API | `4090` | [http://localhost:4090](http://localhost:4090) |
| **Zolexora Marketplace**| Admin Portal | `3101` | [http://localhost:3101](http://localhost:3101) |
| | Seller Portal | `3102` | [http://localhost:3102](http://localhost:3102) |
| | Zolexora Shop | `3103` | [http://localhost:3103](http://localhost:3103) |
| | Mahila Madel | `3104` | [http://localhost:3104](http://localhost:3104) |
| | Backend API | `4100` | [http://localhost:4100](http://localhost:4100) |

> [!NOTE] Mobile apps (like Expo for Seller Mobile on `8082`, etc.) are also actively running, but usually require an emulator or LAN-connected physical device.

## Infrastructure Services
| Service | Port | Local URL |
|---------|------|-----------|
| **Redis Cache** | `6379` | `redis://localhost:6379` |
| **PostgreSQL DB** | `5432` | `postgresql://postgres:postgres@localhost:5432` |
