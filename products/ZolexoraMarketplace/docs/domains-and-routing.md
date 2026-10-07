# Domains and routing

## Canonical production domains

| Host | Application | Storefront context |
| --- | --- | --- |
| `shop.zolexora.com` | Zolexora customer web | `zolexora-shop` |
| `mahilamadel.store` | Mahila Madel customer web | `mahila-madel` |
| `www.mahilamadel.store` | Redirect to canonical Mahila domain | `mahila-madel` only during redirect handling |
| `seller.zolexora.com` | Shared seller portal | User-selected authorized operational scope |
| `admin.marketplace.zolexora.com` | Shared admin panel | Explicit filtered or global scope |
| `api.zolexora.com` | Shared FastAPI API | Derived from trusted request context |

Any legacy customer or admin domains require an explicit redirect and expiry plan. They are not silently accepted as permanent aliases.

Mobile binaries do not derive authority from browser domains. Zolexora mobile sends `zolexora-shop` and Mahila mobile sends `mahila-madel` through `X-Storefront-Key`; these public values request context but do not authorize access. Seller mobile has no permanent storefront key.

## Host-to-store resolution

Request-level resolution is implemented through the static registry in `services/marketplace-api/storefronts/`.

1. Normalize the effective host: lowercase, remove the trailing dot, and validate any port rules for the environment.
2. Ignore forwarded host/protocol headers until the OCI load balancer is explicitly trusted.
3. Resolve an exact customer host, or on the shared API host compare exact Origin and public buyer hint signals.
4. Attach a request-local typed `StorefrontContext` containing the static definition and resolution source.
5. Reject unknown, unverified, disabled, or ambiguous hosts.

`X-Storefront-ID`, query parameters, request bodies, and browser storage are not authoritative. `X-Storefront-Key` is accepted only as a known exact hint and cannot override a host/Origin, authorize a resource, or choose payment configuration.

## API routing

Use one versioned API surface, initially `/api` for compatibility and later `/api/v1` when formal versioning is introduced. Route groups should follow business modules rather than frontend applications.

Examples:

- `/api/storefront`
- `/api/catalog` and `/api/listings`
- `/api/cart` and `/api/checkout`
- `/api/orders`
- `/api/payments`
- `/api/seller/...`
- `/api/admin/...`
- `/api/webhooks/payments/{endpoint-key}`
- `/api/webhooks/shipping/{provider}`

Provider webhooks must not depend on a browser session or a caller-supplied storefront. The endpoint key or persisted provider object maps the event to a payment account and storefront before processing.

## Seller and admin scope

Seller and admin hosts do not map to one customer storefront. Their APIs use authenticated permissions and explicit filters:

- Seller requests include an authorized seller organization and, where required, a storefront ID from that seller's grants.
- Admin requests may use a storefront filter or an explicit global view.
- Every mutation validates the selected scope against the target resource.
- Cross-store reports label scope and never merge amounts without a shared currency rule.

## Local development routing

Initial local ports:

| Surface | Local URL |
| --- | --- |
| Zolexora buyer web | `http://localhost:3000` |
| Seller web | `http://localhost:3001` |
| Admin web | `http://localhost:3002` |
| FastAPI | `http://127.0.0.1:8000` |
| Mahila current React client | commonly `http://localhost:3000`; use a non-conflicting port when running beside Zolexora |
| Mahila current Express server | `http://localhost:5000` |

As storefront context is introduced, use a local host mapping or trusted development-only mapping such as:

```text
127.0.0.1 shop.zolexora.local
127.0.0.1 mahilamadel.local
```

Development fallbacks must be explicit, disabled in production, and covered by tests. Do not use permissive “any host maps to default store” behavior.

## Cookies and sessions

Web authentication uses host-only Secure, HttpOnly cookies where possible. Do not set a broad `.zolexora.com` cookie simply to share sessions among customer, seller, and admin surfaces.

Recommended properties:

- `Secure` in production.
- `HttpOnly` for session and refresh material.
- `SameSite=Lax` by default; use `None` only for a proven cross-site flow with `Secure` and CSRF controls.
- Narrow `Path` and host scope.
- Short-lived access session with rotation/revocation policy.
- Separate CSRF protection for state-changing browser requests.

`mahilamadel.store` is a different site and cannot share `.zolexora.com` cookies. Cross-brand sign-in, if required, needs a deliberate OAuth/OIDC-style redirect flow; it must not copy tokens through query strings or local storage.

## CORS

The API maintains an exact environment-specific allowlist. Production origins should include only deployed, approved HTTPS origins. Credentials are allowed only with exact origins, never `*`.

Validate:

- Origin and method.
- Requested headers.
- Preflight caching duration.
- Whether the route truly needs browser access.
- That webhook endpoints do not rely on CORS for security.

## Redirects and canonicalization

- Redirect HTTP to HTTPS at the edge.
- Redirect `www.mahilamadel.store` to `https://mahilamadel.store` with path and safe query preservation.
- Choose one trailing-slash policy per frontend.
- Preserve `Host`, scheme, client IP chain, and correlation ID through trusted proxy configuration.
- Avoid caching authenticated, cart, checkout, order, payment, admin, and seller API responses at the edge.

## DNS and TLS ownership

OCI DNS is the target authoritative DNS service. Public certificates are managed through OCI Certificates or another explicitly approved mechanism integrated with the OCI load balancer. Certificate renewal and domain validation must be monitored.

## Routing tests

- Each customer host resolves to exactly its expected storefront.
- Unknown and disabled hosts fail closed.
- Spoofed forwarded-host headers from untrusted clients are ignored or rejected.
- A request cannot switch payment account by changing a header or body field.
- Seller grants prevent publication to unauthorized storefronts.
- Admin global and store-filtered behavior is explicit.
- Cookies are not shared more broadly than intended.

Production customer host and Origin resolution now loads active exact domains from Oracle through the storefront repository. Static definitions remain bootstrap/test fixtures only. Missing records, disabled records, or Oracle failure return no fallback storefront.
