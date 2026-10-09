# Cloudflare D1 & R2 Infrastructure Strategy

## The Challenge
Operating at the edge requires fundamentally different data patterns than traditional centralized databases and S3 buckets.

## Cloudflare D1 (Serverless SQLite)
Cloudflare D1 runs SQLite databases distributed at the edge.
- **Database Sprawl is Okay:** Unlike Postgres, D1 is incredibly cheap and designed for you to have hundreds or thousands of databases. You *can* provision a separate D1 database for every single product or even every single customer.
- **Migrations:** Use `wrangler d1 migrations apply` integrated into your GitHub Actions to manage schema changes across all D1 databases simultaneously.
- **Use Case:** Perfect for read-heavy, geographically distributed data (like product catalogs or edge configurations), but less suited for heavy transactional writes compared to Supabase.

## Cloudflare R2 (Object Storage)
R2 is an S3-compatible object store with zero egress fees.
- **Bucket Architecture:** Create separate buckets per environment and product (e.g., `zolexora-erp-prod`, `zolexora-marketplace-dev`).
- **CDN Integration:** Always map R2 buckets to a custom domain (e.g., `assets.zolexora.com`) to utilize Cloudflare's global CDN caching automatically.
- **Security:** Never expose R2 API keys to the frontend. Use your backend (FastAPI/Next.js) to generate **Pre-signed URLs** for temporary, secure uploads/downloads.
