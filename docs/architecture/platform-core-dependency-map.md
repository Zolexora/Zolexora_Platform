# Platform Core Dependency Map

**Status**: Defined
**Date**: October 2026

## Overview
This document maps the dependencies between the conceptual Platform Core capabilities and the distinct product implementations within the Zolexora Platform ecosystem.

```mermaid
flowchart TD
    %% Platform Core
    subgraph Platform Core
        Identity[Identity & Authentication]
        Organizations[Organizations & Tenancy]
        Entitlements[Product Registry & Entitlements]
        Billing[Billing]
        Integrations[Integrations]
        Notifications[Notifications]
        Audit[Audit]
    end

    %% Products
    subgraph Products
        ERP[ZolexoraERP (Frappe)]
        Marketplace[Marketplace (Next.js/API)]
        IMS[IMS (FastAPI)]
        TMS[TMS (FastAPI)]
        AI[AI (FastAPI/Celery)]
        Engage[Engage (Supabase)]
        TTC[TheTextileCare (FastAPI)]
        Maunkavach[Maunkavach (Node.js)]
    end

    %% Dependency Links
    Products -->|Authenticates via| Identity
    Products -->|Resolves tenant via| Organizations
    Products -->|Checks access via| Entitlements
    Products -->|Records metrics to| Billing
    Products -->|Routes emails via| Notifications
    Products -->|Logs security events to| Audit
```

## Discovery Analysis
During the architectural discovery, it was determined that:
1. **ZolexoraERP**: Strongly dependent on the Frappe framework (`frappe.session.user`, `Workspace` fixtures, `DocTypes`). It manages its own RBAC currently.
2. **AI / TMS / IMS**: Implemented in Python/FastAPI (`uvicorn`). They manage their own `.venv` environments and currently decouple from ERP.
3. **TheTextileCare**: Implemented in Python/FastAPI (`uvicorn`). Isolated backend.
4. **Maunkavach**: Implemented in Node.js/Express.

**Conclusion**: Dependencies on Platform Core must be established through API gateways and authentication middleware rather than tight Python module imports, due to the polyglot nature of the products.
