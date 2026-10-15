# 🏋️ Zolexora IronClub — Smart Gym & Health Club Management System

**Zolexora IronClub** is an enterprise-grade connected fitness operating system designed for modern smart gyms, multi-branch athletic clubs, and boutique performance facilities.

---

## 🌟 The 5 Applications

| Application | Path | Technology | Purpose | Port |
|-------------|------|------------|---------|------|
| **1. Admin Web** | `apps/admin-web/` | React 19 + Tailwind v4 + Vite | HQ Master Platform Dashboard (Franchise locations, global MRR, IoT fleet) | `3040` |
| **2. Manager Web** | `apps/manager-web/` | React 19 + Tailwind v4 + Vite | Branch Floor Operations (Live headcount gauge, turnstile overrides, POS) | `3042` |
| **3. Marketing Web** | `apps/marketing-web/` | React 19 + Tailwind v4 + Vite | High-converting public landing page, interactive rush meter, lead capture | `3043` |
| **4. Manager Mobile** | `apps/manager-mobile/` | Expo SDK 52 + React Native | Gym Owner & Floor Manager on-the-go (Remote turnstile triggers, live feed) | Mobile |
| **5. Member Mobile** | `apps/member-mobile/` | Expo SDK 52 + React Native | Member Pass (Dynamic rolling optical QR, workout set logger, macro tracker) | Mobile |

---

## 🚀 Quick Start Guide

### 1. Launch Services (From Monorepo Root)

```bash
# Run HQ Master Admin Web
pnpm dev:ironclub:admin       # http://localhost:3040

# Run Branch Manager Web
pnpm dev:ironclub:manager     # http://localhost:3042

# Run Public Marketing Web
pnpm dev:ironclub:marketing   # http://localhost:3043

# Run Backend API & IoT Gateway
pnpm dev:ironclub:api         # http://localhost:4060 (Docs: /docs)

# Run Expo Mobile Apps
pnpm dev:ironclub:mobile:manager
pnpm dev:ironclub:mobile:member
```

### 2. Run Comprehensive Test Suite

```bash
# Run backend tests
pnpm --prefix products/zolexora-ironclub run test:backend

# Or run the end-to-end verification script
bash products/zolexora-ironclub/scripts/test.sh
```

---

## 🏗️ Architecture & Core Modules

- **Sub-50ms Smart Turnstile Engine**: Handles optical 2D barcode, dynamic rolling QR (anti-screenshot), Wiegand RFID, and biometric facial access points.
- **Live Floor Rush Telemetry**: Real-time member headcount synced across optical gates every 5 seconds.
- **Billing & Memberships**: Automated tier management (Bronze, Silver, Gold, Black Iron VIP) with Razorpay, Cashfree, and UPI Dynamic QR payment support.
- **Olympic Arsenal & Smart Equipment Fleet**: Tracks equipment usage hours, maintenance schedules, and breakdown dispatch tickets.
- **Group Classes & Studios**: Dynamic scheduling and booking for CrossFit, Powerlifting, HIIT, and Yoga.
- **Pro-Shop POS**: Point-of-Sale checkout terminal for supplements, apparel, and protein shakes.

---

## 📂 Repository Directory Layout

```
products/zolexora-ironclub/
├── apps/
│   ├── admin-web/            # HQ Platform Master Admin Web (React 19, Port 3040)
│   ├── manager-web/          # Branch Manager Operations Web (React 19, Port 3042)
│   ├── marketing-web/        # Public Marketing & Lead Capture Web (React 19, Port 3043)
│   ├── manager-mobile/       # Gym Owner & Manager Mobile App (Expo SDK 52)
│   ├── member-mobile/        # Member Digital Pass Mobile App (Expo SDK 52)
│   └── backend/              # Core FastAPI & IoT Access Controller (Python 3.12, Port 4060)
├── packages/
│   └── types/                # @zolexora/ironclub-types (Shared TypeScript domain contracts)
├── docs/
│   ├── ARCHITECTURE.md       # Technical architecture specification
│   ├── IOT_GATEWAY.md        # Hardware ESP32/RFID turnstile wiring and integration
│   └── API_SPEC.md           # REST OpenAPI endpoints reference
├── scripts/
│   ├── dev.sh                # Local multi-service startup script
│   └── test.sh               # Test runner
├── compose.yaml              # Docker Compose for PostgreSQL 16, Redis 7, Backend & Nginx
├── nginx.conf                # Reverse proxy configuration
└── package.json              # Product workspace manifest
```
