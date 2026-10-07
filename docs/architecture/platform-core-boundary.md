# Platform Core Boundary

**Status**: Defined
**Date**: October 2026

## 1. Objective
Define the functional domains belonging to the Zolexora Platform Core. These domains offer cross-product capabilities via APIs and events, shielding individual products from managing multi-tenant SaaS complexities.

## 2. Core Domains

### Identity & Authentication
- **Purpose**: Manage users, credentials, SSO, MFA, and JWT/session issuance.
- **Why it is platform-level**: All products (ERP, IMS, TMS, Maunkavach) require user authentication. Centralizing it enables a single login experience.
- **Products using it**: All products.
- **Current implementation**: Decentralized (Frappe handles ERP, Supabase/Custom handles others).
- **Dependencies**: None.
- **ERP-specific dependencies**: None.
- **Proposed ownership**: PLATFORM.
- **API requirements**: Public endpoints for login/registration, internal JWKS/token validation.
- **Data ownership**: Users, credentials, sessions.
- **Security considerations**: Critical. Must follow strict security standards.
- **Migration difficulty**: High. Products must migrate from local user tables to platform tokens.
- **Priority**: P0 (Foundational)
- **Classification**: CORE

### Organizations & Tenancy
- **Purpose**: Manage organizations, tenant boundaries, and cross-organization memberships/teams.
- **Why it is platform-level**: B2B products often share the same organizational structure. A customer using both ERP and TMS should have one central Organization record.
- **Products using it**: ERP, IMS, TMS, Analytics, Engage.
- **Proposed ownership**: PLATFORM.
- **API requirements**: Internal APIs for products to resolve organization IDs and memberships.
- **Data ownership**: Organizations, teams, memberships.
- **Classification**: CORE

### Product Registry & Entitlements
- **Purpose**: Catalog available Zolexora products, modules, and track which organizations have active subscriptions or feature flags for them.
- **Why it is platform-level**: Enforcing "Can this tenant access the AI product?" must happen before the request even reaches the AI product, or at the API gateway layer.
- **Proposed ownership**: PLATFORM.
- **Classification**: CORE

### Billing
- **Purpose**: SaaS subscription billing, usage metering, and invoice generation for Zolexora Platform services.
- **Why it is platform-level**: Billing is at the account/tenant level, crossing all products.
- **What it must NOT contain**: ERP customer invoices (which are B2B transactions created by the tenant for *their* customers).
- **Data ownership**: Plans, subscriptions, platform billing events.
- **Classification**: CORE

### Platform Notifications
- **Purpose**: Centralized delivery routing for Emails, SMS, and Push Notifications.
- **Why it is platform-level**: Prevents every product from integrating with SendGrid/Twilio independently.
- **API requirements**: Internal API accepting generic payloads (e.g., `send_email`).
- **Data ownership**: Delivery status, platform-wide user communication preferences.
- **Classification**: SHARED SERVICE

### Custom Domains & Routing
- **Purpose**: Manage tenant custom domains, SSL verification, and edge routing.
- **Why it is platform-level**: A tenant might map `app.tenant.com` to Zolexora, routing to ERP, IMS, etc. based on path.
- **Classification**: CORE

### Automation & Webhooks
- **Purpose**: Cross-product workflow execution. E.g., when ERP triggers an event, alert IMS.
- **Classification**: SHARED SERVICE

### Audit & Security Logging
- **Purpose**: Immutable logging of security events (logins, permission changes, data exports).
- **Why it is platform-level**: Compliance requires a centralized, tamper-evident log across the ecosystem.
- **What it must NOT contain**: ERP business history (e.g., "Sales Order #123 updated").
- **Classification**: SHARED SERVICE

## 3. Polyglot Architecture Implications
Because products utilize diverse stacks (ERP is Frappe/Python, IMS is FastAPI, Maunkavach is Node.js), Platform Core **MUST** expose capabilities via language-agnostic contracts:
- **Synchronous**: REST/gRPC internal APIs.
- **Asynchronous**: Event Bus (e.g., Kafka, RabbitMQ, or Redis PubSub).
- **Data**: Platform Core must own its own isolated database schema or cluster. Products must not query Platform databases directly.
