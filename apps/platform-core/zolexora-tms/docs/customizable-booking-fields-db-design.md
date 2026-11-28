# Customizable Booking Fields — Unified Database & Architecture Design

> **Core Principles:**
> 1. Every business on **Zolexora Auth Service** (`apps/auth-service`, 3-Track Auth) has one globally unique **Zolexora ID** in the format **`<userid>@zolexora.com`** (e.g. `infosys@zolexora.com`, `denebpollux@zolexora.com`), where `<userid>` is chosen by the user and unique in the Auth database.
> 2. **Creating a Client or Service Provider via Auth Service:**
>    - **Connected Zolexora TMS user** (`is_zolexora_user = true`) → verified against Auth Service and stored directly as `<userid>@zolexora.com` in `client_code` / `vendor_code`.
>    - **External / Non-TMS partner** (`is_zolexora_user = false`) → Auth Service reserves a unique ID in the **same `@zolexora.com` format** with prefix `c` (Client) or `v` (Vendor / Service Provider) + random digits, stored in both Auth DB and TMS (`client_code` / `vendor_code`):
>      - External Client: **`c<random>@zolexora.com`** (e.g. `c84920173@zolexora.com`)
>      - External Vendor (Service Provider): **`v<random>@zolexora.com`** (e.g. `v51930482@zolexora.com`)
> 3. **No `NULL` `partner_id` in `booking_field_schemas`:**
>    - Every schema row has a non-null `partner_id` (`UUID`):
>      - For `ORG_SELF`: `partner_id = organisation_id` (points to its own `organisations.id`).
>      - For `PARTNER_CLIENT`: `partner_id = clients.id` (points to that client row).
>      - For `PARTNER_VENDOR`: `partner_id = vendors.id` (points to that vendor / SP row).
> 4. **Client Rules + SP Extra Fields (Merge Model):**
>    - A connected Client's `ORG_SELF` rules are **enforced & locked** (SP cannot hide or weaken them).
>    - **AND** the SP can **add extra fields on top** in their `PARTNER_CLIENT` row for their own internal tracking (e.g. `Internal Batch`, `SP Ref No`). Both sets merge together on the booking form!

---

## 1. How Partners Are Identified (Single `@zolexora.com` ID Column)

| Partner Type | Zolexora TMS User? | Value in `client_code` / `vendor_code` | Auth DB Uniqueness |
|---|---|---|---|
| **Connected Client** | Yes (`is_zolexora_user = true`) | `<userid>@zolexora.com` *(their chosen Zolexora ID)* | Verified in Auth DB |
| **External Client** | No (`is_zolexora_user = false`) | `c<random>@zolexora.com` *(auto-generated)* | Reserved unique in Auth DB |
| **Connected Service Provider** | Yes (`is_zolexora_user = true`) | `<userid>@zolexora.com` *(their chosen Zolexora ID)* | Verified in Auth DB |
| **External Service Provider** | No (`is_zolexora_user = false`) | `v<random>@zolexora.com` *(auto-generated)* | Reserved unique in Auth DB |

---

## 2. Schema Table: `booking_field_schemas` (Zero `NULL` `partner_id`)

One shared, Alembic-managed, RLS-protected table:
- `organisation_id`: Owner workspace (`organisations.id`)
- `schema_scope`: `'ORG_SELF'`, `'PARTNER_CLIENT'`, or `'PARTNER_VENDOR'`
- `partner_id` (`UUID`, `NOT NULL`):
  - When `schema_scope = 'ORG_SELF'` → `partner_id = organisation_id` (itself!)
  - When `schema_scope = 'PARTNER_CLIENT'` → `partner_id = clients.id`
  - When `schema_scope = 'PARTNER_VENDOR'` → `partner_id = vendors.id`
- `schema_name`: Unique human-readable name per org (e.g. `XYZ_CARGO_MAIN`, `INFY_ETS_MASTER`)

---

## 3. Concrete Example Tables (At Scale: 10,000+ Organisations)

### A. `organisations`
| `id` (`UUID` PK) | `name` | `zolexora_org_id` | Roles Enabled |
|---|---|---|---|
| `11111111-aaaa-4000-8000-000000000001` | Deneb & Pollux Tours & Travels | `denebpollux@zolexora.com` | Service Provider |
| `22222222-bbbb-4000-8000-000000000002` | Infosys Bengaluru | `infosys@zolexora.com` | Client |
| `33333333-cccc-4000-8000-000000000003` | Apex Logistics | `apexlogistics@zolexora.com` | Service Provider + Client |

### B1. `clients` (Partner Clients Directory)
| `id` (`UUID` PK) | `organisation_id` (`UUID` FK → `organisations.id`) | `name` | `is_zolexora_user` | `client_code` (`<userid>@zolexora.com` or `c<random>@zolexora.com`) |
|---|---|---|---|---|
| `c1010000-0000-4000-8000-000000000101` | `11111111-aaaa-4000-8000-000000000001` | XYZ Logistics *(Non-TMS)* | `false` | `c84920173@zolexora.com` |
| `c1020000-0000-4000-8000-000000000102` | `11111111-aaaa-4000-8000-000000000001` | Infosys Bengaluru *(Connected)* | `true` | `infosys@zolexora.com` |
| `c1030000-0000-4000-8000-000000000103` | `33333333-cccc-4000-8000-000000000003` | Tata Retail *(Non-TMS)* | `false` | `c31940285@zolexora.com` |

### B2. `vendors` (Partner Service Providers Directory)
| `id` (`UUID` PK) | `organisation_id` (`UUID` FK → `organisations.id`) | `name` | `is_zolexora_user` | `vendor_code` (`<userid>@zolexora.com` or `v<random>@zolexora.com`) |
|---|---|---|---|---|
| `v2010000-0000-4000-8000-000000000201` | `22222222-bbbb-4000-8000-000000000002` | Deneb & Pollux *(Connected SP)* | `true` | `denebpollux@zolexora.com` |
| `v2020000-0000-4000-8000-000000000202` | `22222222-bbbb-4000-8000-000000000002` | Local Cab Partner *(Non-TMS SP)* | `false` | `v51930482@zolexora.com` |
| `v2030000-0000-4000-8000-000000000203` | `11111111-aaaa-4000-8000-000000000001` | Western Fleet Logistics *(Non-TMS)* | `false` | `v90412763@zolexora.com` |

### C. `booking_field_schemas` (Non-Null `partner_id` on Every Row)
| `id` (`UUID` PK) | `organisation_id` (`UUID` FK) | `schema_scope` | `partner_id` (`UUID` NOT NULL) | `schema_name` *(Unique)* | `preset_type` | `standard_fields` (`JSONB`) | `custom_fields` (`JSONB`) |
|---|---|---|---|---|---|---|---|
| `f0010000-0000-4000-8000-000000000001` | `11111111-aaaa-4000-8000-000000000001` | `PARTNER_CLIENT` | `c1010000-0000-4000-8000-000000000101` | `XYZ_CARGO_MAIN` | `CARGO_STANDARD` | `{"passenger_name":"HIDDEN","eway_bill_number":"REQUIRED"}` | `[{"key":"lr_no","label":"LR Number","type":"text","required":true,"allowed":[],"not_allowed":["TEST","DUMMY"]}]` |
| `f0020000-0000-4000-8000-000000000002` | `22222222-bbbb-4000-8000-000000000002` | `ORG_SELF` | `22222222-bbbb-4000-8000-000000000002` *(Itself!)* | `INFY_ETS_MASTER` | `PASSENGER_STANDARD` | `{"passenger_name":"REQUIRED","shift_label":"REQUIRED"}` | `[{"key":"emp_id","label":"Employee ID","type":"text","required":true,"allowed":[],"not_allowed":["GUEST"]},{"key":"cost_center","label":"Cost Center","type":"select","required":true,"allowed":["IT","OPS","HR"],"not_allowed":["PERSONAL"]}]` |
| `f0050000-0000-4000-8000-000000000005` | `11111111-aaaa-4000-8000-000000000001` | `PARTNER_CLIENT` | `c1020000-0000-4000-8000-000000000102` *(SP extras for Infosys)* | `DP_INFY_EXTRAS` | `PASSENGER_STANDARD` | `{}` | `[{"key":"sp_dispatch_batch","label":"SP Dispatch Batch","type":"text","required":false,"allowed":[],"not_allowed":[]}]` |
| `f0030000-0000-4000-8000-000000000003` | `33333333-cccc-4000-8000-000000000003` | `ORG_SELF` | `33333333-cccc-4000-8000-000000000003` *(Itself!)* | `APEX_SELF_BOOKING` | `CUSTOM` | `{"estimated_pricing":"REQUIRED"}` | `[{"key":"dept_code","label":"Dept Code","type":"text","required":true,"allowed":["OPS","FIN"],"not_allowed":[]}]` |

### D. `booking_requests` & `bookings`
> *Note: `organisation_id` (RLS owner) and `customer_id` (Client FK) are existing live columns in PostgreSQL; `vendor_id` (Service Provider FK) can be added alongside them without breaking existing queries.*

| `id` (`UUID` PK) | `organisation_id` *(RLS Owner)* | `customer_id` *(Client FK → `clients.id`)* | `vendor_id` *(SP FK → `vendors.id`, optional)* | `booking_number` | `booking_type` | `schema_name` *(Snapshot)* | `custom_fields` (`JSONB`) |
|---|---|---|---|---|---|---|---|
| `b9010000-0000-4000-8000-000000009001` | `11111111-aaaa-4000-8000-000000000001` | `c1010000-0000-4000-8000-000000000101` | `v2030000-0000-4000-8000-000000000203` | `BK-2026-8F12A01` | `COLD_CHAIN` | `XYZ_CARGO_MAIN` | `{"lr_no": "LR-88421"}` |
| `b9020000-0000-4000-8000-000000009002` | `11111111-aaaa-4000-8000-000000000001` | `c1020000-0000-4000-8000-000000000102` | `NULL` *(Self-fulfilled by SP)* | `BK-2026-9C34B12` | `ETS_SHUTTLE` | `INFY_ETS_MASTER + DP_INFY_EXTRAS` | `{"emp_id": "INF-40291", "cost_center": "IT", "sp_dispatch_batch": "B-12"}` |

---

## 4. Merge & Resolution Flow (Client Rules + SP Extras)

### Case 1: Service Provider (Deneb & Pollux) creates a booking for a Client (e.g. Infosys `c102...`)
```
1. Read `clients` row for `customer_id`.
2. Load SP's own `PARTNER_CLIENT` row (`partner_id = c102...`, e.g. `DP_INFY_EXTRAS`).
3. Is `is_zolexora_user = true`?
   └── YES → Look up `organisations` where `zolexora_org_id = client.client_code` (`infosys@zolexora.com`).
             Load Infosys's `ORG_SELF` row (`partner_id = 22222222-...`, `INFY_ETS_MASTER`).
4. MERGE both cleanly:
   - Standard fields: Stricter rule wins (`REQUIRED` > `OPTIONAL` > `HIDDEN`). SP cannot hide or downgrade a field that Infosys marked `REQUIRED`.
   - Custom fields: Infosys's `ORG_SELF` fields appear first (marked **Locked by Client**), followed by Deneb & Pollux's extra `PARTNER_CLIENT` fields (e.g. `SP Dispatch Batch`).
```

### Case 2: Organisation creating a booking for itself (`Book Transport` / Self-Booking)
```
1. Read current org's `ORG_SELF` row (`partner_id = current_org_id`).
2. Works identically whether the selected Service Provider in `vendors` has:
   - `<userid>@zolexora.com` (`is_zolexora_user = true`), OR
   - `v<random>@zolexora.com` (`is_zolexora_user = false`).
```

---

## 5. Compulsory Rules, Comma-Separated Validation & Lifecycle

1. **Compulsory on Client Creation:** Requires choosing a **Preset** (`PASSENGER_STANDARD`, `CARGO_STANDARD`) or **Custom** schema with a unique `schema_name`.
2. **Comma-Separated Allowed / Not Allowed Rules:**
   - Entered as comma-separated values (e.g. `IT, OPS, HR`) with live pill previews.
   - Overlap check rejects saving if any value is in both `allowed` and `not_allowed`.
   - Enforced on both UI and API (`POST /booking-requests`, `POST /bookings`, `POST /bookings/bulk`).
3. **Full Lifecycle Carry-Through:**
   - `BookingRequest` → `Booking` → `Duty` (shown on Duty & Dispatch) → `Invoice` (snapshot stored on invoice metadata/lines).
