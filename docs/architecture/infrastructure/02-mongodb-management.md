# MongoDB Atlas Infrastructure Strategy

## The Challenge
Managing document databases across 10+ products requires a balance between data isolation, connection limits, and query performance.

## Big Tech Solutions for Scale

### 1. Multi-Tenancy Models
Unlike Postgres RLS, MongoDB handles multi-tenancy differently:
- **Database per Tenant/Product:** Within a single MongoDB Atlas Cluster, create separate Databases (e.g., `db_erp`, `db_marketplace`). This provides excellent isolation without the cost of running multiple clusters.
- **Collection per Tenant:** Not recommended at scale as it clutters the namespace.
- **Shared Collection with Tenant ID:** Best for massive scale. Add a `tenantId` field to every document and enforce it at the application layer (using Mongoose/Prisma middleware to automatically append it to queries).

### 2. Connection Pooling & Serverless
- Native MongoDB drivers hold persistent TCP connections. In serverless environments (like Next.js API routes or Cloudflare Workers), this leads to connection exhaustion.
- **Solution:** Use the **MongoDB Atlas Data API** (HTTP-based) for serverless edge functions, or ensure your backend (like FastAPI/NestJS) maintains a long-lived connection pool.

### 3. Networking & Security
- Use **VPC Peering** or **AWS PrivateLink** to connect your backend clusters directly to MongoDB Atlas, bypassing the public internet entirely.
- Restrict Atlas API keys using strictly scoped IAM roles.
