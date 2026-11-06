# 5. Roles and permissions engine, and Track 2 hardening

Date: 2026-11-06

## Status
Accepted (2026-11-06). Extends [ADR 0004](0004-shared-identity-org-profile-kyc.md) §3 (team).

## Context

Every product needs its own roles and permissions (TMS: trips, drivers, fuel; marketplace: catalog, orders, refunds). A business must manage all of them in one place without ever locking itself out. Employee (Track 2) login also needed an org id and had gaps: an in-memory lockout, no MFA, long single tokens and no login history.

## Decision

The auth service is the **only** place where roles, permissions and their assignments live. Products **register permissions** and **enforce** them; they never create roles or store who has what.

### 1. Sign-in stays ours
- **Track 1 sign-in is not touched.**
- Supabase is the database only; Supabase Auth is **not** used. It would not provide businesses, roles or permissions, it cannot sign in employees who have only a ZX id, and it would add a second system. Every protection it offers is added below at ₹0.

### 2. Permissions
- **Keys** are `<owner>:<area>:<action>`, unique across the platform:
  - `tms:trips:create`, owned by TMS only;
  - `marketplace:orders:refund`, owned by the marketplace only;
  - `common:billing:view`: a few shared permissions, **defined in auth-service code** (reviewed in git). Every product may use them in roles, but no product can create, rename or remove them;
  - `org:…`: business-level permissions (profile, team, roles, verification, payouts, security), defined in auth-service code.
- **No sharing:** two products can never register or use the same key. A product's roles may contain only its own keys and `common:…` keys.
- **Registration by API:** each product calls `PUT /api/v1/catalog/{product}` with its permission list, using its own product credential from Infisical.
  - **Prefix rule:** a product may register only keys under its own prefix. Anything else is rejected.
  - **Versions:** every registration is stored as a version with its diff, and can be rolled back in platform-admin.
  - **Additions** go live at once.
  - **Removals** (anything that takes access away) wait in platform-admin until a platform admin approves them. A removed key is **retired**, never deleted, so roles and history that used it stay readable.

### 3. What a person can do in a business
```
access = business role            (business-level: org:… and allowed common:…)
       + one role per product      (that product's keys + common:…)
       + extra grants              (per person)
       − blocks                    (per person; a block always wins)
owner  = everything, always
```
- **No product role** for a product means no access to that product. The owner has full access to every product.
- **Product roles are created only by the business** (owner or admin), per product, from that product's keys plus `common:…`. Neither the platform nor products ship ready-made product roles. A new business starts with none.
- **Business roles:**
  - **Built-in:** owner, admin, manager and member (table below).
  - **Custom:** a business may also create its own business roles (for example "Accounts Admin").
  - **Disable:** it may disable a built-in role other than owner, choosing where that role's people move.
  - **Block:** it may block single permissions in a built-in role other than owner, for its own business only.

| Business-level action | Owner | Admin | Manager | Member |
|---|:-:|:-:|:-:|:-:|
| View business profile | ✅ | ✅ | ✅ | ✅ |
| Edit business profile | ✅ | ✅ | ❌ | ❌ |
| View team | ✅ | ✅ | ✅ | ❌ |
| Invite people | ✅ | ✅ | ✅ members only | ❌ |
| Change roles, suspend, remove people | ✅ | ✅ not owners | ❌ | ❌ |
| Create and edit roles | ✅ | ✅ | ❌ | ❌ |
| Assign product roles | ✅ | ✅ | ✅ existing roles, to members only | ❌ |
| Give or block extra permissions | ✅ | ✅ only ones they hold | ❌ | ❌ |
| View verification | ✅ | ✅ | ✅ | ❌ |
| Submit verification | ✅ | ✅ | ❌ | ❌ |
| Payout accounts (`org:payouts:manage`) | ✅ | ❌ (custom roles only, below) | ❌ | ❌ |
| Security settings (MFA rules) | ✅ | ✅ | ❌ | ❌ |
| Transfer ownership, close business | ✅ | ❌ | ❌ | ❌ |

### 4. Guard rails, so a business never locks itself out
- **The owner** cannot be edited, disabled or blocked. A business always has at least one owner, and the last owner cannot leave.
- **No self-changes:** nobody can change their own role or permissions.
- **Holding rule:** nobody can grant, or put into a role, a permission they do not hold. The owner holds everything.
- **Admins and owners:** admins cannot change, suspend or remove owners.
- **Payouts:** `org:payouts:manage` may go to a **custom** business role **only when the business requires MFA**, and using it always needs a fresh MFA code. **Transfer ownership** and **close business** stay owner-only forever.
- **Disabling or deleting a role** asks where its people move. Nobody is left without a role.
- **Audit and repair:** every change is audit-logged. **"Explain access"** shows why a person can or cannot do something (role, extra grant, block). Platform admins can view and repair any business's team.

### 5. How products receive it
- "Continue as Meena Textiles in TMS" calls `POST /api/v1/auth/org-session {org_id, product}`. The token carries `org_id`, the business role, `product`, and that person's **effective permissions for that product only**.
- `/auth/me` returns the same, fresh. A removed person or a changed role takes effect on the next call. Products cache it for about 60 seconds.
- Products only check `has("tms:trips:create")`.

### 6. Track 2 (employees) hardening
1. **No org id at login:**
   - **ZX id (or phone) + password** signs in directly.
   - **Email + password:** the business picker is shown **only after the password is correct**. A wrong password gives the same answer whether or not the email exists.
   - **Invite and login links** fill in the business, and the device remembers the last one.
2. **Invite links only:** an employee sets their own password from the invite. An admin can force a reset but never sees or sets a password.
3. **Lockout in the database** (it survives restarts and works across servers), plus Turnstile.
4. **Leaked-password check** on every new password (Have I Been Pwned range API; only a 5-character hash prefix leaves the server).
5. **MFA (authenticator app, TOTP):** each business chooses off, optional, or required for owners and admins. Payout delegation needs it to be required.
6. **Short tokens:** a 15-minute access token plus a rotating refresh token. Reusing an old refresh token revokes the whole session.
7. **Signed with a key pair (ES256),** published at a JWKS URL, so products verify without holding a secret.
8. **Sessions and login history:** active devices, "sign out other devices", and every login attempt in the audit log.

Items 6 and 7 apply to Track 2 and business-session tokens. Track 1 tokens stay as they are unless decided otherwise.

## Consequences

- ✅ One place answers "who can do what, where, and why".
- ✅ Products stay simple: register keys, check `has(...)`.
- ✅ A business cannot lock itself out, and payout fraud needs the owner or MFA.
- ⚠️ A new business has no product roles until its owner or an admin creates them. Product screens should offer "create your first role".
- ⚠️ Every product needs a product credential and must register its catalog on deploy.
- ⚠️ Blocks and custom business roles make access harder to read. "Explain access" is required, not optional.

## Data (auth database)
- `zolexora_permission_catalog`: key, product, description, status (active or retired), version.
- `zolexora_catalog_versions`: product, version, diff, applied_at, pending removals, approved_by.
- `zolexora_roles`: organization_id, scope (`org` or a product), name, built_in, disabled.
- `zolexora_role_permissions`: role_id, permission_key. For built-in roles this table holds only the business's blocks; the built-in permissions are in code.
- `zolexora_member_roles`: member (person or employee), role_id. There is one business role and at most one role per product.
- `zolexora_member_overrides`: member, permission_key, effect (`grant` or `block`).
- `zolexora_sessions`: refresh-token hash, family, device, ip, created, last_used, revoked.
- `zolexora_mfa_factors`: member, TOTP secret (encrypted), confirmed_at.
- `zolexora_login_attempts`: key, ip, at, success. It backs the database lockout.
