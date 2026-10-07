# Zolexora IMS — Complete GitHub History & Code Security Audit Report

**Report Generated:** September 2026  
**Repository:** [`Zolexora/Zolexora_IMS`](https://github.com/Zolexora/Zolexora_IMS)  
**Total Commits Audited:** 103 Commits across all branches (`main`, `dev`, and git commit objects)  
**Audit Scope:** Git history, commit diffs, deleted legacy artifacts, branch divergence (`main` vs `origin/dev`), secrets/tokens, Cloudflare Worker configurations, database schemas, and application source code.

---

## 1. Executive Summary

A deep forensic and architectural audit was performed on the entire git commit history, branches, configuration files, and application source code of the **Zolexora_IMS** repository.

### Key Audit Findings:
1. **Severe Branch Divergence (`main` vs `dev`):**  
   The default production branch (`origin/main`) is frozen at commit `cecda6a` and is **35 commits behind `origin/dev`**. Critical security patches and architectural upgrades (FastAPI + React Vite transition) implemented on `origin/dev` have **never been merged into `main`**.
2. **Critical Backdoors Active on `main`:**  
   The deployed code on `main` contains active authentication bypasses (`?devBypass`, `X-Dev-Bypass: true`, `adm_*` token prefix), an unauthenticated arbitrary SQL console, zero-auth RPC endpoints, and plaintext credential leaks.
3. **Hardcoded Secrets in Git History:**  
   Git commits across history contain hardcoded **live Supabase API keys & project URLs**, **Google Apps Script deployment IDs**, **Cloudflare D1 Database & KV Namespace UUIDs**, **hardcoded universal passwords**, and **personal developer PII**.

---

## 2. Git Repository & History Topology

### 2.1 Branch Architecture

```mermaid
gitGraph
   commit id: "11f6b62 (Initial Commit)"
   commit id: "4598dca (Drive Arch)"
   commit id: "7c5e77f (Email Typo Fix)"
   commit id: "30b3460 (Switch to Cloudflare D1)"
   commit id: "4f2ad46 (1-Click & Fallback Passwords)"
   commit id: "70d366e (Platform Admin Plane)"
   commit id: "cecda6a (HEAD -> main)"
   branch dev
   checkout dev
   commit id: "a2af80c (Supabase Auth Decision)"
   commit id: "79f4889 (FastAPI + React Vite)"
   commit id: "1b7d1b3 (Partial Security Hardening)"
   commit id: "c87297d (Supabase Key Committed)"
   commit id: "577dc39 (Razorpay & Cashfree)"
   commit id: "96d3e0d (HEAD -> origin/dev)"
```

### 2.2 Branch Comparison: `main` vs `origin/dev`

| Metric / Dimension | Production Branch (`main`) | Development Branch (`dev`) | Risk / Divergence Impact |
| :--- | :--- | :--- | :--- |
| **Commit Position** | Commit `cecda6a` (Sep 4, 2026) | Commit `96d3e0d` (Sep 5, 2026) | **`dev` is 35 commits ahead** |
| **Backend Stack** | Raw Cloudflare Workers (`worker.js`) | FastAPI (Python 3.11) + Workers Edge Bridge | Disjointed architecture |
| **Frontend Stack** | Single-file bundled Vanilla JS/HTML | React 18, Vite, TypeScript, Tailwind CSS | High code redundancy |
| **Security State** | **CRITICAL (Active Backdoors)** | Moderate (Partial patches, but leaked secrets) | Production runs vulnerable code |
| **Authentication** | Custom D1/KV session with backdoors | Supabase Auth (ES256 JWKS) + D1 linking | Auth model mismatch |

### 2.3 Committer Identity Audit

All 103 commits were authored by a single entity under two distinct email signatures:
1. `Zolexora <abhishekofficial4577@gmail.com>` — 102 Commits
2. `Zolexora <aboishekofficial4577@gmail.com>` — 1 Commit (Typo introduced in commit `11f6b62`, corrected in `7c5e77f`)

---

## 3. Forensic Secrets & Leakage Audit Across Git History

The following table catalogs every sensitive token, secret, credential, and internal resource identifier discovered across all git commits and diffs:

| Category | Discovered Secret / Identifier | Commit(s) & Location | Exposure Status & Risk |
| :--- | :--- | :--- | :--- |
| **Supabase Project URL** | `https://mssyyuipnswzuwhwbudm.supabase.co` | Commit [`c87297d`](https://github.com/Zolexora/Zolexora_IMS/commit/c87297d)<br>`apps/ims-user/frontend/src/lib/supabase.ts` | **Active in git history**<br>Allows public enumeration of Supabase project. |
| **Supabase Anon API Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zc3l5dWlwbnN3enV3aHdidWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTIzNzUsImV4cCI6MjA5NjIyODM3NX0.3zQUIAn-FCCPp50nFe8eP0qaaTZ7V5zHcUHO-9GEiEw` | Commit [`c87297d`](https://github.com/Zolexora/Zolexora_IMS/commit/c87297d)<br>`apps/ims-user/frontend/src/lib/supabase.ts` | **Active in git history**<br>Permits unauthenticated requests to Supabase PostgREST endpoints. |
| **Cloudflare D1 Database ID** | `63b1b80b-ee96-4948-acce-c96d6ac65f61`<br>(Database: `zolexora-ims-1-db`) | Committed in [`wrangler.toml`](file:///workspaces/Zolexora_IMS/apps/ims-user/wrangler.toml) across `main` & `dev` | Publicly exposes internal database UUID. |
| **Cloudflare KV Namespace ID** | `96c2aa5eace04fe0aa2bbafd29de9f76`<br>(Binding: `SESSION_KV`) | Committed in [`wrangler.toml`](file:///workspaces/Zolexora_IMS/apps/ims-user/wrangler.toml) across `main` & `dev` | Exposes session storage namespace ID. |
| **Google Apps Script Exec URL** | `https://script.google.com/macros/s/AKfycbyQpkaxpQrmcDyFtROLp4PNRGVxTFpBzg7KkNBiqPOxSOtxijB8VUarYIpTuprSB7f3/exec` | Committed in [`apps/ims-user/wrangler.toml:L25`](file:///workspaces/Zolexora_IMS/apps/ims-user/wrangler.toml#L25) | Legacy webhook endpoint executable as `USER_DEPLOYING`. |
| **Google Script ID** | `1h2e7sUD_v-BbhxLJJM1A8eKH8y7k5Pe8ew_al_N0vJyZ-A7DId2af2Bt` | Deleted in commit `d6990ad`<br>`legacy/google-apps-script/.clasp.json` | Exposes Apps Script deployment identity. |
| **Google Drive Database Folders** | Root: `1lkSx36mqaqnF8gfqNswdSPb0zqY4lvOx`<br>Hotel: `1rI5Oj3ZoxqRYdw_eX7pkVrMf-Rlw_BpL` | Deleted in commit `d6990ad`<br>`legacy/google-apps-script/server/Setup.js` | Discloses Drive database folder structure. |
| **Universal Hardcoded Passwords** | `Admin@123`, `Zolexora@2026`, `admin123`, `Password@123` | Multiple commits (`4f2ad46`, `70d366e`, `7c5e77f`) | Allows universal unauthorized login to any account. |
| **Static Cryptographic Salt** | `_zolexora_salt_2026` | Committed in [`apps/ims-admin/worker.js:L840`](file:///workspaces/Zolexora_IMS/apps/ims-admin/worker.js#L840) | Weakens SHA-256 hashes against rainbow tables. |
| **Developer PII & Emails** | `abhishekofficial4577@gmail.com`<br>`aeroma7701@gmail.com`<br>Abhishek Sharma | Committed across git author logs and source files | Publicly associates personal identities with codebase. |

---

## 4. In-Depth Code Vulnerability Audit (`main` vs `dev`)

### 4.1 Vulnerabilities Active on `origin/main` (Production Codebase)

1. **Hardcoded Master Backdoors:**
   - [`apps/ims-admin/worker.js:L100`](file:///workspaces/Zolexora_IMS/apps/ims-admin/worker.js#L100): `if (!session && !url.searchParams.has('devBypass'))` — appending `?devBypass` completely skips SuperAdmin session validation.
   - [`apps/ims-admin/worker.js:L286-296`](file:///workspaces/Zolexora_IMS/apps/ims-admin/worker.js#L286-L296): Setting header `X-Dev-Bypass: true` automatically creates a root SuperAdmin identity (`DEV_SUPERADMIN`).
   - [`apps/ims-admin/worker.js:L308-318`](file:///workspaces/Zolexora_IMS/apps/ims-admin/worker.js#L308-L318): Any token starting with `adm_` is blindly accepted as `SUPERADMIN_ROOT`.
2. **Unrestricted Remote SQL Execution:**
   - [`apps/ims-admin/worker.js:L144-147`](file:///workspaces/Zolexora_IMS/apps/ims-admin/worker.js#L144-L147): Endpoint `POST /api/platform/database/query` runs raw SQL queries against Cloudflare D1. The security filter only checks for `DROP DATABASE` (a syntax error in SQLite anyway), leaving `DROP TABLE`, `DELETE FROM`, and data exfiltration wide open.
3. **Unauthenticated Universal RPC Bridge:**
   - [`apps/ims-user/worker.js:L115-308`](file:///workspaces/Zolexora_IMS/apps/ims-user/worker.js#L115-L308): All `/api/rpc/*` actions (`saveProduct`, `deleteProduct`, `saveUser`, `deleteUser`, `createOrganization`, `processSupplierPurchase`, `recordSellingPointSale`) are exposed without session validation.
4. **Arbitrary Session Forgery:**
   - [`apps/ims-user/worker.js:L1628-1645`](file:///workspaces/Zolexora_IMS/apps/ims-user/worker.js#L1628-L1645): Public `POST /api/session` allows unauthenticated clients to inject any user payload into `SESSION_KV` and receive a valid session cookie.
5. **Multi-Tenancy Isolation Failure:**
   - [`apps/ims-user/worker.js:L397-409`](file:///workspaces/Zolexora_IMS/apps/ims-user/worker.js#L397-L409) and [`L980-1180`](file:///workspaces/Zolexora_IMS/apps/ims-user/worker.js#L980-L1180): Queries lack `WHERE org_id = ?` filtering, and mutation queries hardcode `org_id = 'ORG_ZOLEXORA_001'`.

### 4.2 Vulnerabilities on `origin/dev`

Although commit `1b7d1b3` removed `?devBypass`, `X-Dev-Bypass`, and fallback passwords from `worker.js` on `dev`:
1. **Leaked Supabase Anon Key**: Hardcoded in `apps/ims-user/frontend/src/lib/supabase.ts`.
2. **Unauthenticated RPC Bridge Remains**: `/api/rpc/*` in `apps/ims-user/worker.js` still has no session validation.
3. **Insecure CORS Origin Reflection**: Dynamic reflection of incoming origins with credentials enabled persists across both workers.

---

## 5. CI/CD & GitHub Actions Audit

### 5.1 Workflow Review (`.github/workflows/ci.yml`)

The repository contains an active workflow named `CI` (ID: `350876998`):
```yaml
name: CI
on:
  push:
    branches: [main, upgrade/*]
  pull_request:
    branches: [main]
```

#### Key Findings:
- **Branch Trigger Mismatch:** The CI workflow triggers on `main` and `upgrade/*`, but active development occurred directly on `dev`. Pushes to `dev` do not trigger this workflow automatically unless configured.
- **Dependency Isolation:** Backend tests run against `apps/ims-user/backend/requirements.txt`.
- **Secrets in CI:** The workflow does not inject hardcoded secret tokens in environment steps, utilizing runner defaults.

---

## 6. Actionable Remediation & Git Sanitation Playbook

```mermaid
flowchart TD
    A[Git History Sanitation] -->|BFG / git-filter-repo| B(Scrub Supabase Keys, Passwords, Emails)
    C[Branch Alignment] -->|Merge / Rebase| D(Promote dev hardening to main)
    E[Cloudflare & Supabase Secrets] -->|Dashboard Action| F(Rotate Supabase Anon Key & KV Namespace)
    G[Worker Patching] -->|Code Fix| H(Enforce Session on /api/rpc and restrict CORS)
```

### Step 1: Scrub Sensitive Data from Git History
Because git preserves all historical commits, simply deleting a file in a new commit does **not** remove it from the repository history.

Use `git-filter-repo` to permanently purge sensitive strings:
```bash
# Install git-filter-repo
pip install git-filter-repo

# Create replace-expressions file
cat << 'EOF' > expressions.txt
regex:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+==>REDACTED_SUPABASE_KEY
regex:AKfycb[a-zA-Z0-9_\-]{20,}==>REDACTED_APPS_SCRIPT_URL
1lkSx36mqaqnF8gfqNswdSPb0zqY4lvOx==>REDACTED_DRIVE_FOLDER
abhishekofficial4577@gmail.com==>admin@zolexora.com
EOF

git-filter-repo --replace-text expressions.txt --force
```

### Step 2: Rotate Exposed Credentials
1. **Supabase:** Go to Supabase Dashboard > Settings > API > Rotate JWT Secret and regenerate the `anon` key.
2. **Cloudflare:** If production credentials were ever shared outside trusted environments, cycle the Cloudflare API tokens associated with D1 and KV.
3. **Users Table:** Update all database user password hashes using a secure hashing algorithm (PBKDF2 or Argon2) with a unique per-user salt.

### Step 3: Reconcile `main` and `dev` Branches
1. Review changes between `origin/main` and `origin/dev`:
   ```bash
   git log origin/main..origin/dev --oneline
   ```
2. Merge the hardened code from `dev` into `main` after verifying build and tests:
   ```bash
   git checkout main
   git merge origin/dev
   ```
3. Deploy the unified, hardened edge workers to Cloudflare:
   ```bash
   npm run deploy:all
   ```

### Step 4: Lock Down Edge API Endpoints
- In [`apps/ims-user/worker.js`](file:///workspaces/Zolexora_IMS/apps/ims-user/worker.js), insert authentication middleware before `handleD1Rpc` and `handleRestApi`:
  ```javascript
  const session = await getSession(request, env);
  if (!session) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
  }
  ```
- Remove `/api/platform/database/query` or place it behind Cloudflare Access Zero Trust authentication.
