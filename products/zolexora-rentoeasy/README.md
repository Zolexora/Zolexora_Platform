# Rent & Stay

Rent & Stay is a full-stack property rental platform built as a pnpm monorepo. It includes tenant, owner, and admin web portals, a NestJS API, Prisma/PostgreSQL persistence, real-time chat, KYC flows, payments, document storage, and shared workspace packages.

This README reflects the current workspace state. The deleted mobile apps are no longer part of the active monorepo.

## Contents

- [Workspace Overview](#workspace-overview)
- [Applications](#applications)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Development](#development)
- [Build And Verification](#build-and-verification)
- [Authentication Flows](#authentication-flows)
- [Backend Modules](#backend-modules)
- [Database Schema](#database-schema)
- [Third-Party Services](#third-party-services)
- [Storage](#storage)
- [Dependency And Security Policy](#dependency-and-security-policy)
- [Workspace Maintenance](#workspace-maintenance)
- [Troubleshooting](#troubleshooting)

## Workspace Overview

```text
rent-and-stay/
├── apps/
│   ├── web-tenant/       Tenant web app, Vite, port 3001
│   ├── web-owner/        Owner web app, Vite, port 3002
│   └── web-admin/        Admin web app, Vite, port 3003
├── services/
│   └── api/              NestJS API, Prisma, Socket.IO, port 4020
├── packages/
│   ├── shared-types/     Shared TypeScript domain types
│   └── shared-utils/     Shared utility exports
├── pnpm-workspace.yaml   pnpm workspace package globs
├── pnpm-lock.yaml        pnpm lockfile
├── turbo.json            Turborepo task graph
└── package.json          Root scripts and dependency policy
```

The workspace packages are:

| Package | Path | Purpose |
| --- | --- | --- |
| `@zolexora/rentoeasy-web-tenant` | `apps/web-tenant` | Tenant portal |
| `@zolexora/rentoeasy-web-owner` | `apps/web-owner` | Owner portal |
| `@zolexora/rentoeasy-web-admin` | `apps/web-admin` | Admin portal |
| `@zolexora/rentoeasy-api` | `services/api` | Backend API |
| `@zolexora/rentoeasy-types` | `packages/shared-types` | Shared domain types |
| `@zolexora/rentoeasy-utils` | `packages/shared-utils` | Shared utilities |

## Applications

| App | URL | Description |
| --- | --- | --- |
| Tenant web | `http://localhost:3001` | Search, bookings, KYC, payments, chat, tenant profile |
| Owner web | `http://localhost:3002` | Listings, tenant management, chat, earnings, profile |
| Admin web | `http://localhost:3003` | Dashboard, listings, payments, config, audit logs |
| API | `http://localhost:4020` | REST API and Socket.IO gateway |
| Swagger | `http://localhost:4020/docs` | API documentation |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Monorepo | pnpm workspaces, Turborepo |
| Backend | NestJS 11, TypeScript, Prisma |
| Database | PostgreSQL, typically Supabase |
| Frontend | React 18, Vite 8, Tailwind CSS |
| State and data | Zustand, TanStack Query, Axios |
| Auth | JWT access/refresh tokens, Firebase Google Auth, OTP |
| Realtime | Socket.IO |
| Queue | Bull with Redis |
| Payments | Razorpay |
| Storage | AWS SDK v3 S3 client, Cloudinary |
| Notifications | Firebase Admin, SendGrid |
| Validation | class-validator, class-transformer |

## Prerequisites

Use pnpm only for dependency management.

- Node.js 20 or newer
- pnpm 10.32.1 or compatible pnpm 10.x
- PostgreSQL database, usually Supabase
- Redis for Bull queues
- Firebase project for Google sign-in and notification services
- Razorpay account for payments
- Cloudinary account for image uploads
- AWS S3 bucket for private PDF/document storage
- MSG91 account for production SMS OTP

Check local versions:

```bash
node --version
pnpm --version
```

## Install

```bash
pnpm install
```

The repository is configured with:

- `packageManager: pnpm@10.32.1`
- `pnpm-workspace.yaml` for `apps/*`, `services/*`, and `packages/*`
- `pnpm.overrides.uuid` to keep transitive `uuid` on the patched `11.1.1` line
- pnpm `onlyBuiltDependencies` for approved install scripts used by Firebase, Prisma, Nest, protobuf, and optional native packages

Do not run `npm install` or commit `package-lock.json`.

## Environment Setup

Copy the example files before running the apps:

```bash
cp services/api/.env.example services/api/.env
cp apps/web-tenant/.env.example apps/web-tenant/.env
cp apps/web-owner/.env.example apps/web-owner/.env
cp apps/web-admin/.env.example apps/web-admin/.env
```

### API Environment

File: `services/api/.env`

Required core variables:

```env
PORT=4020
NODE_ENV=development

DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"

REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

JWT_ACCESS_SECRET=your_access_secret_here_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_here_min_32_chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

TENANT_WEB_URL=http://localhost:3001,http://127.0.0.1:3001
OWNER_WEB_URL=http://localhost:3002,http://127.0.0.1:3002
ADMIN_WEB_URL=http://localhost:3003,http://127.0.0.1:3003
```

Service-specific variables are documented in `services/api/.env.example` and include MSG91, Razorpay, AWS S3, Cloudinary, Firebase Admin, SendGrid, and admin seed credentials.

### Web Environment

All web apps need an API URL:

```env
VITE_API_URL=http://localhost:4020
```

Tenant and owner apps also need Firebase web config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Tenant additionally supports:

```env
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_GOOGLE_MAPS_KEY=...
VITE_RAZORPAY_KEY=...
```

## Database Setup

The API uses Prisma with the schema at:

```text
services/api/prisma/schema.prisma
```

Generate the Prisma client:

```bash
pnpm --filter @zolexora/rentoeasy-api prisma:generate
```

Run migrations locally when direct database access on port 5432 is available:

```bash
cd services/api
pnpm prisma:migrate
pnpm prisma:seed
```

For environments where direct Supabase port 5432 is blocked, use the Codespaces helper:

```bash
cd services/api
pnpm prisma:migrate:codespaces
```

Then apply the generated SQL using your Supabase workflow, regenerate the client, and seed:

```bash
pnpm prisma:generate
pnpm prisma:seed
```

Useful Prisma commands:

```bash
pnpm --filter @zolexora/rentoeasy-api prisma:generate
pnpm --filter @zolexora/rentoeasy-api prisma:push
pnpm --filter @zolexora/rentoeasy-api prisma:studio
pnpm --filter @zolexora/rentoeasy-api prisma:seed
```

## Development

Start all apps and the API:

```bash
pnpm dev
```

Start subsets:

```bash
pnpm dev:web
pnpm dev:api
```

Turborepo marks `dev` as persistent and does not run prerequisite builds before dev startup. This keeps local startup fast.

## Build And Verification

Install:

```bash
pnpm install
```

Build all workspaces:

```bash
pnpm build
```

Type-check all workspaces that define the task:

```bash
pnpm type-check
```

Run the dependency audit:

```bash
pnpm audit
```

Current expected audit result after the dependency cleanup:

```text
No known vulnerabilities found
```

Run dev startup in a bounded verification window:

```bash
timeout 35s pnpm dev
```

The timeout exit code is expected because dev servers are persistent. The useful signal is that Vite reports each web app ready and Nest reports the API started.

## Authentication Flows

### Tenant

Tenant supports:

- Phone and OTP login
- Google login through Firebase
- Account creation flows that combine Google identity, phone verification, and password setup
- JWT access and refresh token session management

Main endpoints:

```text
POST /api/v1/auth/send-otp
POST /api/v1/auth/verify-otp
POST /api/v1/auth/google
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Owner

Owner supports:

- Phone and OTP login
- Email and password login
- Google login through Firebase
- Owner registration through email auth

Main endpoints:

```text
POST /api/v1/auth/email/login
POST /api/v1/auth/email/register
POST /api/v1/auth/google
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Admin

Admin uses seeded email/password accounts only. There is no public self-registration flow.

Main endpoints:

```text
POST /api/v1/auth/email/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Protected API routes expect:

```http
Authorization: Bearer <accessToken>
```

## Backend Modules

The API source lives in `services/api/src`.

| Module | Purpose |
| --- | --- |
| `auth` | OTP, email auth, Google auth, JWT refresh tokens |
| `users` | User profiles, public profiles, account updates |
| `properties` | Listings, photos, amenities, status workflows |
| `bookings` | Booking lifecycle, agreement generation, police verification |
| `payments` | Razorpay orders, verification, refunds, earnings, payout admin |
| `kyc` | Aadhaar, PAN, bank KYC, webhooks, admin review queue |
| `chat` | Socket.IO rooms and messages |
| `maintenance` | Tenant maintenance requests and owner/admin updates |
| `notifications` | In-app, push, and email notification helpers |
| `admin` | Dashboard, city stats, platform config, audit logs |
| `prisma` | Prisma client lifecycle |
| `config` | MSG91 and upload services |

## Database Schema

The schema uses table names prefixed with ordered `ras_` maps.

| Model | Table | Description |
| --- | --- | --- |
| `User` | `01_ras_users` | Tenants, owners, admins |
| `RefreshToken` | `02_ras_refresh_tokens` | Refresh token sessions |
| `OTP` | `03_ras_otps` | Phone OTP challenges |
| `KYCDocument` | `04_ras_kyc_documents` | KYC documents and status |
| `Amenity` | `05_ras_amenities` | Amenity master data |
| `Property` | `06_ras_properties` | Property listings |
| `PropertyPhoto` | `07_ras_property_photos` | Listing photos |
| `PropertyAmenity` | `08_ras_property_amenities` | Property to amenity joins |
| `Booking` | `09_ras_bookings` | Booking records |
| `Payment` | `10_ras_payments` | Rent and fee payments |
| `Payout` | `11_ras_payouts` | Owner payout tracking |
| `ChatRoom` | `12_ras_chat_rooms` | Booking chat rooms |
| `ChatMessage` | `13_ras_chat_messages` | Chat messages |
| `MaintenanceRequest` | `14_ras_maintenance_requests` | Maintenance tickets |
| `Review` | `15_ras_reviews` | Property reviews |
| `Notification` | `16_ras_notifications` | User notifications |
| `PlatformConfig` | `17_ras_platform_config` | Admin-managed platform config |
| `AuditLog` | `18_ras_audit_logs` | Admin audit trail |

Important enums include `UserRole`, `KYCStatus`, `PropertyStatus`, `BookingStatus`, `PaymentStatus`, `PayoutStatus`, `MaintenanceStatus`, `MaintenancePriority`, and `NotificationType`.

## Third-Party Services

### Supabase PostgreSQL

Use Supabase for hosted PostgreSQL.

- `DATABASE_URL` should normally use the pooler connection on port `6543`.
- `DIRECT_URL` should use the direct database connection on port `5432`.
- Local migrations need direct access.
- Codespaces or restricted environments may need generated SQL applied manually.

### Redis

Redis powers Bull queues. Development can use local Redis:

```bash
redis-server
```

Or configure a remote Redis URL:

```env
REDIS_URL=redis://...
```

### Firebase

Firebase is used for:

- Frontend Google auth in tenant and owner apps
- Backend token verification with Firebase Admin
- Notification integrations

Frontend config goes in app `.env` files. Backend service account values go in `services/api/.env`.

When pasting `FIREBASE_PRIVATE_KEY`, preserve escaped newlines:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### MSG91

MSG91 is used for SMS OTP in production.

In development, the backend can log OTPs instead of sending real SMS depending on the current environment behavior.

Required variables:

```env
MSG91_AUTH_KEY=...
MSG91_SENDER_ID=...
MSG91_OTP_TEMPLATE_ID=...
```

### Razorpay

Razorpay handles payment order creation, verification, refunds, and webhooks.

Required variables:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
PLATFORM_FEE_PERCENT=2
```

Use test keys for development.

### Cloudinary

Cloudinary stores image uploads such as profile and property photos.

Required variables:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### SendGrid

SendGrid is used for email notifications.

Required variables:

```env
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
SENDGRID_FROM_NAME=...
```

## Storage

The backend uses two storage paths:

- Cloudinary for images
- AWS S3 for private PDFs such as Aadhaar files, receipts, and agreements

S3 usage is implemented with AWS SDK v3 modular packages:

- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

Do not reintroduce `aws-sdk` v2. AWS SDK v2 is end-of-support and should not be used in this workspace.

The S3 service uses:

- `PutObjectCommand` for uploads
- `GetObjectCommand` plus `getSignedUrl` for private temporary URLs
- `DeleteObjectCommand` for deletion

Required S3 variables:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_CLOUDFRONT_URL=...
```

## Dependency And Security Policy

This repository is pnpm-only.

Allowed:

```bash
pnpm install
pnpm add <package>
pnpm --filter <workspace> add <package>
pnpm remove <package>
pnpm audit
```

Avoid:

```bash
npm install
yarn install
pnpm audit fix --force
```

Current security posture:

- `pnpm audit` reports no known vulnerabilities.
- `aws-sdk` v2 has been removed.
- Native `bcrypt` has been replaced with `bcryptjs` to avoid the vulnerable `node-pre-gyp > tar` chain.
- Firebase has been updated to remove the vulnerable `undici` chain.
- Transitive `uuid` is pinned to the patched `11.1.1` line through pnpm overrides.

If future audits report vulnerabilities:

1. Identify whether the package is direct or transitive.
2. Fix production dependencies before dev/build tooling.
3. Prefer normal upgrades or targeted pnpm overrides.
4. Avoid force upgrades unless the build and runtime impact is understood.
5. Re-run `pnpm install`, `pnpm audit`, `pnpm build`, and bounded `pnpm dev`.

## Workspace Maintenance

### Add A Dependency

Root tooling:

```bash
pnpm add -D <package> -w
```

Specific app or service:

```bash
pnpm --filter @zolexora/rentoeasy-api add <package>
pnpm --filter @zolexora/rentoeasy-web-tenant add <package>
```

Workspace package dependency:

```json
"@zolexora/rentoeasy-types": "workspace:*"
```

### Remove A Dependency

```bash
pnpm --filter @zolexora/rentoeasy-web-owner remove <package>
```

### Clean Local Outputs

```bash
rm -rf node_modules apps/*/node_modules services/*/node_modules .turbo apps/*/dist services/api/dist
pnpm install
```

### Check For Deleted Workspace References

```bash
grep -RIn "apps/mobile\\|mobile-" package.json pnpm-workspace.yaml turbo.json tsconfig*.json apps services packages
```

There should be no package-script references to deleted mobile apps.

## Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start API and all web apps |
| `pnpm dev:web` | Start web apps only |
| `pnpm dev:api` | Start API only |
| `pnpm build` | Build all packages/apps/services |
| `pnpm audit` | Check dependency vulnerabilities |
| `pnpm type-check` | Run workspace type-check task |
| `pnpm --filter @zolexora/rentoeasy-api prisma:generate` | Generate Prisma client |
| `pnpm --filter @zolexora/rentoeasy-api prisma:studio` | Open Prisma Studio |
| `pnpm --filter @zolexora/rentoeasy-api prisma:seed` | Seed database |

## Troubleshooting

### pnpm says the project is configured for another package manager

Make sure `package.json` has:

```json
"packageManager": "pnpm@10.32.1"
```

Also ensure `pnpm-workspace.yaml` exists.

### Prisma client is missing or stale

Run:

```bash
pnpm --filter @zolexora/rentoeasy-api prisma:generate
```

### API starts but database connection fails

Check:

- `DATABASE_URL`
- Supabase project is not paused
- Network access to Supabase pooler
- `DIRECT_URL` only when running migrations that need direct access

### API starts but Redis/Bull fails

Check:

- Redis server is running
- `REDIS_URL`, `REDIS_HOST`, and `REDIS_PORT`
- Firewall or Docker availability if Redis runs in Docker

### Vite app cannot reach API

Check each web app `.env`:

```env
VITE_API_URL=http://localhost:4020
```

Also check API CORS values:

```env
TENANT_WEB_URL=http://localhost:3001,http://127.0.0.1:3001
OWNER_WEB_URL=http://localhost:3002,http://127.0.0.1:3002
ADMIN_WEB_URL=http://localhost:3003,http://127.0.0.1:3003
```

### Firebase Google login fails

Check:

- Firebase web config in tenant/owner `.env`
- Authorized domains in Firebase Authentication settings
- Google provider enabled in Firebase Authentication
- Backend Firebase Admin service account values

### S3 upload fails

Check:

- Bucket exists
- IAM user/role can `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject`
- Region matches `AWS_REGION`
- `AWS_S3_BUCKET` is correct

### Dependency audit finds a vulnerability

Run:

```bash
pnpm audit
pnpm why <package>
```

Fix direct production dependencies first. For transitives, prefer upgrading the parent package. Use pnpm overrides only when the patched transitive version is compatible and verified by `pnpm build` and `pnpm dev`.

## Current Verification Baseline

The current workspace has been verified with:

```bash
pnpm install
pnpm audit
pnpm --filter @zolexora/rentoeasy-api prisma:generate
pnpm build
timeout 35s pnpm dev
```

Expected results:

- Install completes successfully.
- Audit reports no known vulnerabilities.
- Prisma client generation succeeds.
- Build succeeds for API, tenant, owner, and admin.
- Dev startup brings up Vite apps and Nest API; timeout termination is expected for persistent dev servers.
