# MASTER SECURITY REMEDIATION PROMPT: Zolexora IMS Hardening

> **Target Codebase:** Zolexora IMS Monorepo (`apps/ims-admin`, `apps/ims-user`)  
> **Input Audit:** [`GITHUB_AND_SECURITY_AUDIT_REPORT.md`](file:///workspaces/Zolexora_IMS/GITHUB_AND_SECURITY_AUDIT_REPORT.md)  
> **Role:** Principal Security Engineer & Cloudflare Edge Systems Architect  
> **Mission:** Execute complete remediation of all 10 critical and high-severity security vulnerabilities, eradicate backdoors, enforce multi-tenant isolation, secure edge sessions, and sanitize secret leaks.

---

## EXECUTION INSTRUCTIONS FOR AI AGENT / DEVELOPER

You are tasked with executing a comprehensive security hardening of the **Zolexora IMS** repository. Follow the strict requirements below without deviating. Preserve all existing business logic (inventory tracking, POS transactions, billing calculations, and UI views) while eliminating all security flaws.

---

### STAGE 1: Eradicate Backdoors & Authentication Bypasses (Critical)

1. **Purge Platform Admin Backdoors in `apps/ims-admin/worker.js`:**
   - **Remove `?devBypass` Query Param**: In `handleApiRouter`, remove `url.searchParams.has('devBypass')`. All administrative endpoints must strictly require a verified session.
   - **Remove `X-Dev-Bypass` Header**: In `getAdminSession`, remove the `request.headers.get('X-Dev-Bypass') === 'true'` block that forges `DEV_SUPERADMIN`.
   - **Remove `adm_*` Prefix Fallback**: In `getAdminSession`, remove `if (token.startsWith('adm_'))`. A token must exist as an active, non-expired key in `env.SESSION_KV` to be valid.
   - **Remove Hardcoded Master Passwords**: In `handleAdminLogin`, remove the static check:
     ```javascript
     const isSuperAdminEmail = ...;
     const isMasterPassword = password === 'Admin@123' || password === 'Zolexora@2026';
     ```
     All logins must verify against stored, salted password hashes in the D1 `users` table.

2. **Purge Tenant Application Backdoors in `apps/ims-user/worker.js`:**
   - **Remove Universal Fallback Passwords**: In `loginUser`, delete the `validFallbackPasswords` array (`Admin@123`, `admin`, `123456`, `Zolexora@2026`, etc.).
   - **Remove SuperAdmin Auto-Login Bypass**: Remove `const isSuperAdmin = ...` and the condition allowing password-less or fallback logins for specific email addresses.
   - **Remove Forced Password Hash Overwrite**: Delete the block in `loginUser` that overwrites `user.password_hash` in D1 when logging in with a fallback password.
   - **Remove Password Auto-Fill**: In `loginUser`, reject empty password submissions with `400 Bad Request` instead of defaulting to `Admin@123`.

3. **Eradicate Credential Leak in `GET /api/login`:**
   - In `apps/ims-user/worker.js` (around line 331), modify `handleRestApi` so `GET /api/login` returns only `{ success: true, service: 'Zolexora Auth API' }` and never leaks `defaultCredentials` or administrative emails/passwords.

---

### STAGE 2: Secure API Routers & RPC Bridge (Critical)

1. **Implement Unified Session Verification Middleware:**
   - Create a reusable helper function in both workers:
     ```javascript
     async function authenticateRequest(request, env) {
       const token = extractSessionToken(request);
       if (!token || !env.SESSION_KV) return null;
       const raw = await env.SESSION_KV.get('session:' + token);
       if (!raw) return null;
       try {
         const session = JSON.parse(raw);
         if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
           return null;
         }
         return session;
       } catch (e) {
         return null;
       }
     }
     ```

2. **Lock Down Universal RPC Bridge (`/api/rpc/:functionName`):**
   - In `apps/ims-user/worker.js`, wrap `handleD1Rpc` with authentication:
     - Publicly exempt ONLY: `loginUser`, `authenticateUser`.
     - All other RPC methods (`getItems`, `saveProduct`, `deleteProduct`, `saveUser`, `deleteUser`, `createOrganization`, `processSupplierPurchase`, `recordSellingPointSale`, `getSettings`, etc.) MUST verify `const session = await authenticateRequest(request, env)`.
     - If no valid session is found, immediately return:
       ```javascript
       return jsonResponse({ success: false, error: 'Unauthorized: Active session required.' }, 401, request);
       ```

3. **Lock Down REST Endpoints:**
   - In `handleRestApi` of `apps/ims-user/worker.js`, ensure all mutating endpoints (`POST /api/products`, `POST /api/sales`, etc.) and sensitive GET endpoints (`/api/users`, `/api/dashboard`) require an authenticated session.

4. **Decommission / Protect Raw SQL Execution:**
   - In `apps/ims-admin/worker.js`, either:
     - **Option A (Recommended)**: Completely remove `/api/platform/database/query` and advise administrators to use Cloudflare Wrangler CLI (`npx wrangler d1 execute`).
     - **Option B**: Restrict queries strictly to read-only `SELECT` statements (rejecting `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `ATTACH`, `PRAGMA`), enforce strict row-limits (max 50), and require active SuperAdmin session verification.

---

### STAGE 3: Multi-Tenancy Isolation & Session Security (High)

1. **Enforce Strict Tenant Filtering in Database Queries:**
   - In `apps/ims-user/worker.js`, update all database query handlers to accept the authenticated tenant `orgId`:
     - Scope `SELECT * FROM products` to `SELECT * FROM products WHERE org_id = ?;` binding `session.user.orgId`.
     - Scope stores: `SELECT * FROM stores WHERE org_id = ?;`
     - Scope selling points: `SELECT * FROM selling_points WHERE org_id = ?;`
     - Scope suppliers: `SELECT * FROM suppliers WHERE org_id = ?;`
     - Scope transactions: `SELECT * FROM supplier_transactions WHERE org_id = ?;`
     - Scope users: `SELECT * FROM users WHERE org_id = ?;`
   - In `saveProduct`, `saveStore`, `saveSellingPoint`, `saveSupplier`, `recordSellingPointSale`, replace the hardcoded `'ORG_ZOLEXORA_001'` with the verified `session.user.orgId`.

2. **Lock Down `/api/session` Endpoint:**
   - In `handleSessionApi` of `apps/ims-user/worker.js`, disable unauthenticated `POST /api/session`.
   - Sessions must ONLY be minted inside `loginUser` after validating password credentials.
   - Do not allow external callers to supply arbitrary `user` objects or role definitions to KV.

---

### STAGE 4: CORS, Cryptography & Frontend XSS Defense (Medium)

1. **CORS Whitelisting:**
   - In both workers, replace `origin = request.headers.get('Origin') || '*'` reflection with a strict domain whitelist:
     ```javascript
     const ALLOWED_ORIGINS = new Set([
       'https://ims.zolexora.com',
       'https://admin.ims.zolexora.com',
       'https://ims.zolexora.workers.dev',
       'https://admin-ims.zolexora.workers.dev'
     ]);
     ```
   - If the incoming origin is not in `ALLOWED_ORIGINS` (and not a local development URL like `http://localhost:5173`), omit `Access-Control-Allow-Credentials` and do not echo back the origin.

2. **Cryptographic Hardening (PBKDF2):**
   - Replace the single-round SHA-256 function in both workers with PBKDF2 using standard Web Crypto API:
     - 100,000 iterations of SHA-256.
     - Store password hashes in the format `pbkdf2:100000:<salt_hex>:<hash_hex>`.
     - Support legacy hash migration on successful login.

3. **Frontend XSS Neutralization:**
   - In `apps/ims-admin/client/JavaScript.html` and `apps/ims-user/client/JavaScript.html`, implement an HTML escaping utility:
     ```javascript
     function escapeHtml(str) {
       if (str === null || str === undefined) return '';
       return String(str)
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');
     }
     ```
   - Wrap all dynamically interpolated database values (item names, descriptions, user emails, transaction notes) with `escapeHtml(...)` before writing to `innerHTML`.

---

### STAGE 5: Git History Cleanup & Branch Alignment

1. **Align `dev` and `main` Branches:**
   - Test that `origin/dev` builds cleanly.
   - Merge `origin/dev` into `main` so production benefits from the modern React/FastAPI architecture and initial security patches:
     ```bash
     git checkout main
     git merge origin/dev
     ```

2. **Scrub Git History of Exposed Secrets:**
   - Execute `git-filter-repo` to replace historical references to:
     - Supabase Anon Key (`eyJhbGciOiJIUzI1Ni...`)
     - Google Apps Script execution URLs (`AKfycb...`)
     - Legacy Drive Folder IDs (`1lkSx36mqaqn...`)
     - Developer PII email addresses.
   - Rotate the Supabase Anon Key and JWT Secret in the Supabase Dashboard.

---

### STAGE 6: Verification & Acceptance Testing

Verify that all of the following tests pass after applying the changes:

| Test Case | Expected Result |
| :--- | :--- |
| `GET /api/platform/overview?devBypass` without session | **401 Unauthorized** (Bypass blocked) |
| `GET /api/platform/overview` with `X-Dev-Bypass: true` | **401 Unauthorized** (Bypass blocked) |
| `GET /api/platform/overview` with `Authorization: Bearer adm_fake` | **401 Unauthorized** (Fake prefix rejected) |
| `GET /api/login` | **200 OK**, response contains NO passwords or admin emails |
| `POST /api/rpc/getItems` with no session cookie/header | **401 Unauthorized** |
| `POST /api/rpc/loginUser` with empty password | **400 Bad Request** |
| `POST /api/rpc/loginUser` with invalid password | **401 Unauthorized** (Fallback passwords rejected) |
| `POST /api/rpc/loginUser` with correct credentials | **200 OK**, returns valid KV session token |
| `POST /api/session` with arbitrary SuperAdmin payload | **405 Method Not Allowed / 401 Unauthorized** |
| Cross-tenant query by Tenant B | Returns ONLY Tenant B's products and stores |
| `npm run build` | Both apps bundle successfully with zero errors |
