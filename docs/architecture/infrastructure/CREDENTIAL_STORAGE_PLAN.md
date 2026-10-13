# Infisical Credential Storage & Dynamic Account Routing Plan

## 1. Objective

This plan details the exact structure, naming convention, and security practices for storing and rotating credentials in **Infisical**. It supports an **unfixed, dynamic number of accounts** that can be connected or disconnected in real time without code modifications or application redeployments.

---

## 2. Infisical Workspace Hierarchy

In the Infisical Project (`zolexora-platform`), organize secrets into three environments: `dev`, `staging`, `prod`.

```text
zolexora-platform (Infisical Project)
├── /shared/                           ← Global platform-wide shared services
│   ├── /firebase-pool/                ← Dynamic multi-account Firebase pool
│   └── /database-pool/                ← Clustered PostgreSQL / Supabase URLs
├── /platform-admin/                   ← Superadmin credentials & cluster registry
├── /zolexora-tms/                      ← TMS-specific production variables
├── /zolexora-ims/                      ← IMS-specific production variables
├── /zolexora-marketplace/              ← Marketplace-specific production variables
├── /zolexora-erp/                      ← ERPNext Frappe credentials
├── /zolexora-engage/                   ← Customer CRM & live chat
├── /clarity-fi/                        ← Fintech & accounting
├── /maun-kavach/                       ← Emergency response services
├── /rento-easy/                        ← Rental operations
├── /the-textile-care/                  ← Laundry & garment care
└── /zolexora-ai/                       ← AI agents & LLM API keys
```

---

## 3. Dynamic Multi-Account Naming Convention (No Fixed Limit)

To allow accounts to be added, rotated, or disconnected dynamically without changing any code:

### 3.1 The Account Index Manifest
Under `/shared/firebase-pool/`:
```env
# Comma-separated list of active account slugs
FIREBASE_ACTIVE_ACCOUNTS="tms-prod,ims-prod,mkt-prod,erp-prod,vault-tms,vault-mkt"
```

### 3.2 Dynamic Account Credential Block
For each account slug defined in `FIREBASE_ACTIVE_ACCOUNTS`:
```env
# Account: tms-prod
FIREBASE_ACCOUNT_TMS_PROD_PROJECT_ID="zx-tms-prod"
FIREBASE_ACCOUNT_TMS_PROD_API_KEY="AIzaSyA..."
FIREBASE_ACCOUNT_TMS_PROD_AUTH_DOMAIN="zx-tms-prod.firebaseapp.com"
FIREBASE_ACCOUNT_TMS_PROD_STORAGE_BUCKET="zx-vault-tms.appspot.com"
FIREBASE_ACCOUNT_TMS_PROD_STATUS="ACTIVE"   # Options: ACTIVE | DRAINING | DISCONNECTED

# Account: mkt-prod
FIREBASE_ACCOUNT_MKT_PROD_PROJECT_ID="zx-mkt-prod"
FIREBASE_ACCOUNT_MKT_PROD_API_KEY="AIzaSyB..."
FIREBASE_ACCOUNT_MKT_PROD_AUTH_DOMAIN="zx-mkt-prod.firebaseapp.com"
FIREBASE_ACCOUNT_MKT_PROD_STORAGE_BUCKET="zx-vault-mkt.appspot.com"
FIREBASE_ACCOUNT_MKT_PROD_STATUS="ACTIVE"
```

### 3.3 Adding or Disconnecting an Account Live
* **To add account N+1:**
  1. Add credentials: `FIREBASE_ACCOUNT_NEW_SLUG_PROJECT_ID=...`
  2. Append `new-slug` to `FIREBASE_ACTIVE_ACCOUNTS`.
  3. The Router automatically discovers it during the next 30-second polling cycle.
* **To disconnect an account:**
  1. Change `FIREBASE_ACCOUNT_<SLUG>_STATUS="DISCONNECTED"` or remove from `FIREBASE_ACTIVE_ACCOUNTS`.
  2. The Router gracefully stops directing new logins to this project.

---

## 4. Internal Database & Core Platform Credentials

Stored in `/shared` and referenced by the Admin Control Plane:

| Secret Key | Purpose | Required For |
| :--- | :--- | :--- |
| `ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL` | Primary internal authentication & Supabase database connection string | Central user directory & superadmin role resolution |
| `ZOLEXORA_PRODUCTION_RESEND_API_KEY` | Transactional email delivery API key | Reset passwords, verification OTPs |
| `CLOUDFLARE_API_SHIELD_TOKEN` | Cloudflare Worker edge proxy authentication | API DDoS & rate-limiting shield |
| `NOTIFY_WEBHOOK_URL` | Discord / Telegram alerting webhook | High-priority downtime alerts & missing secret warnings |

---

## 5. Missing Credential Diagnostic Protocol

If a product backend or the Platform Admin boots up and a required secret is absent:

1. **Terminal & Log Output:**
   ```text
   [CRITICAL] [INFISICAL_CONFIG_ERROR]
   Missing required secret: ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL
   Path: /shared/ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL
   Action Required: Please add this variable in Infisical (https://app.infisical.com) or set it in your local environment.
   ```
2. **Notification Broadcast:**
   Sends an alert payload to `NOTIFY_WEBHOOK_URL` so the DevOps team is alerted before users notice an outage.
3. **Graceful Fallback:**
   The service enters a `CONFIGURATION_DEGRADED` state and refuses unauthorized requests rather than crashing with unhandled exceptions.

---

## 6. How Secrets Are Injected into Runtimes

* **Local Development:**
  ```bash
  infisical run --env=dev -- npm run dev
  ```
* **Production Docker Containers:**
  In `compose.yaml`:
  ```yaml
  environment:
    - INFISICAL_TOKEN=${INFISICAL_MACHINE_TOKEN}
  command: ["infisical", "run", "--env=prod", "--", "uvicorn", "app.main:app"]
  ```
* **GitHub Actions CI/CD:**
  Automated via `.github/workflows/reusable-infisical-secrets.yml` using `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`.
