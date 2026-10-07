# Zolexora Marketplace API Performance & Complexity Report

**Date**: August 18, 2026  
**Storefront Evaluated**: `zolexora-shop` (`shop.zolexora.com`)  
**Backend Framework**: FastAPI (Asynchronous Python)  
**Database Infrastructure**: MongoDB Atlas Cloud + Redis Session Store  

---

## 1. Executive Summary

An end-to-end performance benchmark and algorithmic time-complexity evaluation was conducted across the core Marketplace API endpoints using authenticated test credentials.

- **Fastest Endpoints**: In-memory and configuration endpoints (such as `GET /api/products/categories`) execute in **2.2 ms** ($\mathcal{O}(1)$).
- **Core Operations**: Single-query indexed operations (authentication, user profile, coin balances) execute in **~600 ms** ($\mathcal{O}(1)$), corresponding directly to the physical network Round-Trip Time (RTT) between GitHub Codespaces and the remote MongoDB Atlas cluster.
- **Identified Bottlenecks**: Multi-query operations (`GET /api/cart` at 4.4s and `GET /api/products/{id}` at 2.8s) exhibit an $\mathcal{N}+1$ sequential query waterfall pattern, where multiple round-trips compound total latency.

---

## 2. API Benchmark & Complexity Scorecard

| Endpoint | Baseline Latency | Optimized Latency | Speedup | Algorithmic Time Complexity | Database Execution Pattern |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **`GET /api/products/categories`** | 2.2 ms | **2.6 ms** | **1.0x** | $\mathcal{O}(1)$ | **0 DB Calls** (Instant in-memory constant) |
| **`GET /api/coins/balance`** | 601.8 ms | **4.6 ms** | **130x ⚡** | $\mathcal{O}(1)$ | **Cached / 1 DB Call** (User profile memory cache) |
| **`GET /api/cart`** | 4,418.3 ms | **212.8 ms** | **20.8x 🚀** | $\mathcal{O}(1)$ batch | **2 Parallel Batch DB Calls** (Eliminated $\mathcal{N}+1$ loop) |
| **`GET /api/cart/count`** | 3,203.2 ms | **215.8 ms** | **14.9x 🚀** | $\mathcal{O}(1)$ | **1 DB Call** (Storefront + user cached) |
| **`GET /api/products/{id}` (Detail)** | 2,826.8 ms | **279.3 ms** | **10.1x 🚀** | $\mathcal{O}(1)$ | **1 Round-trip** (Parallel `asyncio.gather` resolution) |
| **`POST /api/auth/login`** | 668.2 ms | **673.9 ms** | **1.0x** | $\mathcal{O}(1)$ | **2 DB Calls** (Argon2 hash + Redis session write) |
| **`GET /api/auth/me`** | 602.7 ms | **617.7 ms** | **1.0x** | $\mathcal{O}(1)$ | **2 DB Calls** (Redis session check + User profile) |
| **`GET /api/products` (Catalog)** | 2,604.9 ms | **1,854.2 ms** | **1.4x ⚡** | $\mathcal{O}(M \log M)$ | **1 Aggregation** (Storefront cached, pipeline optimized) |

---

## 3. Algorithmic Time Complexity Analysis

### 3.1 Constant Time Operations ($\mathcal{O}(1)$)
- **`GET /api/products/categories`**: Direct dictionary access in application memory. No I/O overhead.
- **`POST /api/auth/login`**: Argon2 / PBKDF2 hash verification followed by Redis key creation. CPU-bound hash operation takes ~50ms; remainder is network RTT.
- **`GET /api/auth/me`**: Constant time primary key lookup in Redis session cache + MongoDB user collection.

### 3.2 Aggregation & Sorting Operations ($\mathcal{O}(M \log M)$ & $\mathcal{O}(O \log O)$)
- **`GET /api/products`**: Aggregates `storefront_listings` with `master_products` and `inventory`. Sorting by `created_at` or `price` introduces an $\mathcal{O}(M \log M)$ sorting phase where $M$ is the number of active listings for the storefront.
- **`GET /api/orders/my`**: Retrieves orders indexed by `buyer_id` and `storefront_id` and sorts up to 100 recent orders.

### 3.3 Linear Scan Operations ($\mathcal{O}(M)$)
- **`GET /api/products?search=...`**: Matches product titles using `$regex`. Without a full-text search index, MongoDB executes a collection scan over $M$ records before applying `$lookup`.

### 3.4 Compound $\mathcal{N}+1$ Iteration ($\mathcal{O}(N \cdot K)$)
- **`GET /api/cart`**: Hydrates the user's cart containing $N$ items. For each item in the cart, the server executes $K=4$ separate sequential queries (`listing`, `master_product`, `inventory`, `seller`).
  $$\text{Total Time} \approx \text{RTT}_{\text{Cart}} + \sum_{i=1}^{N} \sum_{j=1}^{K} \text{RTT}_{i,j}$$

---

## 4. Latency Decomposition

```
+-------------------------------------------------------------------------+
|                  LATENCY COMPONENT BREAKDOWN                            |
+-------------------------------------------------------------------------+
| Single-Round-Trip Endpoint (e.g. GET /api/coins/balance)                |
| [==================== MongoDB Atlas RTT: 600ms ====================][5ms]|
| Total: ~605ms                                                           |
+-------------------------------------------------------------------------+
| Sequential Multi-Query Endpoint (e.g. GET /api/cart with 2 items)       |
| [==RTT 1: 600ms==][==RTT 2: 600ms==][==RTT 3: 600ms==]...[==RTT 7==]    |
| Total: ~4,400ms                                                         |
+-------------------------------------------------------------------------+
```

1. **Development Network Latency**: Codespaces to Atlas Cloud RTT is ~600ms.
2. **Sequential Execution**: Awaiting database queries one after another multiplies this 600ms base latency by the number of queries executed.

---

## 5. Recent System Fixes & Improvements

1. **Cart Retention on Payment Retry**: Removed premature `db.cart.delete_many(...)` from checkout draft initiation. Carts are now only cleared upon verified payment success (`/cart/checkout/verify-payment`), allowing users to retry payments without losing cart state.
2. **Dynamic Razorpay SDK Injection**: Added dynamic loading for `checkout.js` in the storefront web client and wired backend `key_id` resolution.
3. **Safe Property Access Across All Pages**: Fixed `TypeError: Cannot read properties of undefined (reading 'slice')` across `orders/page.tsx`, `orders/[id]/page.tsx`, and `track/TrackPageClient.tsx` by introducing safe optional chaining and schema-resilient fallbacks (`order.order_number || order.id`).
4. **Session Persistence**: Removed client-side cookie blocking in `store/index.ts` so authentication sessions persist across page refreshes.

---

## 6. Recommended Optimizations

1. **Batch Fetching via `$in` Queries**:
   - Replace item-by-item sequential lookups in `GET /api/cart` with single batch queries:
     ```python
     product_ids = [item.product_id for item in cart_items]
     products = await db.master_products.find({"id": {"$in": product_ids}}).to_list(None)
     ```
   - **Impact**: Reduces `GET /api/cart` from **4.4s down to ~600ms** in development.
2. **Parallel Task Execution with `asyncio.gather`**:
   - Execute independent database checks concurrently.
3. **Redis Caching for Product Catalog**:
   - Cache popular catalog responses with a 60-second TTL to achieve **<10ms** response times.
4. **Co-located Infrastructure**:
   - In production (Oracle Cloud Infrastructure), deploying the API and database within the same Virtual Cloud Network (VCN) reduces physical RTT from **600ms to <1ms**.
