# ADR 0004: Secure session architecture

- **Status:** Accepted
- **Date:** 2026-07-14
- **Decision owners:** Marketplace engineering and security

## Context

Current web clients use bearer-token patterns, including browser local storage in the Mahila Madel client. Token theft through cross-site scripting can grant direct API access. The target also spans customer, seller, and admin hosts under `zolexora.com` plus the separate `mahilamadel.store` site. Broad cookie sharing would unnecessarily increase privilege and compromise scope.

Mobile applications already include secure-storage support and have different browser-cookie constraints.

## Decision

PostgreSQL `users`, `user_profiles`, and RBAC assignments are the canonical identity and authorization state. Redis is ephemeral authority for opaque sessions, pending registrations, OTP/verification challenges, and revocation. Both services are provider-independent through standard `DATABASE_URL` and `REDIS_URL` contracts and may run on VMs, containers, OCI, AWS, or compatible managed services without changing application contracts.

Session tokens are cryptographically random and opaque. Only token digests and minimal versioned session records are stored in Redis. Authorization always reloads active identity and role state from PostgreSQL; client JWT claims, request role fields, and cached session roles have no authority. Redis or PostgreSQL unavailability fails authentication closed. Password credentials use Argon2id; migrated Supabase credentials require password reset because unsupported hashes cannot be converted without plaintext passwords.

### Web

- Store session/refresh material only in Secure, HttpOnly cookies.
- Prefer host-only cookies and separate session context for customer, seller, and admin surfaces.
- Use `SameSite=Lax` by default; use cross-site cookies only for a proven flow with explicit CSRF defenses.
- Protect state-changing requests against CSRF.
- Rotate session identifiers, enforce expiration and idle policy, and support server-side revocation.
- Never place access or refresh tokens in local storage, session storage, URLs, or readable JavaScript cookies.

### Mobile

- Store refresh/session credentials in Expo SecureStore or the equivalent native secure store.
- Keep short-lived access material in memory where practical.
- Use protected deep links and validate OAuth/payment return state.
- Support rotation, revocation, device/session listing, and remote sign-out.
- Native transport may use the same opaque Redis session token in `Authorization: Bearer`; it never carries identity or role claims and is stored only in the platform secure store.

The `mahilamadel.store` and `zolexora.com` sites do not directly share cookies. Any later single-sign-on requirement uses a deliberate standards-based redirect flow without tokens in query strings.

For `mahilamadel.store`, browser auth requires a same-origin `/api` boundary or equivalent first-party routing. MR-03 provides host-only cookie and credentialed-client support but does not deploy a proxy or change DNS.

Registration stores bounded pending state and OTP HMAC digests in Redis with expiry, cooldown, rate limits, attempt limits, and atomic single consumption. Verified user/profile/default-buyer-role creation is one PostgreSQL transaction. Seller/admin roles are never accepted from registration input.

## Consequences

### Positive

- JavaScript cannot directly read web session secrets.
- Host-only cookies limit compromise spread among customer, seller, and admin surfaces.
- Central revocation and rotation improve account response and logout reliability.
- Mobile credentials use OS protections rather than plain application storage.

### Costs and risks

- Cookie sessions require CSRF controls and careful CORS/credentials configuration.
- Separate domains make cross-brand SSO a distinct feature rather than implicit token sharing.
- Existing API clients and web stores require migration and compatibility planning.
- Session persistence, rotation races, expiry, device handling, and logout need automated tests.

## Rejected alternatives

### Keep bearer tokens in local storage

Rejected because any successful XSS can read and exfiltrate reusable credentials.

### Share one `.zolexora.com` cookie across all subdomains

Rejected as the default because customer, seller, and admin surfaces have different privilege and risk profiles. It also cannot cover `mahilamadel.store`.

### Put tokens in URL query parameters for cross-domain sign-in

Rejected because URLs leak through logs, history, screenshots, referrers, and monitoring systems.

## Implementation constraints

- Authentication and authorization remain separate: a valid session does not imply resource permission.
- Session secrets are hashed or otherwise safely represented server-side and never logged.
- Login, renewal, logout, revocation, CSRF, CORS, cookie flags, fixation, and concurrent refresh behavior are tested.
- Sensitive role changes revoke or re-evaluate existing sessions as policy requires.
- OAuth uses state, nonce, PKCE where applicable, and an exact redirect allowlist.
- Cookie-authenticated unsafe methods require an exact trusted Origin and the session-bound double-submit CSRF token; GET, HEAD, and OPTIONS are exempt.
- Production identity migration, customer cutover, live Supabase reconciliation, social login, and deployment are outside this decision's MR-03 implementation.

## Related documents

- [Auth token storage risk](../auth-token-storage-risk.md)
- [Domains and routing](../domains-and-routing.md)
- [Architecture](../architecture.md)
