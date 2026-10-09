# Marketplace–ERP data ownership

Zolexora Marketplace and Zolexora ERP are independent companies, products, repositories, databases, identities, deployments, releases, secrets, backups, and failure domains. Marketplace is one ERP customer. A synchronized copy never silently becomes a second authoritative writer.

| Domain/entity | Authoritative owner | Replica/consumer | Create / update direction | Stable external ID | Conflict policy | ERP outage behavior | Reconciliation | PII / retention |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Storefront definitions/domains/branding | Marketplace | ERP receives mapped channel only | Marketplace only | storefront key | Marketplace wins | Continue serving | Mapping audit | Public; retain configuration history |
| Customer identity/session/preferences | Marketplace | ERP gets minimal accounting party when required | Marketplace → ERP reference | customer external ID | Marketplace identity wins | Queue party/order event | Customer mapping | Restricted PII; minimize and honor policy |
| Seller identity/publishing grants | Marketplace | ERP gets supplier/accounting mapping | Marketplace → ERP reference | seller external ID | Marketplace permissions win | Continue selling within Marketplace policy | Supplier mapping | Restricted PII; contractual retention |
| Cart/checkout calculation | Marketplace | None until accepted order | Marketplace only | cart/checkout external ID | Marketplace wins | Checkout never waits for ERP | Order totals after sync | Transactional; short cart retention |
| Promotions/coins/listing content | Marketplace | None or accounting summary | Marketplace only | promotion/listing external ID | Marketplace wins | Continue normally | Aggregate checks if posted | Customer activity; policy-based |
| Customer-facing order state | Marketplace | ERP consumes accepted order | Marketplace → ERP Sales Order; ERP fulfillment/accounting updates return | order external ID | Financial differences open an issue | Commit order and outbox atomically; retry later | Order/Sales Order | Financial/PII; statutory plus support retention |
| Payment attempts/provider webhooks | Marketplace | ERP consumes normalized captured/reversed accounting events | Marketplace → ERP | payment external ID | Provider-verified Marketplace state wins for customer status | Payment completes without ERP | Payment Entry comparison | Financial; statutory retention |
| Refund provider state | Marketplace | ERP consumes normalized refund/credit event | Marketplace → ERP | refund external ID | Never overwrite discrepancy | Refund workflow does not wait for ERP | Credit/refund comparison | Financial; statutory retention |
| Reviews/reels | Marketplace | None | Marketplace only | content external ID | Marketplace wins | No effect | Not applicable | User content; moderation/erasure policy |
| ERP tenant/site | ERP/customer configuration | Marketplace connector reference | ERP provisioned; Marketplace configured | tenant external ID | No automatic reassignment | Disable delivery, preserve outbox | Connectivity/config audit | Configuration; retain audit history |
| Legal Company/GST entity | ERP authoritative after business approval | Marketplace mapping | ERP → Marketplace reference | organization external ID | Business decision required | No guessed fallback | Organization mapping | Legal/tax; statutory retention |
| Item/SKU accounting identity | ERP authoritative for accounting identity; Marketplace owns presentation/listing | Bidirectional mapping | ERP item reference ↔ Marketplace product/SKU | item external ID | Quarantine unmapped SKU | Marketplace may accept order only under approved stock policy | Item mapping | Commercial; retain while referenced |
| Warehouse/stock ledger/cost valuation | ERP | Marketplace consumes availability projection | ERP → Marketplace | warehouse/item external IDs | ERP ledger wins; no silent stock rewrite | Use bounded stale policy or suspend sale per later decision | Inventory balance | Commercial; statutory stock history in ERP |
| Tax/accounting configuration | ERP | Marketplace pricing configuration consumes approved mapping | ERP → Marketplace mapping | tax template external ID | ERP accounting config wins; mismatch blocks posting | Marketplace keeps committed order snapshot | Tax reconciliation | Tax; statutory retention |
| Sales Order after accepted sync | ERP accounting/operations record; Marketplace owns customer order | Both by reference | Marketplace command → ERP result/status | Marketplace order ID + ERP Sales Order ref | Never dual-edit financial totals | Outbox retries; no duplicate order | Order/Sales Order | Financial/PII; statutory |
| Delivery Note | ERP operational/accounting record | Marketplace customer state | ERP → Marketplace update, or Marketplace shipment event mapped by agreed capability | delivery external ID | Open discrepancy; do not auto-rewrite | Marketplace shipment can progress independently | Delivery comparison | Operational; statutory where required |
| Sales Invoice/credit note | ERP | Marketplace display/reference | ERP → Marketplace | invoice/credit external ID | ERP accounting record wins; discrepancy remains open | Queue/status stale | Invoice/credit comparison | Financial/tax; statutory |
| Payment Entry | ERP accounting record | Marketplace retains provider truth | Marketplace accounting event → ERP | payment external ID + ERP ref | Marketplace provider truth and ERP ledger difference both preserved | Retry asynchronously | Payment comparison | Financial; statutory |
| Customer accounting party | ERP once created; Marketplace owns login identity | Synchronized reference | Marketplace minimal party command → ERP | customer external ID | No password/session synchronization | Queue with order event | Party mapping | Restricted PII; minimize |
| Supplier/seller accounting | ERP | Marketplace seller operations | Marketplace mapping → ERP supplier | seller external ID | Accounting mismatch requires review | Settlement accounting queues | Supplier/balance comparison | Financial/PII; statutory |
| Seller settlement accounting | ERP | Marketplace consumes settlement reference/status | Marketplace obligation → ERP; ERP result → Marketplace | settlement external ID | No automatic financial overwrite | Queue and alert after threshold | Supplier balance | Financial; statutory |
| Storefront→company/channel/cost center | Marketplace connector configuration | ERP receives generic references | Operator configuration only | storefront key + tenant/org/channel | No default; uniqueness enforced | Existing mapping retained; delivery pauses if invalid | Mapping audit | Configuration; retain versions |
| Payment account→Mode of Payment/bank | Marketplace connector configuration; ERP owns accounting references | Both | Operator mapping only | Marketplace account ref + ERP mode/account refs | No inferred provider mapping | Payment remains Marketplace-owned; accounting queues | Payment/account mapping | Sensitive configuration, never credentials |

## Legal-company decision

Both layouts are valid and neither is selected:

1. One ERP tenant and Company, with each storefront mapped to a distinct sales channel/cost center.
2. One ERP tenant with separate ERP Companies for Zolexora Shop and Mahila Madel.

Production configuration is blocked until legal/GST ownership, inter-company accounting, tax registration, warehouse ownership, invoice issuer, and settlement responsibility are confirmed.

Phase 4 persists neutral mapping capacity only. No ERP tenant, organization, company, warehouse, tax, invoice, or payment-account mapping is seeded or activated.
