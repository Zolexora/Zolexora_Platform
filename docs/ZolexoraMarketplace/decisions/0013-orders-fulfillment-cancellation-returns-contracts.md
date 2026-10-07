# ADR 0013: Canonical Contracts for Orders, Fulfillment, Cancellation, and Returns

## Status
Accepted

## Context
Zolexora Marketplace operates as a multi-storefront platform serving `zolexora-shop` (Zolexora Shop) and `mahila-madel` (Mahila Madel). As part of the MR-01 contract refactoring sequence, order creation, fulfillment tracking, cancellation handling, and return lifecycles must be formally standardized in `services/marketplace-api/models/orders.py`.

Prior implementations relied on unstructured MongoDB documents (`OrderDoc`) and direct float values. A canonical contract architecture is required to guarantee role isolation (Buyer, Seller, Admin), strict multi-seller shipment partitioning, integer-minor monetary integrity, and deterministic OpenAPI / TypeScript contract generation.

## Decisions

### 1. Order Creation & Quote Verification Authorization
- Orders MUST be created exclusively via `POST /api/orders` by consuming a valid, unexpired, signed `CheckoutQuote` token issued by `POST /api/cart/checkout/quote`.
- Order creation is idempotent when an `idempotency_key` is provided.
- Evaluation of order creation contracts during offline testing must make zero external network calls (e.g. no live payment gateways or live ERP dispatch).

### 2. Immutability & Line Item Snapshots
- Each line item in an order is captured as an `OrderLineSnapshot`.
- The snapshot permanently freezes `listing_id`, `master_product_id`, `seller_id`, `seller_name`, `title`, `image_url`, `unit_price` (`Money`), and `quantity`.
- Price changes or listing modifications made after order creation do not alter historical order line snapshots.

### 3. Multi-Seller Fulfillment & Shipment Partitioning
- Orders containing items from multiple sellers are grouped under a single parent `Order` entity for the buyer.
- Fulfillments are split into distinct `ShipmentResponse` objects per `seller_id`.
- Sellers can only access, view, and transition shipments containing line items owned by their `seller_id`.

### 4. Role-Based Access Control & Scoped Views
- **Buyer View (`BuyerOrderResponse`, `BuyerOrderSummaryResponse`)**:
  - Scoped by `StorefrontContext.key` + `buyer_id`.
  - Displays full order totals, delivery address, all order lines, and shipment statuses across sellers.
- **Seller View (`SellerOrderResponse`, `SellerOrderSummaryResponse`)**:
  - Scoped by `StorefrontContext.key` + `seller_id`.
  - Strictly filters `lines` and `shipments` to those belonging to the authenticated seller. Financial fields (`seller_subtotal`) represent only the seller's portion of the order.
- **Admin View (`AdminOrderResponse`, `AdminOrderSummaryResponse`)**:
  - Scoped by `StorefrontContext.key` with admin role privileges.
  - Full visibility across all sellers, lines, shipments, cancellation requests, and return requests.

### 5. Fulfillment State Machine
- Valid fulfillment states: `unfulfilled` → `allocated` → `processing` → `shipped` → `out_for_delivery` → `delivered`.
- Terminal / Exception states: `failed_delivery`, `returned_to_origin`, `cancelled`.
- Sellers submit `FulfillmentTransitionRequest` to transition their shipment status and attach tracking metadata (`carrier_name`, `tracking_number`, `tracking_url`).

### 6. Cancellation & Return Lifecycles
- **Cancellation**:
  - Statuses: `none` → `requested` → `approved` / `rejected` → `completed`.
  - Buyers or sellers can request full or line-item cancellations prior to dispatch.
  - Sellers accept/reject via `SellerCancellationActionRequest`.
- **Returns**:
  - Statuses: `none` → `requested` → `approved` / `rejected` → `item_shipped` → `item_received` → `inspected` → `refund_issued` → `completed`.
  - Buyers request returns per line item with mandatory reason and optional proof image URLs.
  - Sellers progress the return state machine via `SellerReturnActionRequest`.

### 7. Monetary and Timestamp Primitives
- All financial attributes MUST use the canonical `Money` model (`amount_minor`: int, `currency`: str).
- All datetime attributes MUST use `UTCDateTime` (ISO 8601 UTC string). No naive datetimes are permitted.

## Consequences
- Clean separation between public API Pydantic contracts and internal MongoDB storage models (`OrderDoc`).
- Deterministic type safety and full synchronization across FastAPI, OpenAPI schema, and generated TypeScript types.
- Complete security against cross-storefront and cross-seller data leakage.
- Clear foundation for subsequent implementation batch MR-01E.
