# Zolexora — Complete Super App Platform

> Watch. Earn. Shop. — India's cleanest super app.

Zolexora is a transitional multi-app marketplace monorepo. Builds and tests are deterministic, but database isolation, payment routing, secure sessions, Oracle infrastructure, and production readiness are not complete.

---

## 📱 Platform Overview

Zolexora comprises six main applications and services that work together seamlessly:

| App / Service | Production URL | Local URL | Port / Metro | Technology | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Zolexora Buyer Web** | `shop.zolexora.com` | `http://localhost:3000` | Port `3000` | Next.js 15 App Router | Zolexora customer storefront |
| **Mahila Buyer Web** | `mahilamadel.store` | legacy local client | — | React 18 | Transitional Mahila customer storefront |
| **Seller Web** | `seller.zolexora.com` | `http://localhost:3001` | Port `3001` | Next.js 15 App Router | Product uploads, reels management, order fullfilment |
| **Admin Web** | `admin.marketplace.zolexora.com` | `http://localhost:3002` | Port `3002` | Next.js 15 App Router | Shared marketplace operations |
| **Zolexora Buyer Mobile** | — | `http://localhost:8081` | Metro `8081` | Expo React Native | Zolexora customer binary |
| **Mahila Buyer Mobile** | — | `http://localhost:8083` | Metro `8083` | Expo React Native | Mahila customer shell |
| **Seller Mobile**| — | `http://localhost:8082` | Metro `8082` | Expo React Native | Mobile creator dashboard, product & reel uploads |
| **Backend API** | `api.zolexora.com` | `http://127.0.0.1:8000`| Port `8000` | FastAPI (Python 3.12) | Core business logic, auth, payments, shipping engine |

## Storefront request context

FastAPI resolves `zolexora-shop` and `mahila-madel` from exact registered customer hosts, exact approved browser Origins on the shared API, or the public `X-Storefront-Key` buyer-mobile hint. Conflicts and unknown required context fail closed; seller/admin surfaces have no fixed customer storefront. This request context is not authentication, persisted-resource authorization, database isolation, or payment routing.

## Independent ERP boundary

Zolexora ERP is a separate commercial product/company and Marketplace is one customer. The proposed generic v1 contract is under `contracts/zolexora-erp/v1/`; no live ERP communication exists. Systems do not share databases, authentication, secrets, deployments, or releases, and checkout never waits synchronously for ERP.

## Oracle foundation

Phase 5 proves the forward-only storefront/domain and integration-reliability migration, bootstrap, constraints, concurrent claim pattern, repository, and readiness behavior on disposable Oracle Database 23ai Free 23.9. Production storefront resolution is repository-backed and fail-closed. This is not a full commerce migration or OCI proof: MongoDB, Supabase, Redis, Cloudinary, and the Mahila legacy server still serve existing domains. See `docs/oracle-persistence.md`.

---

## 🗄️ Database & Media Storage Architecture

Zolexora implements a hybrid storage model to leverage the strengths of relational and document databases while keeping within free quotas:

```mermaid
graph TD
    A[Clients: Web/Mobile] --> B[FastAPI Backend]
    B --> C[(MongoDB Atlas)]
    B --> D[(Supabase PostgreSQL)]
    B --> E[(Cloudinary API)]
    
    subgraph MongoDB Documents
        C --> C1[Products & Carts]
        C --> C2[Orders & Shipments]
        C --> C3[Reels & Views]
        C --> C4[Coin Transactions & Codes]
    end
    
    subgraph Supabase Relational
        D --> D1[Users & Profiles]
        D --> D2[Subscriptions]
        D --> D3[Payment Transactions]
    end
    
    subgraph Cloudinary Media
        E --> E1[Product Images]
        E --> E2[Reel Videos / Thumbnails]
        E --> E3[User Avatars]
    end
```

### 1. MongoDB Atlas (Non-Relational Store)
Handles schema-flexible, fast-access document data. Managed through `services/marketplace-api/scripts/setup_indexes.py`.
* **Collections**: `products`, `orders`, `cart`, `reels`, `reel_views`, `coin_transactions`, `pending_registrations`, `password_resets`, `discount_codes`.
* **TTL Rules (Time to Live)**:
  * `pending_registrations`: Expired OTP objects are automatically deleted.
  * `password_resets`: Used/expired tokens are auto-deleted after 24 hours.
  * `reel_views`: Views are automatically purged after 90 days (`7,776,000` seconds) to keep storage under the 500 MB Atlas limit.

### 2. Supabase PostgreSQL (Relational Store)
Used for structured relational tables that require strict consistency. Transitional schema scripts are under `services/marketplace-api/scripts/`.
* **Tables**:
  * `public.users`: User accounts and roles (`viewer`, `seller`, `admin`). Mirrored on MongoDB.
  * `public.subscriptions`: Subscriptions mapping (`basic`, `premium`).
  * `public.payment_transactions`: Financial history for Razorpay and UPI.

### 3. Cloudinary (Binary Assets)
All media (images, videos, profile pictures) are offloaded to Cloudinary so that no binary blobs consume database storage or traffic bandwidth.
* **Buckets**: `zolexora/products/`, `zolexora/reels/`, `zolexora/avatars/`.

---

## ⚙️ Core Engines & Mechanisms

### 🪙 1. Coin Rewards Economy
Designed to drive engagement. Users earn coins by viewing creator content, which they can redeem for discount codes applied at checkout.

* **Reward Values**:
  * **Watching a Reel**: +3 coins to the viewer, +3 coins to the creator.
  * **Daily Cap**: Maximum of 150 coins per user per day.
  * **Welcome Bonus**: 20 coins awarded upon new registration.
* **Redemption Thresholds**:
  * Redeem **50 coins**: Generates a **10% discount** code.
  * Redeem **100 coins**: Generates a **20% discount** code.
  * Redeem **200 coins**: Generates a **30% discount** code.
* **Checkout Restriction**: The maximum coin-based discount is capped at **50% of the total order value**.
* **Financial Value**: 1 coin = ₹0.01.

### 🚚 2. Parallel Shipping Orchestration
Zolexora integrates with 7 Indian shipping providers: **Delhivery**, **NimbusPost**, **Shiprocket**, **DTDC**, **Blue Dart**, **India Post**, and **Pickrr**. 

When a seller marks an order as **Ready to Ship** (via `services/marketplace-api/routers/shipping.py` and the shipping module), the auto-selection engine acts as follows:

```mermaid
flowchart TD
    Start[Seller marks order: Ready to Ship] --> Query[Query all configured couriers in parallel]
    Query --> Filter[Filter serviceable pincodes, price known, & ETA <= 6 days]
    Filter --> Sort[Sort by cheapest -> fewest days -> provider preference]
    Sort --> Book[Attempt auto-booking with best courier]
    Book -- Success --> Track[Aquire AWB and Track Order]
    Book -- Fail --> Retry[Try next best courier option]
    Retry -- Success --> Track
    Retry -- All Fail --> Attention[Mark order status: shipping_attention_required]
```

1. **Service Verification**: Queries API endpoints of all configured couriers in parallel.
2. **Filtering**: Excludes providers that are unserviceable for the target pincode, take >6 days, or return errors.
3. **Sorting Priorities**:
   * **Priority 1**: Cheapest Rate.
   * **Priority 2**: Shortest Delivery Window.
   * **Priority 3**: Preference hierarchy (Delhivery first).
4. **Fallback loop**: If the chosen courier booking fails, the system automatically tries the next best provider.
5. **Oversight**: If all bookings fail, the status is flagged as `shipping_attention_required` and appears in the Admin Shipping Panel.
6. **Webhooks & Sync**: Providers send real-time webhooks to synchronize delivery tracking.

---

## 🛠️ Prerequisites & Installation

### Developer Tooling
Make sure you have the following installed on your machine:
* **Node.js** (Version ≥ 20) — [Install Node](https://nodejs.org)
* **pnpm** (Version ≥ 9) — Install via `npm i -g pnpm`
* **Python** (Version ≥ 3.12) — [Install Python](https://python.org)
* **Git** — [Install Git](https://git-scm.com)
* **Expo CLI** (For Mobile Testing) — Install via `npm install -g expo-cli eas-cli`

### Account setups (Free Tiers)
1. **MongoDB Atlas**: Create a free M0 cluster (512MB), add database credentials, allow IP access from anywhere (`0.0.0.0/0`), and copy the connection string.
2. **Supabase (transitional)**: configure a development project and follow the scripts under `services/marketplace-api/scripts/`.
3. **Cloudinary**: Create a free account and copy your Cloud Name, API Key, and API Secret.
4. **Google Cloud Console**: Set up an OAuth 2.0 Web Application client. Add origins:
   * `http://localhost:3000`, `http://localhost:3001`, `http://localhost:3002`
   * `http://127.0.0.1:3000`, `http://127.0.0.1:3001`, `http://127.0.0.1:3002`
5. **Razorpay**: Register an account and generate a set of API test keys.
6. **Resend**: Open an account and create an API Key. Use default sandbox emails or verify your custom domain.

---

## ⚙️ Environment Variables Setup

Zolexora uses a multi-layered environment setup across its backend, web frontends, and mobile apps.

### 1. Quick Local Setup
For local development, copy the `.env.example` files to their active counterparts:
```bash
# Root environment (shared/Docker Compose development)
cp .env.example .env

# Backend configuration
cp services/marketplace-api/.env.example services/marketplace-api/.env

# Web Apps (Next.js local files)
cp apps/storefronts/zolexora-shop/web/.env.example apps/storefronts/zolexora-shop/web/.env.local
cp apps/portals/seller/web/.env.example apps/portals/seller/web/.env.local
cp apps/portals/marketplace-admin/web/.env.example apps/portals/marketplace-admin/web/.env.local

# Mobile Apps (Expo local files)
cp apps/storefronts/zolexora-shop/mobile/.env.example apps/storefronts/zolexora-shop/mobile/.env
cp apps/storefronts/mahila-madel/mobile/.env.example apps/storefronts/mahila-madel/mobile/.env
cp apps/portals/seller/mobile/.env.example apps/portals/seller/mobile/.env
```

### 2. Backend & Core Configuration
Inside `services/marketplace-api/.env`, configure the following key subsystems:

* **Startup Database Validation (Required)**:
  * `MONGO_URL`: Connection string for MongoDB (e.g. `mongodb://localhost:27017` or Atlas URL).
  * `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Supabase API credentials.
  * `SUPABASE_DATABASE_URL` or `SUPABASE_DB_PASSWORD`: PostgreSQL DSN or pooler URL/password.
* **Default Admin Seed (Optional)**:
  * `DEFAULT_ADMIN_EMAIL`: Email for the default admin user.
  * `DEFAULT_ADMIN_PASSWORD`: Password for the default admin user.
* **Shipping Webhooks Verification**:
  * `SHIPPING_WEBHOOK_SECRET`: HMAC SHA256 secret to verify status updates from couriers (e.g., Shiprocket, Delhivery). Paste this webhook secret in your courier developer dashboard.
* **Cart Limits**:
  * `MAX_CART_QUANTITY`: Maximum quantity allowed per item type in cart (default: `100`).

To generate a secure 64-character JWT secret key if needed, execute:
```bash
python -c "import secrets; print(secrets.token_hex(64))"
```

### 3. Frontend & Mobile Client API Configuration
Web and mobile clients must configure the API endpoints:

* **Web Frontends (`apps/storefronts/*/web`, `apps/portals/*/web`)**:
  * `NEXT_PUBLIC_API_URL`: The production API URL. During development, it falls back to `http://127.0.0.1:8000/api`.
  * `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: OAuth Client ID.
  * `NEXT_PUBLIC_RAZORPAY_KEY` (Web Buyer only): Razorpay payment gateway key.
* **Mobile Clients (`apps/storefronts/*/mobile`, `apps/portals/*/mobile`)**:
  * `EXPO_PUBLIC_API_URL`: The production API URL. During development, it falls back to `http://localhost:8000/api`.
  * `EXPO_PUBLIC_GOOGLE_CLIENT_ID`: OAuth Client ID.

---

## 🚀 Running the Project

### 1. Root & Workspace Setup
Install monorepo dependencies and backend packages:
```bash
# From the root directory
pnpm install

# Setup backend python packages

python -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate
pip install -r services/marketplace-api/requirements.txt
```

### 2. One-Time Database Initialization
Build search indexes, unique keys, and automatic TTL expiration rules on MongoDB Atlas:
```bash
cd backend
python scripts/setup_indexes.py
cd ..
```

### 3. Spin Up Applications

#### Option A: Single Monorepo Terminal (Quickest for Web)
Runs all Next.js applications concurrently:
```bash
pnpm dev
```

#### Option B: Dedicated Terminals (Recommended for debugging)
Open 4 terminal windows:

* **Terminal 1: FastAPI API Backend**
  ```bash
  cd backend
  source .venv/bin/activate
  uvicorn main:app --reload --port 8000
  ```
  API Docs (Swagger UI) will load at: `http://127.0.0.1:8000/docs`

* **Terminal 2: Buyer Frontend Client**
  ```bash
  pnpm --filter web-buyer dev
  ```
  Runs at: `http://localhost:3000`

* **Terminal 3: Seller Dashboard Client**
  ```bash
  pnpm --filter web-seller dev
  ```
  Runs at: `http://localhost:3001`

* **Terminal 4: Admin Panel Client**
  ```bash
  pnpm --filter web-admin dev
  ```
  Runs at: `http://localhost:3002`

#### Option C: Docker Local Stack (Complete Stack with Compose)
Run the entire platform (including database, backend, and all web frontends) inside Docker:
```bash
docker compose up --build
```
*Port mapping is aligned automatically in [docker-compose.yml](docker-compose.yml).*

---

## 📱 Mobile App Running & Compiling

### 1. Developer Execution (Expo Go)
Open your terminal inside either buyer or seller mobile workspaces:
```bash
# Buyer Expo App
cd apps/storefronts/zolexora-shop/mobile
npx expo start

# Seller Expo App
cd apps/portals/seller/mobile
npx expo start
```
* **Controls**: Press `a` to load on your Android Emulator, `i` for iOS Simulator, or scan the QR Code on your physical phone with the **Expo Go** application.

### 2. Google Sign-In setup on Mobile
Modify the client configuration inside `apps/storefronts/zolexora-shop/mobile/app/auth/index.tsx`:
```typescript
const [, , googlePromptAsync] = Google.useAuthRequest({
  androidClientId: "YOUR_ANDROID_CLIENT_ID",   // from Google Cloud Console
  iosClientId:     "YOUR_IOS_CLIENT_ID",        // from Google Cloud Console
  webClientId:     "YOUR_WEB_CLIENT_ID",        // same as GOOGLE_CLIENT_ID
});
```

---

## 🔐 Default Login Credentials & Seed Account

On first successful startup, the backend automatically seeds a primary system administrator account:

* **Role**: Platform Administrator
* **Email**: `admin@zolexora.com`
* **Password**: `Zolexora@Admin2025`

> [!WARNING]
> Change the admin password immediately upon first login on production environments by updating the database record directly inside MongoDB Atlas or through the Admin moderation tools.

---

## 📁 Monorepo Workspace Structure

```
zolexora/
├── services/marketplace-api/       ← FastAPI Python service
│   ├── main.py                     ← App Entry Point
│   ├── core/                       ← Configuration, DB connections, Auth schemas
│   │   ├── config.py               ← Global environment configuration
│   │   ├── supabase_client.py      ← Relational DB connector
│   │   └── cloudinary_client.py    ← Media CDN uploader
│   ├── models/                     ← Pydantic documents and collections types
│   ├── routers/                    ← HTTP API endpoints (Auth, Products, Reels, Payments)
│   ├── scripts/                    
│   │   ├── setup_indexes.py        ← MongoDB indices builder
│   │   └── supabase_schema.sql     ← Relational PostgreSQL setup
│   └── shipping/                   ← Courier selection logic
│       ├── base.py                 ← Shipping abstract structures
│       ├── rules.py                ← Auto-filtering ranking logic
│       └── service.py              ← Multi-carrier fallback booking engine
│
├── apps/                           ← Monorepo Frontends
│   ├── web-buyer/                  ← Next.js Client App (zolexora.com)
│   ├── web-seller/                 ← Next.js Vendor App (seller.zolexora.com)
│   ├── web-admin/                  ← Next.js Mod App (admin.zolexora.com)
│   ├── storefronts/                ← Customer web/mobile applications
│   └── portals/                    ← Shared seller/admin applications
│
└── packages/                       ← Shared Dev Modules
    ├── shared-api/                 ← Universal network API client schemas
    └── shared-config/              ← Shared configuration tokens (TS & Tailwind)
```

---

## 🔍 Verification & Health Checking

To verify that the backend is configured correctly and external integrations are fully operational, execute the health check query:
```bash
curl http://127.0.0.1:8000/api/health
```

Expected output:
```json
{
  "status": "ok",
  "version": "2.0.0",
  "cloudinary": true,
  "supabase": true,
  "razorpay": true,
  "upi": true,
  "google_auth": true,
  "email": true
}
```
> [!NOTE]
> If any service reports `false`, the corresponding development configuration may be missing or incorrect in `services/marketplace-api/.env`.

---

## 📡 API Reference Endpoint Map

### Authentication
* `POST /auth/register` — Initial register (Triggers verification email)
* `POST /auth/resend-otp` — Resends registration OTP code
* `POST /auth/verify-register` — Validates email OTP → Returns JWT
* `POST /auth/login` — Classic email password credentials verification → Returns JWT
* `GET /auth/me` — Fetches current caller profile

### Product Catalogs
* `GET /products` — Query products with sorting, filtering, and text search
* `GET /products/:id` — Retrives a single product detail
* `POST /products` — Creates product (Seller Role required)
* `PUT /products/:id` — Edits product attributes
* `DELETE /products/:id` — Deletes product index
* `POST /products/:id/upload-image` — Uploads image to Cloudinary

### Content Reels Feed
* `GET /reels` — Retrives public scrollable video reels
* `POST /reels` — Posts a new reel (Organic / Sponsored)
* `POST /reels/:id/upload` — Uploads video content to Cloudinary
* `POST /reels/:id/view` — Saves view metrics & awards coins to user/creator

### Checkout & Cart
* `GET /cart` — Retrives current items in cart
* `POST /cart/items` — Adds product to cart
* `PUT /cart/items/:id` — Updates quantity of target item
* `DELETE /cart/items/:id` — Removes item from cart
* `POST /cart/checkout` — Generates Razorpay transaction object
* `POST /cart/checkout/verify-payment` — Validates Razorpay API signatures

### Shipping & Couriers
* `GET/POST /shipping/pickup-locations` — Coordinates pickup warehouses
* `POST /shipping/orders/:id/ready-to-ship` — Launches the courier auto-booking engine
* `GET /shipping/orders/:id/options` — Lists prices and ETAs of all evaluated providers
* `POST /shipping/orders/:id/manual-book` — Bypasses ranking and books a specific courier
* `GET /shipping/track/:awb` — Checks tracking status by Air Waybill number
* `POST /shipping/shipments/:id/retry-booking` — Restarts booking attempts for failed orders

### Admin Management
* `GET /admin/stats` — Core platform statistics and volumes
* `GET /admin/analytics` — Platform user growth curves
* `GET /admin/users` — Queries complete user registry
* `GET /admin/shipping/shipments` — Shipping registry
* `GET /admin/shipping/shipments/attention-required` — Shows only failed bookings for manual intervention

---

## 🚀 Production Deployment Playbook

### 1. Backend → Northflank
Deploy the backend as a combined service from the GitLab repository.

* Service: `zolexora-api`
* Branch: `zolexora-deploy`
* Root/workdir: `backend`
* Dockerfile: `services/marketplace-api/Dockerfile`
* Port: `8000`
* Health check: `/api/health`

### 2. Web Frontends → Vercel
Deploy your apps independently:
```bash
# Install Vercel globally
npm i -g vercel

# Deploy Buyer Frontend
cd apps/storefronts/zolexora-shop/web
vercel --prod

# Deploy Seller Frontend
cd apps/portals/seller/web
vercel --prod

# Deploy Admin Frontend
cd apps/portals/marketplace-admin/web
vercel --prod
```
**Vercel Dashboard Routing Settings**:
* **Zolexora storefront**: `apps/storefronts/zolexora-shop/web`, target domain `shop.zolexora.com`
* **Seller portal**: `apps/portals/seller/web`, target domain `seller.zolexora.com`
* **Marketplace admin**: `apps/portals/marketplace-admin/web`, target domain `marketplaceadmin.zolexora.com`

> [!IMPORTANT]
> Remember to add `NEXT_PUBLIC_API_URL=https://api--zolexora-api--4m8d68ky29h8.code.run/api` as an environment variable in all your Vercel projects.

### 3. Mobile Compiles → Expo Application Services (EAS)
Generate binaries for iOS and Android:
```bash
npm install -g eas-cli
eas login

# Build Buyer Mobile Client
cd apps/storefronts/zolexora-shop/mobile
eas build --platform all --profile preview

# Build Seller Creator Client
cd apps/portals/seller/mobile
eas build --platform all --profile preview
```

### 4. Direct Linux VPS Hosting (Nginx & Docker)
To deploy the backend on a private VPS (like AWS EC2, DigitalOcean, or Hetzner):

* **Scaling via Docker Compose**:
  Configure nginx to reverse proxy and scale backend containers:
  ```bash
  cd backend
  # Boot 4 parallel FastAPI worker instances
  docker compose up -d --build --scale api=4
  ```

* **Manual Setup with Nginx Load Balancing**:
  Copy the nginx config and create worker processes:
  ```bash
  sudo cp infrastructure/nginx/legacy-api-host.conf /etc/nginx/sites-available/zolexora
  sudo ln -s /etc/nginx/sites-available/zolexora /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  
  # Start 4 FastAPI workers on separate ports
  for PORT in 8001 8002 8003 8004; do
    uvicorn main:app --host 127.0.0.1 --port $PORT --workers 1 --proxy-headers &
  done
  ```

---

## 🛠️ Troubleshooting & Fixes

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **`CORS Blocked`** | Calling address not in allowed list | Add your frontend domain or local IP (e.g. `http://localhost:3001`) to `CORS_ORIGINS` in your `.env` |
| **`MongoDB Connection Timeout`** | Network restriction or invalid URI | Ensure `MONGO_URL` includes credentials and you have whitelisted your IP address (or added `0.0.0.0/0`) in MongoDB Atlas |
| **`Google Login Fails`** | Mismatched client ID strings | Confirm `GOOGLE_CLIENT_ID` in `services/marketplace-api/.env` matches the frontend configuration |
| **`Uploaded images not visible`** | Missing or incorrect CDN credentials | Validate `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` inside your `.env` |
| **`Verification Emails not sending`** | Resend API auth failure | Ensure your Resend domain is verified at [resend.com/domains](https://resend.com/domains) and matches your `SENDER_EMAIL` |
| **`Razorpay payment modal fails`** | Invalid merchant key loading | Ensure the development key is configured in `apps/storefronts/zolexora-shop/web/.env.local` |
| **`Admin portal displays blank screen`** | Authentication role mismatch | Sign in using the correct administrator credentials: `admin@zolexora.com` |
| **`Port 8000 Address Already in Use`** | Zombie python process running | Free the port by running: `lsof -ti:8000 \| xargs kill -9` |

---

## 📞 Support & Resources
* **Backend Health Check Route**: `https://api--zolexora-api--4m8d68ky29h8.code.run/api/health`
* **API Documentation Endpoint**: `https://api.zolexora.com/docs`
* **Default Seeder Admin Account**: `admin@zolexora.com` / `Zolexora@Admin2025`
* **MongoDB Management Console**: [MongoDB Atlas](https://cloud.mongodb.com)
