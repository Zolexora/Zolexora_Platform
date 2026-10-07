# ClarityFi — Personal Finance App

A privacy-first personal finance mobile app built with Expo/React Native.

## What is ClarityFi?

ClarityFi is more than a money manager — it tracks your **finances, fitness, and lifestyle** in one place.

- **Records** — Log income & expenses, browse by month, grouped by day
- **Analysis** — Bar charts, percentage breakdowns, account analysis across 5 view types
- **Budgets** — Per-category monthly limits with real-time progress
- **Accounts** — Multiple accounts (cash, bank, card, savings) with computed balances
- **Categories** — 8 income + 20 expense defaults; fully customisable
- **Fitness** — Steps, workouts, sleep, health vitals
- **Lifestyle** — Daily habits and lifestyle tracking
- **AI Chat** — Built-in AI assistant for spending insights
- **Side Drawer** — CSV export, JSON backup/restore, delete & reset

## Monorepo Structure

```
clarityfi/
├── apps/
│   ├── mobile/          ← Expo React Native app  (@clarityfi/mobile)
│   └── api-server/      ← Node.js/TypeScript API  (@clarityfi/api-server)
├── packages/
│   ├── api-client-react/ ← React query hooks for the API
│   ├── api-spec/         ← Shared API type definitions
│   ├── api-zod/          ← Zod validation schemas
│   └── db/               ← Database layer
├── tools/
│   └── scripts/          ← Shared build/utility scripts
├── package.json
└── pnpm-workspace.yaml
```

## Tech Stack

| Layer | Tech |
|---|---|
| Mobile framework | Expo SDK 54, Expo Router v6 |
| Language | TypeScript |
| Local storage | AsyncStorage |
| Security | expo-local-authentication (passcode + biometrics) |
| Icons | @expo/vector-icons (Feather) |
| Fonts | Inter (Google Fonts via Expo) |
| API | Node.js + Fastify (TypeScript) |
| Package manager | pnpm (monorepo) |

## Theme

- Dark olive/brown always-on theme (no light mode)
- `#3B3828` background · `#47432E` cards · `#C9A840` gold accent
- ₹ Indian Rupee currency throughout

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Expo Go app on your phone **or** Android/iOS simulator

## Running Locally

### 1. Install dependencies (run once from repo root)

```bash
pnpm install
```

### 2. Start the mobile app

```bash
# Option A — from root
pnpm dev

# Option B — from the mobile app directory
cd apps/mobile
pnpm run dev:tunnel
```

Then scan the QR code with **Expo Go** (Android/iOS) or press `a` for Android emulator / `i` for iOS simulator.

### 3. Start the API server (optional — app works fully offline)

```bash
# Option A — from root
pnpm dev:api

# Option B — from api-server directory
cd apps/api-server
node dist/index.mjs
```

## Architecture Notes

- **MoneyContext** (`apps/mobile/context/MoneyContext.tsx`) — Unified data layer for all transactions, accounts, categories, budgets, and settings. No server required.
- **DrawerContext** + **DrawerMenu** — Global side drawer rendered in root layout, accessible from any tab.
- **AppSecurityContext** — Passcode and biometric unlock.
- All data is stored locally via AsyncStorage. Google Sheets sync is optional and configured in Preferences.
- Old tab files (`analytics.tsx`, `transactions.tsx`) are hidden via `href: null` in the tab layout rather than deleted, to avoid breaking Expo Router.

## Adding the Download Link

When your APK or Play Store listing is ready, update the download button in:

```
apps/mobile/server/templates/landing-page.html
```

Replace the `#` href with your actual download URL.
