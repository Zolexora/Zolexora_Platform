# Project documentation

This directory is the durable product and architecture record for the Zolexora marketplace platform. It describes both the repository as it exists today and the approved target platform. It must not be used to claim that a target capability has already been implemented.

## Platform intent

The platform will operate two customer storefronts on one shared marketplace backend:

| Surface | Production domain | Purpose |
| --- | --- | --- |
| Zolexora Shop | `shop.zolexora.com` | General Zolexora customer storefront |
| Mahila Madel | `mahilamadel.store` | Independent customer brand and storefront |
| Seller portal | `seller.zolexora.com` | Common seller workspace for both storefronts |
| Admin panel | `admin.marketplace.zolexora.com` | Common marketplace administration |
| Marketplace API | `api.zolexora.com` | Shared backend entry point |

Both storefronts share sellers, administration, core catalog, inventory, users, orders, shipping, and platform services. Each storefront has its own brand, listings, pricing rules, and payment gateway or merchant account. The backend—not the browser—selects the payment configuration from trusted storefront identity.

Oracle Cloud Infrastructure (OCI) is the approved final hosting target. The intended managed services include Compute, Autonomous Database, Object Storage, Cache, Load Balancer, WAF, DNS, certificates, Container Registry, Secret Management, and observability.

## Read this first

1. [memory.md](memory.md) for stable facts and non-negotiable rules.
2. [prd.md](prd.md) for product outcomes and acceptance criteria.
3. [architecture.md](architecture.md) and [data-model.md](data-model.md) before changing service or persistence boundaries.
4. [phases.md](phases.md) before starting implementation work.
5. The applicable ADR under [decisions/](decisions/) before revisiting an accepted decision.
6. [runbooks/local-development.md](runbooks/local-development.md) before running the repository locally.

## Document index

| Document | Purpose |
| --- | --- |
| [architecture.md](architecture.md) | Current system, target system, boundaries, and migration direction |
| [business-modules.md](business-modules.md) | Business capabilities and ownership rules |
| [data-model.md](data-model.md) | Target entities, relationships, constraints, and current gaps |
| [data-ownership.md](data-ownership.md) | Marketplace/ERP authority, synchronization, outage, PII, and reconciliation rules |
| [design.md](design.md) | Multi-brand product and interface design rules |
| [domains-and-routing.md](domains-and-routing.md) | Hostnames, storefront resolution, cookies, CORS, and routing |
| [memory.md](memory.md) | Compact durable context for humans and coding agents |
| [oracle-infrastructure.md](oracle-infrastructure.md) | OCI target topology, environments, security, and operations |
| [payment-architecture.md](payment-architecture.md) | Storefront-specific gateway routing and payment lifecycle |
| [erp-integration.md](erp-integration.md) | Independent ERP customer boundary and proposed generic contract |
| [erp-reconciliation.md](erp-reconciliation.md) | Cross-system mismatch detection and controlled resolution |
| [phases.md](phases.md) | Sequenced implementation roadmap and phase gates |
| [prd.md](prd.md) | Product requirements and definition of success |
| [decisions/](decisions/) | Accepted architecture decision records |
| [decisions/0006-canonical-repository-layout.md](decisions/0006-canonical-repository-layout.md) | Canonical capability-oriented repository layout |
| [decisions/0007-separate-buyer-mobile-apps.md](decisions/0007-separate-buyer-mobile-apps.md) | Separate buyer mobile binaries and shared seller mobile ownership |
| [decisions/0009-independent-erp-customer-integration.md](decisions/0009-independent-erp-customer-integration.md) | ERP independence, customer integration, and mapping ownership |
| [decisions/0008-storefront-context-resolution.md](decisions/0008-storefront-context-resolution.md) | Exact request-level storefront resolution and trust boundary |
| [directory-plan/](directory-plan/) | Supplied Phase 1.5 blueprint and path mapping evidence |
| [runbooks/local-development.md](runbooks/local-development.md) | Repository-backed local setup and verification commands |

The existing [auth-token-storage-risk.md](auth-token-storage-risk.md) records a known current-state security risk and remains valid until the secure-session migration is complete.

## Status vocabulary

- **Current**: verified in repository code or configuration.
- **Target**: approved design that is not necessarily implemented.
- **Transitional**: intentionally temporary during migration.
- **Proposed**: requires a decision before implementation.
- **Blocked**: cannot safely proceed until the named prerequisite is resolved.

## Maintenance rules

- Update these documents in the same change that alters an accepted boundary or invariant.
- Record durable decisions as ADRs; do not silently rewrite history.
- Keep volatile progress, command output, and audit evidence outside durable design documents.
- Never place credentials, access tokens, private endpoints, customer data, or payment secrets in documentation.
- Prefer repository-relative links and commands executed from the repository root.
- When code and documentation disagree, verify the code, record the gap, and either update the implementation or clearly label the document as target state.

## Phase 4 additions

- [Oracle persistence](oracle-persistence.md) — implemented Marketplace Oracle stack, migrations, bootstrap, readiness, and limits.
- [ADR 0010](decisions/0010-oracle-marketplace-persistence-foundation.md) — accepted persistence and forward-migration decision.
- [Phase 4 audit](../docs/status/audits/phase-4-oracle-persistence-foundation.md) — verification evidence and blockers.
- [Phase 5 Oracle runtime audit](../docs/status/audits/phase-5-oracle-runtime-validation.md) — real disposable-Oracle migration and hardening evidence.
