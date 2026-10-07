# Platform Authentication & Security Analysis

**Date:** 2026-10-08
**Status:** DISCOVERY COMPLETE

## 1. Overview of Implementations
The final codebase reorganization revealed that four distinct products independently implement Authentication and Identity logic:
1. `products/TheTextileCare/` (FastAPI + JWT + Supabase Auth references)
2. `products/RentoEasy/` (NestJS + Custom JWT + Google/Email Auth)
3. `products/ZolexoraMarketplace/` (FastAPI + Firebase Auth + Custom Postgres sync)
4. `products/ZolexoraTMS/` (FastAPI + Supabase Auth)

## 2. Comparison Matrix

| Capability | TheTextileCare | RentoEasy | ZolexoraMarketplace | ZolexoraTMS |
|------------|----------------|-----------|---------------------|-------------|
| **Provider** | Custom JWT / Supabase | Custom JWT / Google | Firebase Auth | Supabase Auth |
| **Language** | Python (FastAPI) | TypeScript (NestJS) | Python (FastAPI) | Python (FastAPI) |
| **Models** | `Tenant`, `Owner`, `User` | `Tenant`, `Owner`, `User` | `User` / `Buyer` | `User` / `Employee` |
| **Tokens** | Bearer JWT | `AuthTokens` (Access/Refresh)| Bearer JWT (Firebase) | Bearer JWT (Supabase) |
| **Storage** | Postgres | Postgres | Postgres | Postgres / Redis |

## 3. Analysis

### Common Elements
* All products rely on Bearer JWTs passed in the `Authorization` header.
* All products maintain a mirrored "Identity" table in their local product databases to store profile metadata associated with the external Auth ID.

### Incompatible Elements
* **Providers:** Marketplace is strictly tied to Firebase. TMS relies entirely on Supabase. RentoEasy manages its own JWTs using Passport.js/NestJS.
* **Environments:** RentoEasy is Node.js-based, while the others are Python-based.
* **User Domain:** RentoEasy and TheTextileCare use a `Tenant`/`Owner` model. TMS uses a corporate/employee model. Marketplace uses a `Buyer`/`Seller` model.

## 4. Decision: DO NOT FORCE IMPLEMENTATION UNIFICATION
As per architectural rules, we **MUST NOT** force a single authentication implementation right now. Forcing TMS to use Firebase or Marketplace to use Supabase would require massive product rewrites. 

### Recommended Abstraction
Instead of a shared auth library, we should extract a **Shared API Contract** for identity resolution.
`platform/identity-contracts` can define standard headers, token structures, and generic identity schemas (`AuthTokens`, `PlatformUser`), which product-specific adapters will translate.
