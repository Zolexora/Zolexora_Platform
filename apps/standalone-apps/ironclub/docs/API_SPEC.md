# Zolexora IronClub — REST API Specification

**Base URL**: `http://localhost:4060/api/v1`

## 1. Authentication (`/auth`)
- `POST /auth/login`: Issue JWT token for Admin, Branch Manager, or Member portal.

## 2. Dashboard & Telemetry (`/dashboard`)
- `GET /dashboard/overview`: Fetch live in-gym headcount, capacity percentage, today's checkins, MRR, and peak-hour footfall curves.

## 3. Smart Access & IoT Turnstiles (`/access`)
- `POST /access/verify`: High-speed credential validation for optical and RFID turnstile hardware.
- `GET /access/devices`: Retrieve list of all gate controllers, IP addresses, latency, and cycle counts.
- `POST /access/devices/{device_id}/unlock`: Trigger instantaneous manual pulse release (default 5s).
- `POST /access/devices/{device_id}/lockdown`: Place hardware gate in emergency security lockdown.
- `GET /access/logs`: Live stream of access events with filter by decision (GRANTED / DENIED).

## 4. Members Directory (`/members`)
- `GET /members`: Filterable member query (by name, phone, RFID, plan tier, or status).
- `GET /members/{id}`: Detailed member record with attendance history, emergency contact, locker #.
- `POST /members`: Register new gym member with automated QR/RFID provisioning.
- `PATCH /members/{id}/status`: Toggle member status (ACTIVE, FROZEN, EXPIRED, SUSPENDED).

## 5. Classes & Studios (`/classes`)
- `GET /classes`: Schedule of upcoming classes (CrossFit, Powerlifting, HIIT, Yoga).
- `POST /classes/book`: Member spot reservation with capacity checking & waitlists.
- `POST /classes/{id}/cancel`: Cancellation with automated waitlist bump.

## 6. Smart Equipment Fleet (`/equipment`)
- `GET /equipment`: Machine catalog, operational status, total usage run-hours.
- `POST /equipment/tickets`: File preventative maintenance and repair dispatch tickets.

## 7. Billing & Memberships (`/billing`)
- `GET /billing/plans`: Catalog of pricing tiers (Bronze, Silver, Gold, Black Iron VIP).
- `GET /billing/invoices`: Invoice ledgers with GST tax breakdown.
- `POST /billing/checkout/initiate`: Create payment order (Razorpay, Cashfree, UPI Dynamic QR).

## 8. Pro-Shop & POS (`/pos`)
- `GET /pos/items`: Inventory catalog (supplements, merchandise, drinks).
- `POST /pos/orders`: Process quick-sale transactions with inventory deduction.
