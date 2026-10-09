# Zolexora IMS — Cloudflare Worker & Edge Session Cache

This directory contains the Cloudflare Worker reverse proxy configuration for **`ims.zolexora.com`**, featuring **sub-millisecond edge-cached session storage** via Cloudflare Workers KV (`SESSION_KV`).

---

## 🚀 Features

1. **Edge Session Storage (`SESSION_KV`)**:
   - Stores authenticated user session records in globally distributed Cloudflare Workers KV.
   - Sub-millisecond reads from Cloudflare's nearest edge data center.
   - Built-in TTL expiration (default: 7 days / 604,800s).
   - Multi-channel session resolution: `Cookie: zolexora_session=<id>`, `Authorization: Bearer <id>`, `x-session-id: <id>`, or `?sessionId=<id>`.

2. **Upstream Request Enrichment**:
   - Downstream requests to the Google Apps Script backend are enriched with edge-verified headers:
     - `x-edge-auth`: `'1'` when session is valid.
     - `x-edge-session-id`: Unique session identifier.
     - `x-edge-user-id`: User ID (`USR_...`).
     - `x-edge-user-email`: User's authenticated email.
     - `x-edge-user-role`: User's permission role (`Admin`, `Manager`, `Staff`, etc.).
     - `x-edge-user-scope`: Scope type (`ALL`, `STORE`, or `SELLING_POINT`).
     - `x-edge-user-location`: Assigned store/selling point ID (e.g. `SP_1`, `S_MAIN`).
     - `x-edge-session-cache`: `HIT`, `MISS`, or `NONE`.

3. **CORS & Security Header Management**:
   - Strips `X-Frame-Options` so Apps Script can be embedded smoothly.
   - Automatically injects permissive CORS and `Permissions-Policy` headers.

---

## 🛠️ Setup Instructions (KV Namespace Provisioning)

### Step 1: Log in to Wrangler (if not already logged in)
```bash
npx wrangler login
```

### Step 2: Create the KV Namespace for Production & Preview
Run the following commands to generate the KV namespaces in your Cloudflare account:

```bash
# Production KV namespace
npx wrangler kv namespace create SESSION_KV

# Preview KV namespace (for local wrangler dev)
npx wrangler kv namespace create SESSION_KV --preview
```

Each command outputs a snippet like:
```toml
[[kv_namespaces]]
binding = "SESSION_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Step 3: Update `wrangler.toml`
Paste the generated IDs into `cloudflare/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSION_KV"
id = "<your-production-kv-id>"
preview_id = "<your-preview-kv-id>"
```

### Step 4: Deploy the Worker
Deploy the worker to your Cloudflare custom domain:

```bash
cd cloudflare
npx wrangler deploy
```

---

## 📡 Edge Session API Endpoints

### 1. Health Check
```http
GET /api/session/health
```
**Response:**
```json
{
  "status": "healthy",
  "service": "zolexora-edge-session-store",
  "kvConfigured": true,
  "edgeLocation": "DUB",
  "timestamp": "2026-09-04T15:20:00.000Z"
}
```

### 2. Store / Create Session
```http
POST /api/session
Content-Type: application/json

{
  "sessionId": "sess_optional_custom_id",
  "ttl": 604800,
  "user": {
    "id": "USR_1001",
    "email": "staff@zolexora.com",
    "name": "Alex Smith",
    "role": "Staff",
    "assignedLocation": "SP_1",
    "scopeType": "SELLING_POINT",
    "locationName": "Selling Point 1"
  }
}
```
**Response:**
```json
{
  "success": true,
  "cached": true,
  "message": "Session stored in edge KV successfully.",
  "sessionId": "sess_b93d4fa1...",
  "user": { ... },
  "expiresAt": "2026-09-11T15:20:00.000Z"
}
```
*Also sets `Set-Cookie: zolexora_session=sess_...; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`.*

### 3. Get Session
```http
GET /api/session
Cookie: zolexora_session=sess_b93d4fa1...
```
*(Or header `Authorization: Bearer sess_b93d4fa1...`)*

**Response:**
```json
{
  "success": true,
  "cached": true,
  "sessionId": "sess_b93d4fa1...",
  "user": {
    "id": "USR_1001",
    "email": "staff@zolexora.com",
    "role": "Staff",
    "scopeType": "SELLING_POINT",
    "assignedLocation": "SP_1"
  },
  "scope": "SELLING_POINT",
  "assignedLocation": "SP_1",
  "expiresAt": "2026-09-11T15:20:00.000Z",
  "edgeLocation": "LHR"
}
```

### 4. Invalidate / Logout Session
```http
DELETE /api/session
Cookie: zolexora_session=sess_b93d4fa1...
```
**Response:**
```json
{
  "success": true,
  "message": "Session invalidated and removed from edge KV."
}
```
*Clears the `zolexora_session` cookie immediately.*
