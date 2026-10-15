# Zolexora IronClub — Architecture Specification

## 1. Executive Summary

**Zolexora IronClub** is an enterprise-grade Smart Gym, Health Club, and Athletic Performance facility management platform. It pairs IoT access controllers (optical tripods, speed gates, flap barriers, biometric scanners) with cloud orchestration, real-time telemetry, automated subscription billing, and member fitness logging.

```
                              ┌────────────────────────────────────────┐
                              │        Zolexora IronClub Cloud         │
                              │             (FastAPI Core)             │
                              │          Port: 4060 | DB: 5452         │
                              └───────────────────▲────────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
                 ▼                                ▼                                ▼
    ┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
    │     HQ Admin Web         │    │    Gym Manager Web       │    │    Marketing Web App     │
    │      Port: 3040          │    │      Port: 3042          │    │       Port: 3043         │
    │  Franchise Multi-Branch  │    │  Branch Command Center   │    │  Lead Capture & Pricing  │
    └──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
                 │                                │
                 │                                │
                 ▼                                ▼
    ┌──────────────────────────┐    ┌──────────────────────────┐
    │   Manager Mobile App     │    │    Member Mobile App     │
    │    Expo SDK 52 (React)   │    │   Expo SDK 52 (React)    │
    │   Floor & Gate Control   │    │  Dynamic Optical QR Pass │
    └──────────────────────────┘    └──────────────────────────┘
```

---

## 2. Five App Topology

| Application | Technology | Role | Port / Target |
|-------------|------------|------|---------------|
| **Admin Web** (`admin-web`) | React 19, Vite, Tailwind v4, Zustand | HQ Master Platform Admin (Franchise, global billing, IoT fleet) | `3040` |
| **Manager Web** (`manager-web`) | React 19, Vite, Tailwind v4, Zustand | Branch Floor Operations, live headcount, turnstile override, POS | `3042` |
| **Marketing Web** (`marketing-web`) | React 19, Vite, Tailwind v4 | High-conversion public portal, plan calculator, 1-day pass lead capture | `3043` |
| **Manager Mobile** (`manager-mobile`) | Expo SDK 52, React Native | Gym owner & on-floor manager app: remote gate triggers, incident stream | Mobile / Expo |
| **Member Mobile** (`member-mobile`) | Expo SDK 52, React Native | Member daily companion: dynamic optical QR entry pass, workout sets, diet | Mobile / Expo |

---

## 3. Backend & IoT Gateway

- **FastAPI Core** (`apps/backend`): High-throughput async REST API running on port `4060`.
- **Sub-50ms Turnstile Engine** (`TurnstileEngine`):
  - Validates RFID tags, optical rolling tokens, and biometric hashes.
  - Verifies membership expiration, allowed branch access, and tier zone permissions.
  - Automatic anti-passback and real-time head-count increment/decrement.
- **Data Persistence**:
  - PostgreSQL 16 (port `5452`) with SQLAlchemy 2.0 asyncpg ORM.
  - Redis 7 (port `6382`) for millisecond credential caching and distributed gate leases.
  - In-memory mock engine allowing zero-friction out-of-the-box local development.

---

## 4. Security & Safety Standards

1. **Fire & Life Safety (NFPA 101 Code)**:
   - In case of fire alarm integration or emergency trigger, all gates drop arms into fail-safe open mode.
2. **Dynamic Optical QR Anti-Screenshot**:
   - Digital passes use rolling HMAC SHA-256 tokens that refresh every 30 seconds to prevent screenshot sharing between non-members.
3. **Role-Based Access Control (RBAC)**:
   - `SUPER_ADMIN`: Cross-branch franchise visibility, financial sweeps, firmware pushes.
   - `BRANCH_MANAGER`: Floor operations, class scheduling, hardware override.
   - `TRAINER`: Client assignments, PT session tracking, workout plan authoring.
   - `MEMBER`: Personal pass, booking reservations, workout logs.
