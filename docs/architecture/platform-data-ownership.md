# Platform Data Ownership

**Date:** 2026-10-08

## The Principle
To prevent a monolithic, coupled database architecture, we establish clear ownership boundaries between Platform and Products.

## Decisions
1. **Platform Identity vs. Product Users:**
   * **Platform** (Authentication Providers like Supabase/Firebase) owns the *cryptographic identity* (email, password hash, phone, SSO links, tokens).
   * **Products** (RentoEasy, Marketplace, ERP) own the *business user* (`Tenant`, `Owner`, `Buyer`, `Employee`). 
   * **Linkage:** Products store the `identity_id` (e.g., Firebase UID) as a foreign reference. Products DO NOT store passwords.

2. **Authorization Rules:**
   * **Platform** owns broad entitlements (e.g., "User has access to RentoEasy").
   * **Products** own fine-grained business logic (e.g., "User is an Owner of Property 123").

3. **Organizations/Tenants:**
   * B2B organization logic heavily resides in `ZolexoraTMS` and `ZolexoraERP`. Currently, each owns its own DB tables. Do not create a shared database until a unified Platform Organization Registry is explicitly requested.
