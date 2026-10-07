# Zolexora IMS — Infiltration & Application Takedown Threat Model Report

**Document Version:** 1.0.0  
**Date:** September 2026  
**Target Systems:** 
- Tenant IMS Worker (`ims.zolexora.workers.dev` / `apps/ims-user`)
- Platform SuperAdmin Control Plane (`admin-ims.zolexora.workers.dev` / `apps/ims-admin`)
- Cloudflare D1 Relational Engine (`zolexora-ims-1-db`)
- Cloudflare KV Distributed Session Store (`SESSION_KV`)

---

## 1. Executive Summary

This report outlines the realistic attack paths that malicious actors (external attackers, rogue tenants, automated botnets, and compromised accounts) can execute against the **Zolexora IMS** infrastructure. 

The threats are bifurcated into two primary threat objectives:
1. **Infiltration & Compromise**: Unauthorized access, cross-tenant data exfiltration, privilege escalation, credential cracking, and session hijacking.
2. **Application Takedown & Service Disruption**: Database starvation, lock contention, quota and write exhaustion, financial denial of service (FDoS), and unrecoverable data deletion.

```mermaid
flowchart TD
    Attacker([External Threat Actor / Rogue Tenant])

    subgraph Edge Layer [Cloudflare Edge Network]
        AuthRoute["Authentication & Sessions (/api/session, /api/auth/login)"]
        HealthRoute["Diagnostic Health (/api/health, /api/d1/health)"]
        RpcRoute["Universal RPC Engine (/api/rpc/*)"]
        AdminRoute["Platform Admin & SQL Console (/api/platform/database/query)"]
    end

    subgraph Storage [Cloudflare Serverless Persistence]
        D1[(Cloudflare D1 SQLite)]
        KV[(Cloudflare KV Session Store)]
    end

    Attacker -->|1. Credential Cracking / Session Hijacking| AuthRoute
    Attacker -->|2. Asymmetric N+1 Query Flooding| HealthRoute
    Attacker -->|3. BOLA / Multi-Tenant Exfiltration| RpcRoute
    Attacker -->|4. SQL Execution / Database Wipeout| AdminRoute

    HealthRoute -->|Full Table Scans (Denial of Service)| D1
    RpcRoute -->|Unscoped Queries (Cross-Tenant Leak)| D1
    AdminRoute -->|DELETE FROM organizations| D1
    AuthRoute -->|KV Write Rate Saturation| KV
```

---

## 2. Infiltration Methods (Data Compromise & System Takeover)

### 2.1 Broken Multi-Tenant Isolation & BOLA / IDOR
* **Mechanism:** In multi-tenant databases where all tenant records reside in shared tables, every database query must strictly enforce tenant scoping (`WHERE org_id = ?`). Without explicit scoping bound to the server-side session, users from Organization A can view or manipulate data belonging to Organization B.
* **Code Findings in Zolexora:**
  - In [`apps/ims-user/worker.js`](../apps/ims-user/worker.js):
    ```javascript
    async function getProducts(db) {
      const res = await db.prepare('SELECT * FROM products ORDER BY item_code ASC;').all();
      return (res.results || []).map(p => formatProductFromRow(p));
    }
    ```
    `getProducts` executes a blanket query with **no `WHERE org_id = ?` clause**, returning all products across every tenant on the platform.
  - In `saveProduct(db, item)`, the tenant ID is hardcoded to `'ORG_ZOLEXORA_001'`, preventing tenant partitioning and causing cross-organization overwrites.
* **Impact:** High. An attacker with a low-privilege account in their own organization can exfiltrate competitors' proprietary product catalogs, supplier margins, sales volumes, and customer lists.

### 2.2 Cryptographic Failures & Static Salt Password Hashing
* **Mechanism:** Fast hashing functions (like standard SHA-256) lack adaptive work factors (iteration counts or memory hardness). A static salt committed to version control enables instant GPU-accelerated hash cracking.
* **Code Findings in Zolexora:**
  - In [`apps/ims-user/worker.js`](../apps/ims-user/worker.js):
    ```javascript
    const SALT = '_zolexora_salt_2026';

    async function hashPassword(password) {
      const enc = new TextEncoder();
      const data = enc.encode(password + SALT);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    ```
* **Impact:** Critical. Modern GPU clusters (e.g., hashcat with RTX 4090) compute billions of SHA-256 hashes per second. If the database is breached or accessed, user passwords can be cracked almost instantaneously.

### 2.3 Interactive SQL Console & Incomplete Blacklist Evasion
* **Mechanism:** Administrative endpoints providing raw SQL execution rely on blacklists to block destructive queries. Blacklists are notoriously vulnerable to syntax evasion and unlisted destructive keywords.
* **Code Findings in Zolexora:**
  - In [`apps/ims-admin/worker.js`](../apps/ims-admin/worker.js):
    ```javascript
    const dangerousPatterns = ['DROP DATABASE', 'DROP ALL', 'ATTACH', 'DETACH', 'PRAGMA', 'DROP TABLE'];
    if (dangerousPatterns.some(kw => upper.includes(kw))) {
      return { success: false, error: 'Unsafe operation rejected by Platform Security Guardian.' };
    }
    const res = await db.prepare(cleanQuery).all();
    ```
  - The blacklist permits:
    - `DELETE FROM organizations;` (Destroys all tenant registrations)
    - `DELETE FROM users;` (Locks out all platform users and administrators)
    - `UPDATE users SET role = 'SuperAdmin' WHERE email = 'attacker@evil.com';` (Privilege escalation)
    - `SELECT * FROM users;` (Exfiltrates all credentials and audit records)
* **Impact:** Critical. Compromise of an admin session or bypass of admin authentication grants complete control over the application's underlying database.

### 2.4 Session Identifier Leakage via URL Parameters
* **Mechanism:** When session tokens are accepted in URL query parameters (`?sessionId=...`), tokens get logged in browser histories, proxy caches, server web logs, and external `Referer` headers when clicking outgoing links.
* **Code Findings in Zolexora:**
  - In [`apps/ims-user/worker.js`](../apps/ims-user/worker.js):
    ```javascript
    if (url) {
      const qToken = url.searchParams.get('sessionId') || url.searchParams.get('sessionToken');
      if (qToken) return qToken.trim();
    }
    ```
* **Impact:** Medium-High. Attackers gaining access to client browser logs or reverse proxy access logs can hijack active sessions.

### 2.5 Cross-Tenant Impersonation Exploit
* **Mechanism:** The admin endpoint `/api/platform/impersonate` enables cross-launching into tenant spaces. If authorization checks fail or session verification is loosely coupled, attackers can forge or replay impersonation payloads to jump between tenant contexts.

---

## 3. Application Takedown Methods (Denial of Service & Disruption)

### 3.1 Asymmetric Database Starvation via Health Checks (Application-Layer DoS)
* **Mechanism:** An unauthenticated endpoint that triggers multiple expensive internal operations can be bombarded with lightweight HTTP requests. The attacker spends minimal bandwidth while the backend exhausts its CPU, connection pool, or database worker thread capacity.
* **Code Findings in Zolexora:**
  - In [`apps/ims-user/worker.js`](../apps/ims-user/worker.js) (public `/api/health` and `/api/d1/health`):
    ```javascript
    const tablesRes = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';"
    ).all();
    for (const tbl of tableNames) {
      const countRes = await env.DB.prepare(`SELECT count(*) as count FROM ${tbl};`).first();
      counts[tbl] = countRes?.count ?? 0;
    }
    ```
  - Every single unauthenticated GET request forces Cloudflare D1 to run `sqlite_master` lookups followed by 13 individual `SELECT count(*)` table scans.
* **Impact:** High. A botnet sending 100 GET requests/second produces 1,400+ sequential SQL queries per second against SQLite, completely starving legitimate user queries and triggering 504 Gateway Timeouts.

### 3.2 Cloudflare D1 Single-Writer Lock Contention
* **Mechanism:** SQLite (the engine behind Cloudflare D1) operates on a serialized write model (single-writer concurrency). While read queries can execute concurrently across edge replicas, write transactions must acquire an exclusive lock.
* **Attack Scenario:**
  - An attacker sends high-frequency concurrent writes to endpoints such as `/api/rpc/saveProduct`, `/api/rpc/recordSale`, or inventory adjustments.
  - Legitimate checkout, POS billing, or inventory transfers experience lock timeouts (`SQLITE_BUSY` or `D1_ERROR: database is locked`).
* **Impact:** Medium-High. Degrades or completely freezes POS and inventory operations during business hours.

### 3.3 Storage Quota & Rate Limit Exhaustion
* **Mechanism:** Cloudflare D1 databases have fixed storage caps (500 MB on Workers Free, 10 GB on standard Workers Paid). Additionally, Cloudflare KV has write rate limits of 1 write/second per individual key.
* **Attack Scenario:**
  - **D1 Exhaustion:** An attacker automates creation of dummy products or transactions with large payloads, filling the database to the 10 GB ceiling. Once full, all subsequent database `INSERT` operations fail globally.
  - **KV Session Flooding:** An attacker spams authentication endpoints with random credentials or initiates repeated logins, saturating Cloudflare KV's account-level write thresholds and causing edge session drops.
* **Impact:** High. Leads to prolonged downtime requiring manual database pruning.

### 3.4 Financial Denial of Service (FDoS / "Denial of Wallet")
* **Mechanism:** Serverless architectures automatically scale to handle incoming HTTP requests. However, serverless compute is billed per request, CPU wall-clock duration, and database read/write units.
* **Attack Scenario:**
  - An attacker targets un-cached dynamic API endpoints (`/api/rpc/getInventoryDashboardData`, `/inv-dashboard`) with millions of distributed requests.
  - While Cloudflare edge network absorbs the network traffic without crashing, the backend incurs millions of Worker CPU invocations and millions of D1 row read units, creating unexpected, exorbitant cloud bills.
* **Impact:** High financial burden, potentially triggering Cloudflare account suspension due to spend limits.

### 3.5 Irreversible Data Wipeout via Admin Control Plane
* **Mechanism:** Because `executeSqlConsoleQuery` does not prohibit `DELETE FROM` commands, an administrative compromise or CSRF exploit allows an attacker to execute:
  ```sql
  DELETE FROM organizations;
  DELETE FROM products;
  DELETE FROM selling_point_sales;
  ```
  In SQLite, if foreign key constraints with `ON DELETE CASCADE` are active, deleting organizations instantly wipes all child rows across the entire database.
* **Impact:** Catastrophic. Total operational halt and permanent data loss if automated snapshots and offsite backups are not configured.

---

## 4. Threat Matrix & Risk Scoring

| Threat Vector | Category | Likelihood | Impact | Severity | Primary Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BOLA / IDOR Cross-Tenant Spill** | Infiltration | High | High | **CRITICAL** | `apps/ims-user/worker.js` |
| **Weak Password Hashing (Static SHA-256)** | Infiltration | High | High | **CRITICAL** | User authentication engine |
| **Admin SQL Console Exploitation** | Infiltration / Wipeout | Medium | Extreme | **CRITICAL** | `apps/ims-admin/worker.js` |
| **Health Check DoS (N+1 Query Loop)** | Takedown | High | High | **HIGH** | `/api/health`, `/api/d1/health` |
| **SQLite Single-Writer Contention** | Takedown | High | Medium | **HIGH** | POS & inventory write endpoints |
| **Storage & KV Quota Exhaustion** | Takedown | Medium | High | **HIGH** | D1 & KV bindings |
| **Session Exposure via URL Parameters** | Infiltration | Medium | Medium | **MEDIUM** | `getSessionToken()` |
| **Financial Denial of Service (FDoS)** | Takedown | Medium | High | **HIGH** | Un-cached dynamic API routes |

---

## 5. Defensive Hardening Blueprint

### Phase 1: Immediate Critical Remediation
1. **Enforce Strict Tenant Parameter Scoping:**
   - Modify all D1 queries to bind `session.user.orgId` directly from the authenticated session:
     ```javascript
     const res = await db.prepare(
       'SELECT * FROM products WHERE org_id = ? ORDER BY item_code ASC;'
     ).bind(session.user.orgId).all();
     ```
   - Never trust client-supplied `orgId` parameters in JSON request payloads.

2. **Upgrade Password Hashing:**
   - Replace static-salted SHA-256 with standard **Argon2id** or **PBKDF2-SHA256** (with >= 600,000 iterations using `crypto.subtle`).
   - Store unique cryptographic salt (`crypto.getRandomValues`) per user record.

3. **Sanitize Diagnostic Health Check:**
   - Replace table counting loops in `/api/health` with a single, fast ping:
     ```javascript
     await env.DB.prepare('SELECT 1;').first();
     ```
   - Restrict detailed database diagnostic metrics to authenticated SuperAdmin users.

4. **Decommission Insecure SQL Console:**
   - Remove arbitrary SQL execution endpoints from public-facing worker code.
   - Restrict ad-hoc queries to the Cloudflare Wrangler CLI with authorized cloud API tokens.

### Phase 2: Edge & Session Hardening
1. **Restrict Session Identification to Secure Cookies:**
   - Remove `url.searchParams.get('sessionId')` token retrieval.
   - Enforce cookie attributes: `HttpOnly; Secure; SameSite=Strict; Path=/`.

2. **Deploy Cloudflare Turnstile & Rate Limiting:**
   - Embed Cloudflare Turnstile bot verification on login, user creation, and transaction routes.
   - Enable Cloudflare WAF Rate Limiting rules (e.g., maximum 60 requests/minute per client IP for `/api/*`).

3. **Automated Backup Strategy:**
   - Schedule daily automated D1 database exports (`wrangler d1 export`) encrypted and pushed to Cloudflare R2 bucket with object versioning enabled.
