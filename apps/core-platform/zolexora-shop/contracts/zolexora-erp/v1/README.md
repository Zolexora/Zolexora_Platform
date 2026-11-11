# Proposed Zolexora ERP customer integration contract v1

This language-neutral contract describes how an independent customer system may integrate with Zolexora ERP. It is **proposed**: the audited ERP repository has no equivalent generic v1 endpoints yet. Marketplace is one customer and owns its mapping from storefront keys to generic tenant, organization, sales-channel, warehouse, price-list, payment-mode, and accounting references.

Every mutation requires tenant and organization context plus an idempotency key. Dates are UTC RFC 3339 values, money is integer minor units, and cross-system references are stable external IDs rather than database primary keys. Repeated delivery is normal. Payloads contain no credentials.

The schemas are authoritative for examples in this directory. `proposed-openapi.yaml` describes candidate HTTP capabilities; it is not evidence of a deployed ERP API.
