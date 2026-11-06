# 4. One identity: user profile, organisation profile, employees and verification in the auth service

Date: 2026-11-05 (decisions recorded 2026-11-06)

## Status
Accepted (2026-11-06).

## Context

Every product kept its own copy of the same things:

- **Organisations:** TMS `organisation`, marketplace `seller_organization`.
- **User profiles:** the marketplace `users`/`user_profile`.
- **Team members:** TMS memberships, marketplace `seller_org_member`.
- **KYC:** the marketplace's own PAN, GST and bank checks (`seller_kyc`, GST lookup).

The same business had to be entered, verified and kept up to date once per product.

The auth service ([apps/zolexora-auth-service](../../../apps/zolexora-auth-service)) already owns sign-in for all three tracks, plus `zolexora_organizations` (ZX-ORG), employee memberships and KYC document storage. Today it holds only names and statuses.

## Decision

The auth service is the single owner of **who** someone is and **which business** they act for. Products own only what they do for that business. Cost target: **₹0 by default**; paid checks are switched on per check only where they are worth it.

### 1. One user profile
- The profile lives on `zolexora_auth_users`: name, avatar, email, phone, verified flags and addresses.
- `GET` and `PATCH /api/v1/me/profile` read and update it, from any app. Email and phone change only through their own verification flows.
- Products read it through `/auth/me` and introspection and keep no copy, only a local id for their foreign keys.

### 2. One organisation profile, typed by its PAN
- There is **no organisation-type dropdown**. The business enters its PAN, and the **4th letter** decides its legal type:

  | 4th letter | Legal type | Follow-up question |
  |---|---|---|
  | P | Individual **or** sole proprietor | "Do you have a business registration (GST, Udyam, shop licence)?" Yes = proprietor, no = individual |
  | C | Company (Pvt, Public, OPC, Section 8) | none |
  | F | Partnership firm **or** LLP | "Do you have an LLPIN?" Yes = LLP, no = partnership firm |
  | H | HUF | none |
  | T | Trust | none |
  | A, B | Society, co-operative, association, body of individuals | none |
  | E | LLP (newer allotments) | none |
  | G, L, J | Government, local authority, other public body | none |

- **PAN is never editable.** A new PAN means a new business.
- **One business per PAN**, except for P (individuals and proprietors may run several businesses on one PAN). A disputed PAN is moved by a platform admin.
- `zolexora_organizations` gains `legal_name`, `trade_name`, `pan_holder_type` (the letter), `business_kind`, the PAN (encrypted, plus last 4 digits and a keyed hash for the uniqueness rule), `email`, `phone`, registered `address`, `logo_url`, and what the business does (below).
- **Creating a business does not wait for verification.** Anyone signed in can create one; products lock risky actions (selling, payouts) until the checks they need are verified.
- **Closing a business** deactivates it: members lose access, data is kept, and nothing is deleted. The owner or a platform admin closes it.
- Endpoints, usable from any app:
  - `POST /api/v1/organizations`: a person creates a business and becomes its owner, with a ZX-ORG id.
  - `GET /api/v1/me/organizations`: the businesses the caller belongs to, with their role in each.
  - `GET` and `PATCH /api/v1/organizations/{org}`: owners and admins edit; members read.
- An edit made in TMS shows up in the marketplace, and the other way round.

### 2a. What the business does
- **Activity groups:** a short list of about 25 groups (Textiles & Apparel, Retail, Logistics & Transport, Healthcare…), held in `zolexora_activity_groups` and **editable in platform-admin**. Groups are hidden, never deleted, so existing businesses keep theirs.
- **Choice:** each business picks **one main group** (shown first, used in reports) plus **up to 4 more**.
- **Official codes:** when GST or Udyam is given, the official activities are saved automatically at no cost: GST "nature of business activities" and the Udyam NIC codes. They are used for reports and risk rules, not shown as the main label.
- This is display and reporting data. It is not verified.

### 3. One team: people, employees, invites
> Roles, permissions, product catalogs and Track 2 hardening are decided in [ADR 0005](0005-roles-permissions-engine.md); where the two differ, 0005 wins.

- **Two kinds of member:**
  - **People** (Track 1 accounts): one login for everything. Raj can own his shop and be an admin of Meena's.
  - **Employees** (Track 2): a login that belongs to one business (ZX-ORG id plus password), for staff without a personal account.
- **Joining is by invite link** (emailed, valid 7 days). The owner or an admin enters the email and role:
  - a person signs in and accepts;
  - an employee opens the link and sets their own password.
- **Direct create is kept** (`POST /api/v1/auth/employee/create`): an owner, admin or manager (members only) creates an employee and sets the first password, with the same role and holding rules as invites.
- **Owners always have a Zolexora account.** They can't be created as employees, by direct create or by employee invite (`AUTH_OWNER_NEEDS_ZOLEXORA_ACCOUNT`). An owner invite goes by email to a person, who signs in, or signs up with that email, before accepting (`AUTH_ZOLEXORA_ACCOUNT_REQUIRED` until then).
- **Roles:** built-in owner, admin, manager and member, plus custom roles and product roles. See ADR 0005. A business always has at least one owner.
- **Ownership transfer:** the owner invites someone as owner; once they accept, the old owner can step down to admin or leave.
- **Members API:** `GET`, `PATCH` (role, suspend) and `DELETE` on `/api/v1/organizations/{org}/members`, plus `POST /api/v1/organizations/{org}/invites` and `POST /api/v1/invites/{token}/accept`. Suspending or removing a member also ends their sessions for that business.
- Products never store roles or permissions. They register their permission keys with the auth service and check them (ADR 0005).

### 3a. Acting for a business (sign-in flow)
1. A person signs in as today (email OTP, Google or phone) and gets a personal token.
2. The app shows **"Continue as: Myself / Meena Textiles / Meena Exports"** from `GET /api/v1/me/organizations`.
3. Picking a business in a product calls `POST /api/v1/auth/org-session {org_id, product}`. The auth service checks the membership and returns a token that also carries `org_id`, the business role and that product's permissions (ADR 0005). Switching business means a new token.
4. Employees sign in with a ZX id or phone plus password, or with email plus password and then a business picker. No org id is needed (ADR 0005 §6).
5. Products call `/auth/me` as today. For a token that carries a business, `/auth/me` re-checks the membership on every call, so a removed member loses access at once. It returns the user, the business, the role and a **verification summary** (`{identity, pan, gst, registration, authority, bank}` with each status). Products cache it for about 60 seconds.

### 4. Verification

#### 4.1 Checks
| Check | Subject | What it proves |
|---|---|---|
| `identity` | a person (Track 1 user) | who the person is |
| `pan` | organisation | the PAN is real, and the name on it |
| `gst` | organisation | the GSTIN is real and active (only if the business gives one) |
| `registration` | organisation | the business legally exists (Udyam, CIN, LLPIN, deed, certificate) |
| `authority` | organisation | the person acting is a director, partner, trustee or karta, or holds an authorisation letter |
| `bank` | each payout account | the account or UPI ID exists and whose name it is in |

There is **no overall status**. Each product decides which checks it needs.

#### 4.2 Rulebook: which checks each type needs (fixed in code)
The owner's `identity` is needed for every type.

| Type | `pan` | `registration` | `authority` | `bank` | `gst` |
|---|---|---|---|---|---|
| P, individual | ✓ (name must match the identity) | none | none | ✓ | if given |
| P, proprietor | ✓ (name must match the identity) | **any two** of: Udyam, GST certificate, Shop & Establishment licence, trade licence, FSSAI | none | ✓ | if given |
| C, company | ✓ | CIN + certificate of incorporation | ✓ director on MCA, or board authorisation | ✓ | if given |
| F, LLP | ✓ | LLPIN + certificate of incorporation | ✓ designated partner on MCA | ✓ | if given |
| F, partnership | ✓ | partnership deed (+ Registrar of Firms certificate if registered) | ✓ partner named in the deed | ✓ | if given |
| H, HUF | ✓ | HUF declaration | ✓ karta | ✓ | if given |
| T, trust | ✓ | trust deed or registration certificate | ✓ trustee named in the deed | ✓ | if given |
| A/B, society or association | ✓ | registration certificate | ✓ office-bearer named in the certificate | ✓ | if given |
| G/L/J, public body | ✓ | none | ✓ authorisation letter on letterhead + official email OTP (`@gov.in`, `@nic.in`) | ✓ | if given |

The *documents accepted* for each check (name, official download link, instructions) live in `zolexora_verification_document_types` and are **editable in platform-admin**. The checks themselves change only through code.

#### 4.3 Providers: one setting per check, in Infisical
Each setting is `false` (the check is not required and cannot be submitted), or a comma-separated list of providers tried in order. `manual` (admin review) can sit last as the fallback.

| Setting | Allowed providers |
|---|---|
| `IDENTITY_VERIFICATION_PROVIDER` | `aadhaar_offline` (₹0), `digio` (DigiLocker), `manual` |
| `PAN_VERIFICATION_PROVIDER` | `gstin` (₹0, companies with a verified GST), `cashfree`, `digio`, `manual` |
| `GST_VERIFICATION_PROVIDER` | `cleartax`, `cashfree`, `manual` |
| `REGISTRATION_VERIFICATION_PROVIDER` | `manual` |
| `AUTHORITY_VERIFICATION_PROVIDER` | `manual` |
| `BANK_VERIFICATION_PROVIDER` | `cashfree`, `digio` |
| `BANK_VERIFICATION_METHODS` | ordered subset of `upi_vpa`, `reverse_penny_drop`, `pennyless`, `penny_drop` |

Example ₹0 setup: `IDENTITY=aadhaar_offline,digio`, `PAN=gstin,manual`, `GST=manual`, `REGISTRATION=manual`, `AUTHORITY=manual`.

The service refuses to start when a chosen provider's keys are missing: `DIGIO_*`, `CASHFREE_VERIFICATION_*`, `GST_CLEARTAX_*` and `AUTH_ENCRYPTION_KEY`.

#### 4.4 How each check runs
- **Free automatic checks, before any paid call or admin review:**
  - PAN format, and the 4th letter must fit the business kind.
  - GSTIN check digit, and characters 3–12 must equal the PAN.
  - CIN, LLPIN and Udyam number formats.
  - An official-email OTP for public bodies.
- **identity**
  - `aadhaar_offline`: the user uploads the UIDAI Offline e-KYC ZIP and its share code. The auth service checks UIDAI's digital signature. Only the name, birth year, last 4 digits and "verified by UIDAI" are kept; the Aadhaar number, photo, address and XML are discarded.
  - `digio`: a DigiStudio DigiLocker template. The user completes it in Digio's SDK, then the app asks the auth service to fetch the result.
- **pan**
  - `gstin`: verified for free when the GST check is verified and the GSTIN contains this PAN.
  - `cashfree` and `digio`: provider lookups that work for any PAN.
- **gst**: a ClearTax or Cashfree GSTIN lookup. It must be active, and the legal name must match.
- **registration** and **authority**: the user uploads the authentic PDFs listed for the check. The admin opens them from platform-admin with a 15-minute download link, next to a **"Verify on official portal"** link (Udyam verification, MCA master data). Both portals are free.
- **bank**
  - An organisation can have **several payout accounts** (`zolexora_payout_accounts`): a bank account (holder, number, IFSC) or a UPI ID.
  - Each account is verified on its own, by the first method in `BANK_VERIFICATION_METHODS` that fits it:
    - `upi_vpa` for UPI IDs.
    - `reverse_penny_drop`: the user pays ₹1 by UPI, which is refunded, and that proves control of the account.
    - `pennyless` and `penny_drop` for bank accounts.
  - **Provider support:**
    - **Cashfree:** `upi_vpa` (`POST /upi/penny-drop`), `reverse_penny_drop` (`POST /reverse-penny-drop`, then `GET /remitter/status`) and `penny_drop` (`POST /bank-account/sync`). Cashfree's BAV picks the rail itself (IMPS or NPCI), so it does not offer a separate `pennyless`.
    - **Digio:** `reverse_penny_drop` and `penny_drop` through DigiStudio templates (`DIGIO_REVERSE_PENNY_DROP_TEMPLATE`, `DIGIO_PENNY_DROP_TEMPLATE`).
    - The service refuses to start if `BANK_VERIFICATION_METHODS` names a method the chosen provider does not support.

#### 4.5 Results
- **Statuses:** `not_submitted`, `not_required` (provider `false`), `pending`, `verified`, `rejected` or `needs_revision`, each with the time and who decided.
- **Name check:** when a source returns a name (bank, GSTN, PAN lookup, DigiLocker, UIDAI) that does not match the organisation's legal or trade name, or the person's identity name for P, the check stays `pending` and goes to **admin review**.
- **Edits after verification:** editing a field resets only the checks that depend on it to `pending` for review. Changing the legal or trade name resets PAN, GST, registration, authority and bank; editing a payout account re-verifies only that account.
- **Admin decisions:** platform admins approve, reject or request a revision with a reason, in platform-admin. Every decision is audit-logged.
- **Reads:**
  - `GET /api/v1/organizations/{org}/verification` returns each check with its status, the checks the rulebook requires for this type, and last-4 digits only.
  - `GET /api/v1/me/verification` returns the caller's identity check.
  - `GET /api/v1/verification/config` returns the enabled checks and the accepted documents.

#### 4.6 Storage, privacy and cost control
- PAN, GSTIN and bank numbers are encrypted (AES-256-GCM) with `AUTH_ENCRYPTION_KEY`, which only the auth service holds. Members see the last 4 digits; platform admins see the full value.
- **Paid calls are limited:** 5 provider attempts per check per subject per UTC day.
- **Tables (option C):**
  - `zolexora_verifications` holds the current state, one row per check. It links to real rows (`user_id`, `organization_id`, `payout_account_id`; exactly one subject is set), with `ON DELETE CASCADE`.
  - Members live in `zolexora_org_members` (a person or an employee per row; roles in `zolexora_member_roles`, ADR 0005). Employee logins stay in `zolexora_organization_memberships`. Invites live in `zolexora_org_invites` (email, role, kind, token hash, expiry, accepted at).
  - `zolexora_verification_attempts` gets one row per provider call or admin decision: provider, method, result, name returned, who and when. It gives the history, spend per provider and method, and the daily limit. It never stores raw numbers or Aadhaar data.

### 5. How products use it
- The token and introspection carry `org_id` (ZX-ORG). Products call the auth service for profile and verification status, and cache it briefly, as introspection already does.
- A product's local organisation row becomes a link to `zolexora_org_id` plus only that product's own data:
  - Marketplace: storefront grants, listings, orders, payouts (to an auth-service payout account id).
  - TMS: product settings.
- A product decides which checks it requires, for example marketplace selling needs `identity`, `pan`, `registration`, `authority` and one verified `bank`.

### 6. Platform-admin
- **Verifications:** the queue (filter by status, check and type), full values, "Download original", "Verify on official portal", and approve, reject or request a revision with a reason.
- **Accepted documents:** edit each document's name, official download link and instructions. Every app's upload screen shows the same list.
- The platform-admin backend forwards these calls to the auth-service admin endpoints with the admin's own session.

## Consequences

- ✅ A business is entered and verified once, and the same profile appears everywhere.
- ✅ The type comes from the PAN, so a business cannot pick the wrong one.
- ✅ The default setup costs ₹0. Paid checks run only where switched on, and the attempts log shows their spend.
- ✅ PAN, GST and bank numbers live in one service with one key.
- ⚠️ The marketplace removes its own copies: `seller_kyc`, `SELLER_KYC_ENCRYPTION_KEY`, the GST lookup and ClearTax keys, the profile copy, `seller_org_member` and the verification form. `seller_organization` becomes a link.
- ⚠️ TMS follows the same way after the marketplace, and maps its organisation-type list onto the PAN-based type.
- ⚠️ Every product depends on the auth service for profile and verification reads, so those reads are cached and degrade gracefully.
- ⚠️ Registration and authority are admin-reviewed, so admin time grows with sign-ups until paid APIs are switched on.

## Flow at a glance

```
PERSON   sign up ─▶ profile ─▶ verify identity (Aadhaar offline ₹0 / DigiLocker)
           └─▶ create business (PAN ─▶ type) ─▶ checklist from the rulebook
                 PAN · GST (if any) · registration · authority · payout accounts
                 free checks ─▶ provider (if on) ─▶ admin review
           └─▶ invite team (people or employees, 7-day links)
           └─▶ "Continue as <business>" ─▶ org-scoped token
PRODUCT  /auth/me ─▶ user + business + role + verification summary (cache ~60 s)
ADMIN    review queue ─▶ approve / reject / needs revision
```

## Order of work

1. **Auth service:**
   - Schema upgrade SQL and base schema.
   - Profile, organisation, member, payout-account and verification APIs, with providers behind fakes in tests.
   - Admin endpoints.
2. **Platform-admin:** the Verifications and Accepted documents screens.
3. **Marketplace:** read organisation, profile and verification from the auth service; seller screens call the auth-service APIs; drop the local copies.
4. **TMS:** the same as the marketplace.

**Existing organisations:** none are copied. Everyone starts fresh in the auth service.

## To confirm before go-live

1. **Digio:** the result-fetch call (GET or POST on `/client/kyc/v2/{id}/response`) is to be confirmed in the Digio sandbox, and the DigiStudio template names are to be created.
2. **Cashfree:** Verification Suite (Secure ID) must be enabled, with keys in Infisical.
3. **Prices:** per-call rates from Cashfree and Digio, to choose the default `BANK_VERIFICATION_METHODS` order.
4. **Portal check:** each portal's PDF or ZIP signature must be checked against a real sample: UIDAI Offline e-KYC, e-PAN and GST REG-06.
