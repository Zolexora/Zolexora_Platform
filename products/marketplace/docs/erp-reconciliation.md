# ERP reconciliation

Reconciliation detects divergence; it never silently overwrites financial or stock differences.

| Area | Comparison | Typical action |
| --- | --- | --- |
| Item/SKU mapping | Active Marketplace SKU versus ERP Item reference | Quarantine missing/duplicate mapping |
| Inventory | ERP warehouse balance versus Marketplace availability projection | Flag stale/mismatched balance; apply approved future policy |
| Orders | Marketplace accepted orders versus ERP Sales Orders | Retry missing delivery or review rejected totals |
| Delivery | Shipment state versus ERP Delivery Note | Review missing/out-of-order events |
| Invoices | Order financial snapshot versus ERP Sales Invoice | Finance review; never rewrite silently |
| Payments | Provider-authoritative capture/reversal versus ERP Payment Entry | Retry missing entry or escalate amount/currency difference |
| Returns | Marketplace return approval versus ERP return document | Review missing/duplicate return |
| Refunds | Provider-authoritative refund versus ERP credit note/accounting entry | Finance review; preserve both states |
| Seller/Supplier balances | Marketplace settlement obligation versus ERP supplier ledger | Settlement/accounting review |

Each issue records tenant, organization, optional storefront, Marketplace reference, ERP reference, expected and observed state, first detection, age, severity, resolution status, assignee, evidence, and immutable resolution audit. Runs record scope, contract version, start/end, counts, cursor, and outcome.

Suggested cadence is near-real-time missing-event detection plus scheduled inventory/order/payment checks and a daily financial reconciliation. Exact service levels are operational decisions. Retries repair transport gaps; reconciliation catches accepted-but-divergent business state. Operators may acknowledge, replay an idempotent event, correct mapping, or resolve through an approved accounting action. Direct database edits and automatic financial balancing are forbidden.

Phase 4 provides `reconciliation_run` and `reconciliation_issue` persistence only. Scheduling, comparison, resolution, and replay remain unimplemented.
