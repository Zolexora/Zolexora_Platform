# 4. One identity: user profile, organisation profile, employees and KYC in the auth service

Date: 2026-11-05

## Status
Proposed

## Context

Every product kept its own copy of the same things:

- **Organisations:** TMS `organisation`, marketplace `seller_organization`.
- **User profiles:** the marketplace `users`/`user_profile`.
- **Team members:** TMS memberships, marketplace `seller_org_member`.
- **KYC:** the marketplace's own PAN, GST and bank checks (`seller_kyc`, GST lookup).

The same business had to be entered, verified and kept up to date once per product.

The auth service ([apps/zolexora-auth-service](../../../apps/zolexora-auth-service)) already owns sign-in for all three tracks, plus `zolexora_organizations` (ZX-ORG), employee memberships and KYC document storage. Today it holds only names and statuses.

## Decision

The auth service is the single owner of **who** someone is and **which business** they act for. Products own only what they do for that business.

### 1. One user profile
- The profile lives on `zolexora_auth_users`: name, avatar, email, phone, verified flags and addresses.
- `GET /api/v1/me/profile` reads it and `PATCH /api/v1/me/profile` updates it, from any app.
- Products read it through `/auth/me` and introspection and keep no copy, only a local id for their foreign keys.

### 2. One organisation profile
- `zolexora_organizations` gains:
  - Identity: `owner_user_id` (a Track 1 user), `legal_name`, `trade_name` and `organisation_type` (the TMS list).
  - Contact: `email`, `phone`, registered `address` and `logo_url`.
- Endpoints, usable from any app:
  - `POST /api/v1/organizations`: a Track 1 user creates an organisation and becomes its owner, with a ZX-ORG id.
  - `GET /api/v1/me/organizations`: the organisations the caller owns or belongs to.
  - `GET` and `PATCH /api/v1/organizations/{org}`: owners and admins edit; members read.
- An edit made in TMS shows up in the marketplace, and the other way round.

### 3. One employee (team) management
- Members are owners (Track 1 users), plus employees signing in with ZX-ORG id and password (Track 2, the existing memberships).
- `GET`, `POST`, `PATCH` and `DELETE /api/v1/organizations/{org}/members` cover invite or create, set role, suspend and remove.
- Roles are owner, admin, manager or member. Only an owner makes or removes an owner.
- Products may add their own permissions per member, keyed by the auth-service member id; the people themselves stay in the auth service.

### 4. KYC and verification
- `zolexora_org_kyc` holds PAN, GSTIN and the bank account (holder, number, IFSC), encrypted with a key that only the auth service holds.
  - Documents use the existing KYC upload (`zolexora_kyc_documents`).
  - Members see only the last four digits.
- Each check has its own status: `pan`, `gst`, `bank`, `documents`. A status is `not_submitted`, `pending`, `verified`, `rejected` or `needs_revision`, and comes with the time and who verified it.
- GST and PAN lookups use a provider (ClearTax) inside the auth service. Platform admins approve or reject in platform-admin.
- `GET /api/v1/organizations/{org}/verification` returns `{pan, gst, bank, documents, overall}` with no secrets.

### 5. How products use it
- The token and introspection carry `org_id` (ZX-ORG). Products call the auth service for profile and verification status, and cache it briefly, as introspection already does.
- A product's local organisation row becomes a link to `zolexora_org_id` plus only that product's own data:
  - Marketplace: storefront grants, listings, orders, payouts.
  - TMS: product settings.
- A product decides what it requires. For example, the marketplace sells only when `overall = verified`; TMS might need nothing.

## Consequences

- ✅ A business is entered and verified once, and the same profile appears everywhere.
- ✅ PAN, GST and bank numbers live in one service with one key.
- ⚠️ The marketplace removes its own copies: `seller_kyc`, `SELLER_KYC_ENCRYPTION_KEY`, the GST lookup and ClearTax keys, the profile copy, `seller_org_member` and the verification form. `seller_organization` becomes a link.
- ⚠️ TMS follows the same way after the marketplace.
- ⚠️ Every product depends on the auth service for profile and verification reads, so those reads are cached and degrade gracefully.

## Order of work

1. **Auth service:**
   - Schema: profile and organisation columns, `owner_user_id`, `zolexora_org_kyc` and verification statuses.
   - The APIs above, with tests.
   - Platform-admin review screens.
2. **Marketplace:**
   - Read organisation, profile and verification from the auth service.
   - Seller portal screens call the auth-service APIs.
   - Drop the local copies.
3. **TMS:** the same as the marketplace.

## Open questions

1. **Existing organisations:** are existing marketplace or TMS organisations created in the auth service, or does everyone start fresh, as with "no need to copy old"?
2. **Verification provider:** is ClearTax confirmed, or is verification manual (admin review only) at first?
3. **Required checks:** are PAN and GST mandatory for every organisation type (sole proprietors without GST, for example)?
