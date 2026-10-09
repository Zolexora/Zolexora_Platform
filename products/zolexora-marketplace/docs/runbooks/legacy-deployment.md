# Zolexora Deployment

## Target architecture

- Frontend stays on Vercel.
- FastAPI backend runs on Northflank Sandbox first. Oracle Cloud Free VM is the fallback if the sandbox is too small.
- Cloudflare manages DNS/security for the root domain and `api.zolexora.com`.

```txt
zolexora.com            -> Vercel
seller.zolexora.com     -> Vercel
admin.zolexora.com      -> Vercel
api.zolexora.com        -> FastAPI backend host
```

## Backend on Northflank

Create a service from this repository with:

- Root directory: `backend`
- Build type: Dockerfile
- Dockerfile: `services/marketplace-api/Dockerfile`
- Port: `4100`
- Health check path: `/api/health`

Set these required environment variables:

```txt
MONGO_URL
DB_NAME
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DATABASE_URL
REDIS_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_IDS
RESEND_API_KEY
SENDER_EMAIL
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
UPI_ID
UPI_MERCHANT_NAME
CORS_ORIGINS
BUYER_URL
SELLER_URL
ADMIN_URL
```

Use these production values:

```txt
CORS_ORIGINS=https://zolexora.com,https://www.zolexora.com,https://seller.zolexora.com,https://admin.zolexora.com
BUYER_URL=https://zolexora.com
SELLER_URL=https://seller.zolexora.com
ADMIN_URL=https://admin.zolexora.com
```

After deploy, verify:

```txt
https://<northflank-service-domain>/api/health
```

## Cloudflare DNS

Keep the Vercel DNS records exactly as Vercel requires for your frontend domains.

Add the backend subdomain:

```txt
Type: CNAME
Name: api
Target: <northflank-service-domain>
Proxy: Proxied
SSL/TLS mode: Full
```

Then verify:

```txt
https://api--zolexora-api--4m8d68ky29h8.code.run/api/health
```

Do not create Cloudflare cache rules for authenticated API routes. Auth, cart,
orders, payments, admin, and shipping routes must stay dynamic.

## Vercel frontend env

Set this in every Vercel frontend project:

```txt
NEXT_PUBLIC_API_URL=https://api--zolexora-api--4m8d68ky29h8.code.run/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your Google OAuth client id>
```

Redeploy the Vercel projects after changing env vars.

## Supabase Auth setup

In Supabase Auth:

- Enable email/password provider.
- Enable Google provider.
- Add the same Google OAuth client used by the web apps.
- Add redirect URLs:
  - `https://zolexora.com/auth/reset-password`
  - `https://seller.zolexora.com/auth/reset-password`
  - local dev URLs if needed.

Run `services/marketplace-api/scripts/supabase_schema_v2.sql` for a fresh development database.

For an existing development database, read `services/marketplace-api/scripts/supabase_auth_migration.sql`
before dropping the old credential table. Existing users must be reconciled with
Supabase Auth user IDs.
