# Complete Zolexora Marketplace API Directory

**Location**: `/workspaces/ZolexoraMarketplace/docs/Api_Test_Report/all-marketplace-apis.md`  
**Total Registered Endpoints**: 146  
**Date Generated**: August 18, 2026  

---

## Table of Contents

- [Erp Webhooks (1 endpoints)](#erp-webhooks)
- [Admin (14 endpoints)](#admin)
- [Admin-Catalog (4 endpoints)](#admin-catalog)
- [Admin-Orders (2 endpoints)](#admin-orders)
- [Auth (12 endpoints)](#auth)
- [Cart (11 endpoints)](#cart)
- [Coins (4 endpoints)](#coins)
- [Media-Management (2 endpoints)](#media-management)
- [Orders (12 endpoints)](#orders)
- [Payments (2 endpoints)](#payments)
- [Products (10 endpoints)](#products)
- [Reels (7 endpoints)](#reels)
- [Seller-Catalog (7 endpoints)](#seller-catalog)
- [Seller-Organizations (17 endpoints)](#seller-organizations)
- [Shipping (17 endpoints)](#shipping)
- [Shipping-Webhooks (7 endpoints)](#shipping-webhooks)
- [Storefront (1 endpoints)](#storefront)
- [Subscriptions (2 endpoints)](#subscriptions)
- [System (7 endpoints)](#system)
- [Users (7 endpoints)](#users)

---

## Erp Webhooks

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/erp/webhooks` | Public | process_erp_webhook |

---

## Admin

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/admin/analytics` | Admin Only | admin_analytics |
| **`GET`** | `/api/admin/orders` | Admin Only | admin_orders |
| **`GET`** | `/api/admin/orders/pending-upi` | Admin Only | pending_upi |
| **`PUT`** | `/api/admin/orders/{order_id}/verify-upi` | Admin Only | verify_upi |
| **`GET`** | `/api/admin/products` | Admin Only | admin_products |
| **`DELETE`** | `/api/admin/products/{pid}` | Admin Only | admin_delete_product |
| **`PUT`** | `/api/admin/products/{pid}/toggle` | Admin Only | admin_toggle_product |
| **`GET`** | `/api/admin/reels` | Admin Only | admin_reels |
| **`DELETE`** | `/api/admin/reels/{rid}` | Admin Only | admin_delete_reel |
| **`PUT`** | `/api/admin/reels/{rid}/toggle` | Admin Only | admin_toggle_reel |
| **`GET`** | `/api/admin/stats` | Admin Only | admin_stats |
| **`GET`** | `/api/admin/users` | Admin Only | admin_users |
| **`PUT`** | `/api/admin/users/{uid}/role` | Admin Only | admin_set_role |
| **`PUT`** | `/api/admin/users/{uid}/toggle` | Admin Only | admin_toggle_user |

---

## Admin-Catalog

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/admin/catalog/listings` | Admin Only | list_admin_listings |
| **`GET`** | `/api/admin/catalog/listings/{listing_id}` | Admin Only | get_admin_listing |
| **`GET`** | `/api/admin/catalog/listings/{listing_id}/inventory` | Admin Only | get_admin_inventory |
| **`PUT`** | `/api/admin/catalog/listings/{listing_id}/moderation` | Admin Only | moderate_admin_listing |

---

## Admin-Orders

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/orders/admin` | Admin Only | list_admin_orders |
| **`GET`** | `/api/orders/admin/{order_id}` | Admin Only | get_admin_order_detail |

---

## Auth

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/auth/forgot-password` | Public | forgot_password |
| **`POST`** | `/api/auth/login` | Public | login |
| **`POST`** | `/api/auth/logout` | Public | logout |
| **`GET`** | `/api/auth/me` | Authenticated User | me |
| **`PUT`** | `/api/auth/me` | Authenticated User | update_profile |
| **`POST`** | `/api/auth/me/avatar` | Authenticated User | upload_avatar |
| **`POST`** | `/api/auth/register` | Public | register |
| **`POST`** | `/api/auth/resend-otp` | Public | resend_otp |
| **`POST`** | `/api/auth/resend-otp-body` | Public | resend_otp |
| **`POST`** | `/api/auth/reset-password` | Public | reset_password |
| **`POST`** | `/api/auth/revoke-all` | Authenticated User | revoke_all |
| **`POST`** | `/api/auth/verify-register` | Public | verify_register |

---

## Cart

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`DELETE`** | `/api/cart` | Authenticated User | clear_cart |
| **`GET`** | `/api/cart` | Authenticated User | get_cart |
| **`POST`** | `/api/cart/checkout` | Authenticated User | checkout_stub |
| **`POST`** | `/api/cart/checkout/quote` | Authenticated User | checkout_quote |
| **`POST`** | `/api/cart/checkout/upi-paid` | Authenticated User | upi_paid_stub |
| **`POST`** | `/api/cart/checkout/verify-cashfree` | Authenticated User | verify_cashfree_stub |
| **`POST`** | `/api/cart/checkout/verify-payment` | Authenticated User | verify_payment_stub |
| **`GET`** | `/api/cart/count` | Authenticated User | cart_count |
| **`POST`** | `/api/cart/items` | Authenticated User | add_to_cart |
| **`DELETE`** | `/api/cart/items/{product_id}` | Authenticated User | remove_cart_item |
| **`PUT`** | `/api/cart/items/{product_id}` | Authenticated User | update_cart_item |

---

## Coins

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/coins/balance` | Authenticated User | coin_balance |
| **`GET`** | `/api/coins/discounts` | Authenticated User | my_discounts |
| **`POST`** | `/api/coins/generate-discount` | Authenticated User | generate_discount |
| **`GET`** | `/api/coins/history` | Authenticated User | coin_history |

---

## Media-Management

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/seller/organizations/{org_id}/media/intent` | Public | Request a media upload intent |
| **`POST`** | `/api/seller/organizations/{org_id}/media/{media_id}/complete` | Public | Mark a media upload as complete |

---

## Orders

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/orders` | Authenticated User | create_order_from_quote |
| **`GET`** | `/api/orders/buyer` | Authenticated User | list_buyer_orders |
| **`GET`** | `/api/orders/buyer/{order_id}` | Authenticated User | get_buyer_order_detail |
| **`POST`** | `/api/orders/buyer/{order_id}/cancel` | Authenticated User | request_buyer_cancellation |
| **`POST`** | `/api/orders/buyer/{order_id}/return` | Authenticated User | request_buyer_return |
| **`GET`** | `/api/orders/my` | Authenticated User | legacy_my_orders |
| **`GET`** | `/api/orders/seller` | Seller Only | list_seller_orders |
| **`GET`** | `/api/orders/seller/{order_id}` | Seller Only | get_seller_order_detail |
| **`POST`** | `/api/orders/seller/{order_id}/cancellations/action` | Seller Only | action_seller_cancellation |
| **`POST`** | `/api/orders/seller/{order_id}/returns/action` | Seller Only | action_seller_return |
| **`POST`** | `/api/orders/seller/{order_id}/shipments/{shipment_id}/transition` | Seller Only | transition_seller_shipment |
| **`GET`** | `/api/orders/{order_id}` | Authenticated User | legacy_get_order |

---

## Payments

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/payments/legacy/verify` | Storefront Context Required | Legacy Razorpay verification adapter. |
| **`GET`** | `/api/payments/{intent_id}` | Storefront Context Required | Retrieve a payment intent.  Storefront isolation is enforced: the intent must belong to the resolved storefront. |

---

## Products

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/products` | Storefront Context Required | list_products |
| **`POST`** | `/api/products` | Seller Only | create_product |
| **`POST`** | `/api/products/bulk` | Seller Only | bulk_create_products |
| **`GET`** | `/api/products/categories` | Public | get_categories |
| **`GET`** | `/api/products/featured` | Storefront Context Required | get_featured_products |
| **`GET`** | `/api/products/my` | Seller Only | my_products |
| **`DELETE`** | `/api/products/{product_id}` | Authenticated User | delete_product |
| **`GET`** | `/api/products/{product_id}` | Public | get_product |
| **`PUT`** | `/api/products/{product_id}` | Authenticated User | update_product |
| **`POST`** | `/api/products/{product_id}/upload-image` | Authenticated User | upload_image |

---

## Reels

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/reels` | Storefront Context Required | list_reels |
| **`POST`** | `/api/reels` | Authenticated User | create_reel |
| **`GET`** | `/api/reels/my` | Authenticated User | my_reels |
| **`DELETE`** | `/api/reels/{reel_id}` | Authenticated User | delete_reel |
| **`PUT`** | `/api/reels/{reel_id}` | Authenticated User | update_reel |
| **`POST`** | `/api/reels/{reel_id}/upload` | Authenticated User | Upload reel image/video → Cloudinary. |
| **`POST`** | `/api/reels/{reel_id}/view` | Storefront Context Required | view_reel |

---

## Seller-Catalog

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/seller/catalog/listings` | Storefront Context Required | list_seller_listings |
| **`POST`** | `/api/seller/catalog/listings` | Storefront Context Required | create_seller_listing |
| **`GET`** | `/api/seller/catalog/listings/{listing_id}` | Storefront Context Required | get_seller_listing |
| **`PUT`** | `/api/seller/catalog/listings/{listing_id}` | Storefront Context Required | update_seller_listing |
| **`GET`** | `/api/seller/catalog/listings/{listing_id}/inventory` | Storefront Context Required | get_seller_inventory |
| **`PUT`** | `/api/seller/catalog/listings/{listing_id}/inventory` | Storefront Context Required | update_seller_inventory |
| **`PUT`** | `/api/seller/catalog/listings/{listing_id}/lifecycle` | Storefront Context Required | change_seller_listing_lifecycle |

---

## Seller-Organizations

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/admin/seller-organizations` | Admin Only | Admin list all seller organizations |
| **`GET`** | `/api/admin/seller-organizations/{org_id}` | Admin Only | Admin get seller organization details |
| **`PUT`** | `/api/admin/seller-organizations/{org_id}/suspension` | Admin Only | Admin suspend or unsuspend organization |
| **`PUT`** | `/api/admin/seller-organizations/{org_id}/verification` | Admin Only | Admin update organization verification status |
| **`GET`** | `/api/admin/seller-organizations/{org_id}/verification-history` | Admin Only | Admin view organization verification history |
| **`GET`** | `/api/admin/storefront-grants` | Admin Only | Admin list publishing grants |
| **`PUT`** | `/api/admin/storefront-grants/{grant_id}/decision` | Admin Only | Admin decide (approve, revoke, suspend) on a publishing grant |
| **`POST`** | `/api/seller/organizations` | Authenticated User | Create a new seller organization |
| **`GET`** | `/api/seller/organizations/me` | Authenticated User | List organizations for current user |
| **`GET`** | `/api/seller/organizations/{org_id}` | Public | Get seller organization details |
| **`GET`** | `/api/seller/organizations/{org_id}/audit-log` | Public | View organization audit log |
| **`GET`** | `/api/seller/organizations/{org_id}/grants` | Public | List storefront grants for an organization |
| **`POST`** | `/api/seller/organizations/{org_id}/grants` | Authenticated User | Request a publishing grant for a storefront |
| **`GET`** | `/api/seller/organizations/{org_id}/members` | Public | List members of an organization |
| **`POST`** | `/api/seller/organizations/{org_id}/members/invite` | Authenticated User | Invite or add a member to the organization |
| **`DELETE`** | `/api/seller/organizations/{org_id}/members/{member_id}` | Authenticated User | Remove a member from the organization |
| **`PUT`** | `/api/seller/organizations/{org_id}/members/{member_id}/role` | Authenticated User | Update an organization member's role |

---

## Shipping

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/shipping/admin/shipments` | Admin Only | admin_all_shipments |
| **`GET`** | `/api/shipping/admin/shipments/attention-required` | Admin Only | attention_required |
| **`GET`** | `/api/shipping/admin/shipments/stats` | Admin Only | shipping_stats |
| **`POST`** | `/api/shipping/orders/{order_id}/discover-options` | Authenticated User | discover_options |
| **`POST`** | `/api/shipping/orders/{order_id}/manual-book` | Authenticated User | manual_book |
| **`GET`** | `/api/shipping/orders/{order_id}/options` | Authenticated User | get_options |
| **`POST`** | `/api/shipping/orders/{order_id}/ready-to-ship` | Seller Only | ready_to_ship |
| **`GET`** | `/api/shipping/pickup-locations` | Authenticated User | list_pickup_locations |
| **`POST`** | `/api/shipping/pickup-locations` | Seller Only | create_pickup_location |
| **`DELETE`** | `/api/shipping/pickup-locations/{loc_id}` | Authenticated User | delete_pickup_location |
| **`PUT`** | `/api/shipping/pickup-locations/{loc_id}` | Authenticated User | update_pickup_location |
| **`GET`** | `/api/shipping/shipments/{shipment_id}` | Authenticated User | get_shipment |
| **`POST`** | `/api/shipping/shipments/{shipment_id}/cancel` | Authenticated User | cancel_shipment |
| **`POST`** | `/api/shipping/shipments/{shipment_id}/request-pickup` | Authenticated User | request_pickup |
| **`POST`** | `/api/shipping/shipments/{shipment_id}/retry-booking` | Authenticated User | retry_booking |
| **`POST`** | `/api/shipping/sync/{shipment_id}` | Authenticated User | sync_tracking |
| **`GET`** | `/api/shipping/track/{awb}` | Authenticated User | track_by_awb |

---

## Shipping-Webhooks

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/webhooks/shipping/bluedart` | Public | bluedart_webhook |
| **`POST`** | `/api/webhooks/shipping/delhivery` | Public | delhivery_webhook |
| **`POST`** | `/api/webhooks/shipping/dtdc` | Public | dtdc_webhook |
| **`POST`** | `/api/webhooks/shipping/indiapost` | Public | indiapost_webhook |
| **`POST`** | `/api/webhooks/shipping/nimbuspost` | Public | nimbuspost_webhook |
| **`POST`** | `/api/webhooks/shipping/pickrr` | Public | pickrr_webhook |
| **`POST`** | `/api/webhooks/shipping/shiprocket` | Public | shiprocket_webhook |

---

## Storefront

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/storefront/context` | Storefront Context Required | public_storefront_context |

---

## Subscriptions

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/subscriptions/checkout` | Authenticated User | sub_checkout |
| **`GET`** | `/api/subscriptions/plans` | Public | get_plans |

---

## System

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/` | Public | root |
| **`GET`** | `/api/health` | Public | health |
| **`GET`** | `/api/ready` | Public | readiness |
| **`GET`** | `/docs` | Public | swagger_ui_html |
| **`GET`** | `/docs/oauth2-redirect` | Public | swagger_ui_redirect |
| **`GET`** | `/openapi.json` | Public | openapi |
| **`GET`** | `/redoc` | Public | redoc_html |

---

## Users

| Method | Endpoint Path | Auth Requirement | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/users/` | Admin Only | List all users (admin only). |
| **`GET`** | `/api/users/me/addresses` | Authenticated User | Return all saved delivery addresses for the authenticated buyer. |
| **`POST`** | `/api/users/me/addresses` | Authenticated User | Add a new delivery address for the authenticated buyer. |
| **`DELETE`** | `/api/users/me/addresses/{address_id}` | Authenticated User | Delete a delivery address. |
| **`PUT`** | `/api/users/me/addresses/{address_id}` | Authenticated User | Update a saved delivery address. |
| **`GET`** | `/api/users/{user_id}` | Authenticated User | Return a user's public profile by ID. |
| **`PUT`** | `/api/users/{user_id}/status` | Admin Only | Enable or disable a user account (admin only). |

---
