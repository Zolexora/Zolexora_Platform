# Independent Zolexora ERP customer integration

## Boundary

Zolexora ERP is a commercial multi-customer product, not a Marketplace service. Marketplace is one customer. The systems share no repository, database, tables, authentication, users, administrators, deployment, secrets, backups, release cycle, or availability dependency. Browsers and mobile applications never call ERP; only FastAPI may communicate with the configured Marketplace ERP tenant.

The read-only audit found Zolexora ERP at `/home/chickenman/Documents/my_projects/ZolexoraERP`, branch `phase-3.9b-branding`, commit `099554866245367e5150afe87582ab32b0a79b04`, with unrelated dirty branding files. It uses Frappe 16.25.0 and ERPNext 16.26.1. `zolexora_integrations` 1.0.0 contains placeholder scheduled marketplace sync functions, not a generic versioned API. Current custom whitelisted endpoints are role-protected reads and standard Frappe session/token authentication is documented. Generic v1 endpoint compatibility, webhook signing, inbox idempotency, scopes, and customer-site isolation are unverified.

## Customer/tenant configuration

Future configuration identifies an ERP installation URL, tenant/site external ID, organization/company external ID, environment, client identity reference, scopes, webhook signing identity reference, contract version, capabilities, rate limits, and retry policy. Credential values are excluded and later referenced through OCI Secret Management for Marketplace production.

Frappe scopes data to the active site and ERPNext Companies can coexist inside a site. The audited Compose deployment configures one `SITE_NAME`; it does not prove whether commercial customers receive separate sites or share one. Production integration requires ERP product confirmation of the tenancy policy and cross-customer authorization tests.

## Generic v1 contract

`contracts/zolexora-erp/v1/` defines proposed generic organization, item, warehouse/inventory, Sales Order, delivery, invoice, payment-accounting, return/refund-accounting, and reconciliation capabilities. Tenant and organization context are mandatory. Mutations use stable external IDs and idempotency keys. The ERP product must adopt or supersede this proposal in its own repository before live integration.

Marketplace storefront keys never enter generic ERP logic. Marketplace-owned mappings translate them to company, sales-channel, cost-center, warehouse, price-list, customer-group, tax-template, payment-mode, clearing-account, and supplier references. No production mappings are seeded before the legal-company decision.

## Delivery model

A future Oracle transaction writes a Marketplace domain change and `integration_outbox` event atomically. Checkout and payment completion return without waiting for ERP. A worker later delivers the event. ERP records an inbox row keyed by tenant, event ID, and idempotency key with payload hash, status, timestamps, result reference, and safe error category before applying effects.

Retryable failures include timeouts, rate limits, temporary unavailability, and safe 5xx responses. Validation, unsupported schema, unauthorized scope, and organization mismatch are non-retryable. Retry uses exponential backoff with jitter and a configured maximum, then dead-letter review. Replay requires authorization, reason, audit history, and reuse of the original event identity; it must not duplicate Sales Orders, Payment Entries, Delivery Notes, returns, or credit notes.

## Security

TLS is mandatory. Preferred future authentication is OAuth2 client credentials if ERP implements it; otherwise use a verified scoped Frappe service account/token. The current audit proves only standard Frappe token/session support, not OAuth. Each customer identity is tenant- and operation-scoped. Raw-body webhook signatures include timestamp/replay protection and overlapping secret versions for rotation. Logs record client, tenant, organization, correlation, and result but never credentials or full sensitive payloads. Marketplace and ERP user sessions/passwords never synchronize.

## Payment boundary

Marketplace selects payment accounts, verifies provider webhooks, owns capture/refund truth, and reports customer status. ERP receives normalized accounting events after authoritative Marketplace state exists. ERP never selects a Marketplace gateway. Payment-account mappings point only to generic ERP Mode of Payment, bank/clearing account, and company references.

## Not implemented

Phase 4 adds Marketplace Oracle reliability tables, but no HTTP client, ERP endpoint, worker, webhook, credentials, synchronization, replay execution, reconciliation job, or fake success response exists. The external v1 contract remains proposed.
