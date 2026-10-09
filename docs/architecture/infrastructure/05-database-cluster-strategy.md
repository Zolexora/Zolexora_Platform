# Zolexora Platform — Database Cluster Strategy
**Zero-Cost Architecture for 80GB+ of Free Storage**

> **Status:** Proposed — pending review and approval  
> **Author:** Platform Architecture Review  
> **Date:** 2026-10-09

---

## The Problem

The Zolexora Platform currently has **database sprawl** — each product was given its own database, its own connection code, and its own set of credentials. This leads to:

- 40+ separate database keys scattered across `.env` files
- 10 copies of database connection code (one per product)
- No central visibility into which databases are up or down
- Wasted free tier capacity (20GB+ sitting unused)
- "Works on my machine" bugs because credentials are inconsistent
- Zero ability to do cross-product queries (e.g. Platform Admin seeing all products)

---

## What You Actually Have For Free

| Database | Accounts | Free Per Account | **Total Free Capacity** |
|---|---|---|---|
| Supabase (PostgreSQL) | 20+ accounts | 500MB × 2 projects | **20GB+ relational** |
| Cloudflare D1 (SQLite) | 13+ accounts | 5GB, 10 DBs | **65GB+ edge SQLite** |
| MongoDB Atlas | Unlimited projects | 512MB per M0 cluster | **Unlimited × 512MB** |
| Cloudflare R2 | 13+ accounts | 10GB per account | **130GB+ object storage** |
| Cloudinary | Per account | 25GB media | **Media CDN** |

**You are not short on storage. You are short on organisation.**

---

## The Target Architecture

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────┐
│         Cloudflare Worker (Edge Layer)           │
│                                                  │
│  ┌──────────┐   Cache hit?                       │
│  │  D1 DBs  │ ──────────────► Serve in <50ms     │
│  └──────────┘                                    │
│       │ Cache miss                               │
└───────┼──────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│     Platform Admin — FastAPI Backend             │
│          (Central Connection Router)             │
│                                                  │
│  get_db("zolexora-ims")   ──► Supabase Project 1│
│  get_db("clarity-fi")     ──► Supabase Project 3│
│  get_mongo("zolexora-ai") ──► MongoDB db_ai      │
│  get_r2_url("invoice.pdf")──► Cloudflare R2      │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┼───────────┐
        ▼          ▼           ▼
  Supabase     MongoDB      Cloudflare
  (4 projects) (N clusters) (D1 + R2)
```

---

## Data Classification — What Goes Where

### Rule 1: Supabase PostgreSQL — Transactional Data Only
Use for: users, orders, payments, inventory, anything that needs ACID transactions, joins, and row-level security.

**Do NOT store:** files, images, logs, event streams, chat history.

### Rule 2: MongoDB Atlas — Document & Event Data
Use for: AI chat history, logistics event streams, product review documents, email campaign delivery records, anything with flexible or nested structure.

**Do NOT store:** user authentication, payment records, anything requiring ACID.

### Rule 3: Cloudflare D1 — Edge Cache Only
Use for: auth token validation, product catalog reads, feature flags, rate limiting state — data that needs to be read globally fast.

**Do NOT use as:** primary storage. D1 is a cache of data that primarily lives in Supabase/MongoDB.

### Rule 4: Cloudflare R2 — All Files
Use for: every file, image, video, PDF, export, invoice, document, delivery photo. Zero egress fees. Served via Cloudflare CDN automatically.

**Do NOT store:** binary data in Supabase, MongoDB, or D1.

---

## Part 1 — `scripts/db/migrate-schemas.sql`

### What It Is
A single SQL file that creates isolated schemas and tables for multiple products inside one Supabase project. You run it once per Supabase project via the Supabase SQL editor or CLI.

### Why You Need It
Without schemas, every product uses the default `public` schema. If two products both have a `products` table, they conflict. Schemas create completely isolated namespaces inside one database — like folders on a hard drive.

### How It Works

**Step 1:** You pick which products share which Supabase project (based on the consolidation plan below).

**Step 2:** You run the SQL file for that project. It creates:
```sql
-- Isolated namespaces
CREATE SCHEMA IF NOT EXISTS ims;
CREATE SCHEMA IF NOT EXISTS marketplace;
CREATE SCHEMA IF NOT EXISTS tms;

-- Tables inside each namespace
CREATE TABLE IF NOT EXISTS ims.products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    sku           TEXT UNIQUE,
    stock_qty     INTEGER DEFAULT 0,
    price         NUMERIC(10,2),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace.sellers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    verified      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- ... and so on for every product's tables
```

**Step 3:** Row Level Security (RLS) policies are automatically applied so IMS code can never accidentally read or write Marketplace data — even if they're in the same database.

```sql
-- IMS backend can only see IMS rows
ALTER TABLE ims.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ims_isolation" ON ims.products
    USING (current_setting('app.product') = 'ims');
```

### The Consolidation Plan (4 free Supabase projects)

| Project | Supabase Account | Products Inside | Schemas |
|---|---|---|---|
| **zolexora-core** | Account A, Project 1 | IMS, Marketplace, TMS | `ims`, `marketplace`, `tms` |
| **zolexora-commerce** | Account A, Project 2 | Textile Care, Rento Easy, Platform Admin | `textile_care`, `rento_easy`, `platform_admin` |
| **zolexora-business** | Account B, Project 1 | Engage, Clarity FI, Maun Kavach | `engage`, `clarity_fi`, `maun_kavach` |
| **zolexora-ai-erp** | Account B, Project 2 | Zolexora AI, ERP supplements | `zolexora_ai`, `erp_supplements` |

**Result: 40+ keys → 8 keys (4 projects × URL + SERVICE_KEY)**

### How to Run It (when ready)
```bash
# Option 1: Supabase Dashboard
# Open Project → SQL Editor → paste the file → Run

# Option 2: Supabase CLI
supabase db push --db-url "postgresql://postgres:[password]@[host]:5432/postgres"
```

---

## Part 2 — `products/platform-admin/backend/app/db/`

### What It Is
A Python module inside the Platform Admin FastAPI backend that acts as a single connection router for all databases across the entire platform.

### Why You Need It
Currently every product has its own copy of this type of code:
```python
# zolexora-ims/backend/database.py
import psycopg2
conn = psycopg2.connect(os.getenv("SUPABASE_URL"))

# zolexora-marketplace/backend/database.py
import psycopg2
conn = psycopg2.connect(os.getenv("SUPABASE_URL"))   # different URL, same code
```

10 copies. When the connection strategy changes (e.g., enabling Supavisor pooling), you update 10 files. When a key rotates, you update 10 `.env` files. When a database goes down, you have no central place to know about it.

### The Three Files

#### `app/db/config.py` — The Map
Defines exactly where every product's data lives. This is the single source of truth:

```python
PRODUCT_DB_MAP = {
    "zolexora-ims": {
        "supabase_project": "core",          # → uses SUPABASE_CORE_URL
        "schema":           "ims",           # → searches in ims.* tables
        "pool_port":        6543,            # → Supavisor (not 5432!)
    },
    "zolexora-marketplace": {
        "supabase_project": "core",
        "schema":           "marketplace",
        "pool_port":        6543,
    },
    "clarity-fi": {
        "supabase_project": "business",      # → uses SUPABASE_BUSINESS_URL
        "schema":           "clarity_fi",
        "pool_port":        6543,
    },
    # ... all 11 products
}

MONGO_DB_MAP = {
    "zolexora-ai":    "db_ai",
    "zolexora-tms":   "db_tms",
    "zolexora-engage":"db_engage",
}

D1_DB_MAP = {
    "sessions": "D1_SESSIONS_ID",    # → env var name for this D1 database ID
    "catalog":  "D1_CATALOG_ID",
    "config":   "D1_CONFIG_ID",
}
```

#### `app/db/connections.py` — The Connector
A set of functions that accept a product name and return a live, pooled database connection. Handles all the complexity internally:

```python
async def get_supabase(product: str) -> AsyncClient:
    """
    Returns a Supabase client for the correct project + schema.
    Automatically uses Supavisor pooler (port 6543) for connection pooling.
    Example: client = await get_supabase("zolexora-ims")
    """

async def get_mongo(product: str) -> AsyncIOMotorDatabase:
    """
    Returns a MongoDB database handle for the correct database.
    Example: db = await get_mongo("zolexora-ai")
    Result: connected to db_ai inside the shared Atlas cluster
    """

def get_r2_url(bucket: str, key: str, expiry_seconds: int = 3600) -> str:
    """
    Returns a pre-signed Cloudflare R2 URL for secure file access.
    Example: url = get_r2_url("ims", "invoices/inv-001.pdf")
    """
```

#### `app/db/health.py` — The Monitor
A background task that runs every 60 seconds and checks every database connection. It powers the Platform Admin dashboard's "Database Health" panel:

```python
# Returns something like:
{
  "supabase_core":     {"status": "healthy", "latency_ms": 12},
  "supabase_commerce": {"status": "healthy", "latency_ms": 18},
  "supabase_business": {"status": "degraded","latency_ms": 340},
  "supabase_ai_erp":   {"status": "healthy", "latency_ms": 15},
  "mongodb":           {"status": "healthy", "latency_ms": 8},
  "d1_sessions":       {"status": "healthy", "latency_ms": 3},
}
```

### How Any Product Uses It
Instead of each product managing its own database connection, they call the Platform Admin API:

```python
# In any product's backend — one line, no database config needed
response = await platform_admin_client.get("/api/db/ims/products")

# OR if the product has direct Supabase access (preferred for speed):
from app.db.connections import get_supabase
client = await get_supabase("zolexora-ims")
data = await client.schema("ims").from_("products").select("*").execute()
```

---

## Part 3 — `config/envs/platform-admin/.env.example`

### What It Is
A single, clearly organised environment variable template that consolidates all database credentials for the entire platform into one file — replacing 10+ scattered `.env` files.

### Why You Need It
Currently you have:
```
products/zolexora-ims/.env         → has SUPABASE_URL (which project?)
products/zolexora-marketplace/.env → has SUPABASE_URL (different project!)
products/zolexora-ai/.env          → has SUPABASE_URL (yet another!)
```

Nobody knows which `SUPABASE_URL` belongs to which project. When you rotate a key, you update all of them manually and inevitably miss one.

### What It Looks Like
```bash
# ════════════════════════════════════════════════════════
# ZOLEXORA PLATFORM — MASTER DATABASE CREDENTIALS
# Load this into Infisical once. Never commit real values.
# ════════════════════════════════════════════════════════

# ── Supabase Project 1: Core ─────────────────────────────
# Products: IMS, Marketplace, TMS
# Account: account-a@zolexora.com, Project: zolexora-core
SUPABASE_CORE_URL=
SUPABASE_CORE_ANON_KEY=
SUPABASE_CORE_SERVICE_KEY=

# ── Supabase Project 2: Commerce ─────────────────────────
# Products: Textile Care, Rento Easy, Platform Admin
# Account: account-a@zolexora.com, Project: zolexora-commerce
SUPABASE_COMMERCE_URL=
SUPABASE_COMMERCE_ANON_KEY=
SUPABASE_COMMERCE_SERVICE_KEY=

# ── Supabase Project 3: Business ─────────────────────────
# Products: Engage, Clarity FI, Maun Kavach
# Account: account-b@zolexora.com, Project: zolexora-business
SUPABASE_BUSINESS_URL=
SUPABASE_BUSINESS_ANON_KEY=
SUPABASE_BUSINESS_SERVICE_KEY=

# ── Supabase Project 4: AI & ERP ─────────────────────────
# Products: Zolexora AI, ERP supplements
# Account: account-b@zolexora.com, Project: zolexora-ai-erp
SUPABASE_AI_URL=
SUPABASE_AI_ANON_KEY=
SUPABASE_AI_SERVICE_KEY=

# ── MongoDB Atlas ─────────────────────────────────────────
# One free M0 cluster. All product databases live inside it.
# Create new Atlas projects for more free clusters.
MONGO_URI=

# ── Cloudflare D1 (Edge Cache) ────────────────────────────
# These are D1 Database IDs from the Cloudflare Dashboard
CF_ACCOUNT_ID=
CF_API_TOKEN=
D1_SESSIONS_ID=
D1_CATALOG_ID=
D1_CONFIG_ID=
D1_ROUTES_ID=

# ── Cloudflare R2 (File Storage) ─────────────────────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_IMS=zolexora-ims-files
R2_BUCKET_MARKETPLACE=zolexora-marketplace-files
R2_BUCKET_TMS=zolexora-tms-files

# ── Shared Services ───────────────────────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### How This Works with Infisical
1. You create this file's real values in Infisical under `/platform-admin`
2. Every product's CI/CD pulls from Infisical using its specific path:
   - IMS pulls: `SUPABASE_CORE_URL`, `SUPABASE_CORE_SERVICE_KEY` only
   - Marketplace pulls: `SUPABASE_CORE_URL`, `SUPABASE_CORE_SERVICE_KEY` only
   - Platform Admin pulls: everything (it's the router)
3. Key rotation: update once in Infisical → all products updated automatically

---

## Implementation Order (When You're Ready)

```
Step 1: Organise your 20+ Supabase accounts
        → Pick 4 projects to be the canonical ones
        → Note down their URLs and keys

Step 2: Run migrate-schemas.sql on each project
        → Creates all schemas and tables
        → Takes ~2 minutes per project

Step 3: Load all keys into Infisical
        → Follow config/envs/platform-admin/.env.example
        → Everything in one place

Step 4: Build db/ connection manager in Platform Admin
        → All products share one connection library
        → No more copy-paste database code

Step 5: Update each product to use the new schemas
        → Change DATABASE_URL to include ?schema=ims etc.
        → One env var change per product
```

---

## What Changes for Developers After This

**Before:**
```bash
# Developer sets up 10 separate .env files, manually
# Each has its own SUPABASE_URL nobody can track
# "Which database is this connecting to??"
```

**After:**
```bash
git clone https://github.com/Zolexora/Zolexora_Platform
infisical login
./scripts/setup/start.sh
# Done. All databases connected automatically.
```

---

## Files to Be Created (Pending Your Approval)

| File | Location | Size |
|---|---|---|
| `migrate-schemas.sql` | `scripts/db/` | ~300 lines SQL |
| `config.py` | `products/platform-admin/backend/app/db/` | ~80 lines Python |
| `connections.py` | `products/platform-admin/backend/app/db/` | ~120 lines Python |
| `health.py` | `products/platform-admin/backend/app/db/` | ~60 lines Python |
| `.env.example` | `config/envs/platform-admin/` | ~50 lines |

**Nothing is built yet. Read this report and confirm when ready.**
