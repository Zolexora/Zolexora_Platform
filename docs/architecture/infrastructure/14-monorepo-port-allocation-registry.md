# Monorepo Port Allocation Registry & Standards

## 1. Overview & Strategy (Option 1)

In the Zolexora Platform monorepo (10+ full-stack products), running multiple Docker containers and local development servers simultaneously can cause port collisions—particularly with host workstation tools (such as PostgreSQL running natively on host port `5432`).

To eliminate collisions, the platform enforces a **Deterministic Port Offset Architecture**:
1. **Host Workstation Reserved (`5432`)**: Port `5432` is reserved strictly for the developer's host operating system. Dev containers and Docker Compose services must **never** bind to host port `5432`.
2. **Dedicated Product Postgres Range (`5433`–`5460`)**: Every product's PostgreSQL database is assigned an isolated host port offset mapped via environment variables (e.g., `${TMS_POSTGRES_PORT:-5438}:5432`).
3. **Dedicated Nginx Gateway Range (`3070`–`3099`)**: Every product exposes its primary web interface and routing gateway on a unique port.
4. **Dedicated Backend API Range (`4000`–`4199`)**: Backend APIs have explicit port assignments.
5. **Reserved Slots for Future Applications**: A pre-allocated range is documented below for future apps 1 through 10+ so new additions never require reshuffling existing services.

---

## 2. Master Port Registry (Current Applications)

| Product | Code | Nginx Gateway | Frontend (Dev) | Backend API | PostgreSQL (Host Offset) | Other Databases / Services |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Host Workstation** | `HOST` | — | — | — | **`5432`** *(Host OS)* | — |
| **Zolexora AppSuite** | `ZAS` | **`3070`** | `3000` | — | **`5439`** (`APPSUITE_POSTGRES_PORT`) | — |
| **Zolexora AI** | `ZAI` | **`3071`** | `3040` | **`4090`** | — | Redis `6379` |
| **Zolexora IMS** | `IMS` | **`3072`** | `3050` | **`4060`** (User), **`4070`** (Admin) | **`5434`** (`IMS_POSTGRES_PORT`) | — |
| **ClarityFi** | `CLARITY` | **`3075`** | `3055` | **`4020`** | **`5437`** (`CLARITYFI_POSTGRES_PORT`) | — |
| **Rentoeasy** | `RENTO` | **`3076`** | `3060` | **`4040`** | **`5436`** (`RENTOEASY_POSTGRES_PORT`) | Redis `6379` |
| **Zolexora Engage** | `ENGAGE` | **`3077`** | `3041` | **`4050`** | — | — |
| **Zolexora Marketplace** | `MKT` | **`3079`** | `3000` (Shop), `3001` (Admin), `3002` (Seller) | **`4100`** | **`5433`** (`MARKETPLACE_POSTGRES_PORT`) | MongoDB `27017` |
| **The Textile Care** | `TTC` | **`3080`** | `3000` (Admin), `3001` (Seller), `3002` (Mkt) | **`4010`** | **`5435`** (`TTC_POSTGRES_PORT`) | Redis `6379` |
| **Platform Admin** | `ADMIN` | — | **`3082`** | **`3081`** | **`5440`** (`PLATFORM_ADMIN_POSTGRES_PORT`) | — |
| **Maun Kavach** | `MK` | **`3083`** | `3065` | **`4080`** | — | — |
| **Zolexora TMS** | `TMS` | **`3084`** | `3031` (TMS), `3032` (Admin) | **`4030`** | **`5448`** (`TMS_POSTGRES_PORT`) | — |
| **Zolexora ERP** | `ERP` | **`8080`**, **`8443`** | — | **`8000`**, **`8001`** | — | MariaDB `3306`, Redis `6380` |
| **Supabase Local Stack** | `SB` | — | `54323` (Studio), `54324` (Inbucket) | **`54321`** (Kong API) | **`54322`** (Postgres DB) | — |

---

## 3. Reserved Port Registry for Future Applications

When creating a new product or application, assign ports strictly from this pre-allocated table:

| Slot | Gateway / Nginx | Backend API | Dedicated PostgreSQL (Host) | Dev Frontend | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Future App 1** | **`3085`** | **`4110`** | **`5441`** (`APP1_POSTGRES_PORT`) | `3101` | *Reserved* |
| **Future App 2** | **`3086`** | **`4120`** | **`5442`** (`APP2_POSTGRES_PORT`) | `3102` | *Reserved* |
| **Future App 3** | **`3087`** | **`4130`** | **`5443`** (`APP3_POSTGRES_PORT`) | `3103` | *Reserved* |
| **Future App 4** | **`3088`** | **`4140`** | **`5444`** (`APP4_POSTGRES_PORT`) | `3104` | *Reserved* |
| **Future App 5** | **`3089`** | **`4150`** | **`5445`** (`APP5_POSTGRES_PORT`) | `3105` | *Reserved* |
| **Future App 6** | **`3090`** | **`4160`** | **`5446`** (`APP6_POSTGRES_PORT`) | `3106` | *Reserved* |
| **Future App 7** | **`3091`** | **`4170`** | **`5447`** (`APP7_POSTGRES_PORT`) | `3107` | *Reserved* |
| **Future App 8** | **`3092`** | **`4180`** | **`5448`** (`APP8_POSTGRES_PORT`) | `3108` | *Reserved* |
| **Future App 9** | **`3093`** | **`4190`** | **`5449`** (`APP9_POSTGRES_PORT`) | `3109` | *Reserved* |
| **Future App 10** | **`3094`** | **`4200`** | **`5450`** (`APP10_POSTGRES_PORT`) | `3110` | *Reserved* |

---

## 4. Standard Rules for `compose.yaml`

When adding or configuring Docker services in any product:

1. **PostgreSQL Configuration**:
   Always expose ports using environment variable defaults:
   ```yaml
   services:
     postgres:
       image: postgres:15-alpine
       ports:
         - "${<PRODUCT>_POSTGRES_PORT:-54XX}:5432"
   ```
   *Never* hardcode `5432:5432`.

2. **Nginx Reverse Proxy Gateway**:
   Expose the gateway on its assigned port:
   ```yaml
   services:
     nginx:
       ports:
         - "${<PRODUCT>_PORT:-30XX}:80"
   ```

3. **Internal Container-to-Container Networking**:
   All internal services (such as FastAPI connecting to Postgres or Redis) connect over Docker's internal network using standard default ports (e.g. `postgresql://user:pass@postgres:5432/dbname`). Only host exposure requires the offset port.

---

## 5. Dev Container Configuration Standard

In `.devcontainer/devcontainer.json`:
* Set `"5432": { "onAutoForward": "ignore" }` so VS Code never attempts to hijack host PostgreSQL.
* Keep `forwardPorts` aligned with active and reserved gateway/database ports.
