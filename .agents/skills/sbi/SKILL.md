---
name: sbi
description: Complete integration guide and reference for State Bank of India (SBI) Merchant QR, SBI Payments, YONO SBI Merchant, SBI ePay Gateway, Soundbox, and NPCI Dynamic QR for Zolexora IMS.
---

# State Bank of India (SBI) Merchant QR & Payment Integration Skill

This skill provides complete reference documentation, workflows, and tools for integrating **State Bank of India (SBI)** Merchant QR, **YONO SBI Merchant (SBI Payments)**, **BHIM SBI Pay**, **SBI ePay**, and **SBI Soundbox** into Zolexora IMS.

---

## 1. Overview of SBI Merchant Payment Services

State Bank of India provides merchant acquiring and digital collection services through **SBI Payments** (SBI Payment Services Pvt. Ltd. — a joint venture between SBI and Hitachi Payment Services) and **SBI ePay** (SBI's payment aggregator).

### Key Offerings for Retailers & Merchants:
1. **SBI Merchant UPI QR (Static & Dynamic)**:
   - Instant direct-to-bank settlement into your SBI Current Account.
   - **0% MDR** for standard P2M transactions up to ₹2,000; standard RBI tiers for amounts above.
   - **RuPay Credit Card on UPI**: Fully enabled for SBI Merchant accounts (customers can pay using RuPay CC on Google Pay, PhonePe, Paytm, BHIM, Cred, etc.).
2. **YONO SBI Merchant / YONO Vyapar App**:
   - Mobile merchant dashboard for real-time transaction MIS, refunds, and cashier management.
3. **SBI Soundbox (SBI Payments)**:
   - Dedicated GPRS/4G SIM-enabled hardware device providing loud voice chimes in multiple regional languages upon payment receipt.
4. **SBI ePay Payment Gateway**:
   - Web & API payment gateway for cards, netbanking, and server-to-server dynamic QR generation with webhook confirmation.
5. **SBI BharatQR & EDC POS Machines**:
   - All-in-one Android POS terminals supporting chip/PIN, contactless tap, and dynamic QR display.

---

## 2. Personal Current Account (Individual Current Account) Explained

### What is a Personal Current Account?
In Indian banking (including SBI), a **Personal Current Account** (officially classified as an **Individual Current Account**) is a demand deposit account opened in the name of an individual person (e.g. *Rajesh Kumar* or *Rajesh Kumar trading as ABC Store*) rather than an incorporated entity like a Private Limited Company, LLP, or Partnership.

It is designed specifically for:
- Sole proprietors and retail shop owners
- Freelancers, consultants, and independent contractors
- Professionals (doctors, lawyers, chartered accountants, architects)
- Small traders, grocery owners, and kiosk operators

### Comparison Matrix: Personal Current vs. Savings vs. Entity Current Account

| Feature / Dimension | Savings Account (P2P) | Personal Current Account (Individual) | Entity / Corporate Current Account |
| :--- | :--- | :--- | :--- |
| **Primary Objective** | Personal savings & wealth accumulation | Commercial transactions, business cash flow | Corporate/Institutional treasury & high-volume trade |
| **Account Name** | Individual's legal name | Individual's legal name OR Individual + Trade Name | Registered entity name (Pvt Ltd, LLP, Partnership) |
| **KYC & Documents** | Aadhaar + PAN only | Aadhaar + PAN + 1 Business Proof (Shop Act, Udyam MSME, or GSTIN) | Certificate of Incorporation, MOA/AOA, Partnership Deed, Board Resolution |
| **Interest Rate** | ~2.70% to 3.00% p.a. (subject to IT deduction) | **0.00%** (RBI mandate on demand deposits) | **0.00%** (RBI mandate on demand deposits) |
| **Transaction Frequency** | Strictly capped (e.g., 20–50 free/month); heavy use flags AML | **Unlimited** debits & credits per month | **Unlimited** debits & credits per month |
| **SFT Cash Reporting (Sec 285BA)** | Triggers tax notice if cash deposits exceed **₹10 Lakhs/yr** | Triggers tax notice if cash deposits exceed **₹50 Lakhs/yr** | Triggers tax notice if cash deposits exceed **₹50 Lakhs/yr** |
| **Merchant Category (UPI)** | P2P (Person to Person) | **P2M (Person to Merchant)** | **P2M (Person to Merchant)** |
| **RuPay Credit Card on UPI** | ❌ **Blocked / Unsupported** | ✅ **Fully Supported** (0% MDR up to ₹2,000) | ✅ **Fully Supported** |
| **Overdraft (OD) Facility** | Rare (only against FD) | ✅ Available (SOD / Clean Overdraft against turnover) | ✅ High-limit Cash Credit (CC) / Overdraft |
| **Daily UPI Limit** | Standard ₹1 Lakh/day (capped by NPCI/banks) | Up to ₹5 Lakhs/day or unlimited for verified merchants | Up to ₹5 Lakhs/day or custom enterprise limits |

### Why You Should NOT Use a Savings Account for Retail Business
1. **Automated Tax Audit Red Flags (SFT/AIS)**: Under Section 285BA of the Income Tax Act, banks automatically submit high-value transaction reports (Form 61A) if cash deposits in a savings account exceed ₹10 Lakhs in a financial year. Commercial transactions in a savings account can trigger scrutiny notices from the Income Tax Department for unexplained cash credits.
2. **Account Freezing / AML Locks**: When algorithms detect hundreds of small incoming UPI credits (retail billing pattern) in a personal savings account, banks flag it for non-personal commercial usage and freeze the account under RBI AML (Anti-Money Laundering) guidelines.
3. **Reconciliation Nightmare**: Business revenue and personal household expenses get mixed together, making bookkeeping, GST returns, and profit-and-loss calculations nearly impossible to audit.
4. **No RuPay Credit Card UPI Payments**: Customers trying to pay with their RuPay credit card will get transaction failures when scanning a savings UPI QR.

### Can You Link an SBI Personal Current Account to Merchant QR?
**Yes, absolutely 100%!**
- When opening an Individual Current Account at SBI, you receive account number, cheque book, net banking credentials, and an IFSC (`SBIN00xxxxx`).
- You can onboard this account immediately onto **YONO SBI Merchant (YONO Vyapar)**, **BHIM SBI Pay**, **Google Pay for Business**, **PhonePe Business**, or **Paytm for Business**.
- These platforms assign a **Merchant VPA** (e.g. `yourbrand@sbi` or `yourname.merchant@okhdfcbank`) categorized under NPCI Merchant Category Code (MCC).
- This VPA can be configured directly in Zolexora IMS under **POS Settings -> Payment Settings**, enabling real-time dynamic QR generation at checkout.

---

## 3. How to Get an SBI Bank Merchant QR

Merchants with an SBI Current Account can acquire an official Merchant QR in three ways:

### Method A: Instant Digital Registration via YONO SBI Merchant App
1. Download **YONO SBI Merchant** from the Google Play Store or Apple App Store.
2. Enter your registered mobile number linked with your SBI Current Account.
3. Enter OTP and authenticate using your SBI Net Banking credentials or Corporate Internet Banking (CINB).
4. Fill in Business Details: Legal Entity Name, Shop Name, Merchant Category (MCC), and PAN/GSTIN.
5. Your **Merchant Virtual Payment Address (VPA)** and digital QR code are generated immediately.

### Method B: BHIM SBI Pay (Business Tab)
1. Open **BHIM SBI Pay** app.
2. Navigate to the **Business** tab.
3. Select **Enroll as Merchant** and link your SBI Current Account.
4. Set up your customized VPA handle (e.g., `yourbusiness@sbi`).

### Method C: 100% Offline Branch Walk-in (Without Online / Without Mobile App)
If the merchant does NOT want to use net banking, smartphones, or mobile apps:
1. **Visit the nearest SBI Branch** (Commercial / Retail Branch):
   - Request the physical **"Account Opening Form for Non-Individuals / Sole Proprietorship (Current Account)"**.
2. **Submit Physical Paper Documents**:
   - **Personal KYC**: Self-attested physical photocopies of **PAN Card** and **Aadhaar Card** + 2 passport photos.
   - **Business KYC**: Any **1** physical registration proof:
     - Municipal Trade License or Shop & Establishment Act Certificate.
     - Printed Udyam Registration (MSME) certificate.
     - GST Certificate (Form GST REG-06).
     - Utility Bill (Electricity/Water) in the name of the proprietor/firm.
   - **Initial Deposit / MAB**: Deposit initial cheque or cash (₹5,000 for rural/semi-urban, ₹10,000 for metro/urban branches).
3. **Physical Deliverables Received (No Online / Mobile required)**:
   - **Welcome Letter** with printed Account Number and IFSC (`SBIN00xxxxx`).
   - **Physical CTS-2010 Cheque Book** (25/50 leaves for branch and vendor payments).
   - **SBI Business Debit Card** (RuPay / Visa Business Card for ATM cash and POS swipes).
   - **Physical Passbook / Printed Monthly Statements** (printed directly at the branch self-service kiosk or counter).

### Operating Merchant Payments Without a Smartphone or Mobile App
A retail store can accept UPI, QR, and RuPay Credit Card payments **with zero smartphone or mobile app dependency**:
1. **Physical Printed Standee QR (Static QR)**:
   - The SBI branch or SBI Payments executive issues an **acrylic standee QR code** with your shop name and SBI VPA (`yourshop@sbi`).
   - Place this physical board on the billing counter. Customers scan it with their own smartphones. The merchant counter needs NO mobile device.
2. **Standalone SBI SIM-Based Hardware Soundbox**:
   - SBI Payments provides a physical **voice soundbox** equipped with an **internal 4G/2G SIM card**.
   - **100% Independent**: Does NOT pair via Bluetooth, Wi-Fi, or any mobile phone.
   - Speaks instant audio confirmations in English, Hindi, or regional languages whenever a customer pays (e.g., *"State Bank of India — Received ₹350 on UPI"*).
3. **Basic SMS on Any Keypad / Feature Phone**:
   - Link any basic ₹1,000 keypad phone (Nokia, Samsung Guru, etc.) as your registered mobile number.
   - Receives instant transactional SMS from `SBI-PAY` with the amount and 12-digit UTR for every payment.
4. **Standalone SBI EDC POS Terminal**:
   - Handheld terminal with its own built-in SIM card and thermal printer.
   - Accepts card chip/tap and displays dynamic UPI QR on the terminal screen, printing physical charge slips immediately.
5. **In Zolexora IMS (Desktop/Laptop)**:
   - Zolexora IMS runs on your desktop computer or billing POS terminal.
   - Enter your SBI Merchant VPA in **POS Settings**.
   - Dynamic QR is displayed on the PC screen or printed on the thermal bill receipt.
   - Zero smartphone required at the checkout counter!

---

## 4. SBI Merchant VPA (UPI ID) Handles & Specs

SBI Merchant accounts are assigned VPAs under standard banking handles:

| Handle Format | Service Provider | Example | Usage |
| :--- | :--- | :--- | :--- |
| `username@sbi` | State Bank of India Core UPI | `zolexorastore@sbi` | Counter UPI, Dynamic QR |
| `username@sbiepay` | SBI ePay Aggregator | `zolexora@sbiepay` | PG Checkout & Webhooks |
| `mobile.terminal@sbi` | YONO SBI Merchant App | `9876543210.01@sbi` | Terminal-specific VPA |
| `username@sbiyono` | YONO Vyapar Portal | `zolexora@sbiyono` | Merchant business portal |

### NPCI Dynamic UPI Intent URI Specification
Zolexora IMS constructs dynamic payment intent links conforming to the NPCI UPI Merchant specification:
```text
upi://pay?pa={sbi_vpa}&pn={legal_name}&mc={mcc}&am={amount_2_dec}&cu=INR&tn={transaction_note}
```

* **`pa` (Payee Address)**: Your SBI Merchant VPA (e.g. `zolexora@sbi`).
* **`pn` (Payee Name)**: Registered business name with SBI (URL-encoded).
* **`mc` (Merchant Category Code)**:
  - `5812`: Eating Places & Restaurants
  - `5814`: Fast Food & Specialty Cafes
  - `5411`: Grocery Stores & Supermarkets
  - `5311`: Department & Retail Stores
  - `5691`: Men's & Women's Apparel
  - `5912`: Drug Stores & Pharmacies
* **`am` (Amount)**: Exact bill amount formatted to 2 decimal places (e.g. `450.00`).
* **`cu` (Currency)**: `INR`.
* **`tn` (Transaction Note)**: Order or bill reference (e.g. `Bill_904120`).

---

## 5. RuPay Credit Card on UPI Acceptance

One of the greatest advantages of an official SBI Merchant VPA over a personal savings UPI ID is **RuPay Credit Card acceptance**:
- **Personal UPI IDs (`@oksbi`, `@sbi` on savings accounts)**: Customers **CANNOT** pay using their credit cards; transactions fail with *"Payment not supported by payee account"*.
- **SBI Merchant Current Account VPAs**: Fully support **RuPay Credit Card on UPI** payments. Customers can link their RuPay credit card to GPay/PhonePe/Paytm and pay at your counter.
- **MDR Guidelines**:
  - Transactions up to ₹2,000 via RuPay CC on UPI are subject to 0% MDR for small merchants (annual turnover < ₹20 Lakhs).
  - Standard interchange charges apply for large merchants or transactions above ₹2,000 as per RBI/NPCI directives.

---

## 6. Verification Mechanics in Zolexora IMS

Because Direct Dynamic UPI QR is direct-to-bank without an intermediary aggregator holding your funds, verification in Zolexora IMS is optimized through multiple layers:

1. **Instant Voice Soundbox**:
   - Both physical SBI GPRS Soundbox and built-in Web Speech API announce: *"Received payment of ₹X successfully via UPI"*.
2. **Bank UTR (Unique Transaction Reference)**:
   - When the customer pays, their banking app displays a 12-digit UTR (e.g., `424518920145`).
   - The cashier can optionally input the last 4 to 6 digits into the settlement modal to reconcile the invoice.
3. **SBI YONO Merchant App / Push SMS**:
   - The cashier or store manager receives instant push notification / SMS from `SBI-PAY` with the amount and reference number.
4. **SBI ePay Webhook Integration**:
   - If using SBI ePay gateway credentials, server-to-server HTTP POST callbacks notify `POST /api/v1/payment/sbi/webhook` to automatically mark bills as settled.

---

## 7. Configuring SBI Merchant QR in Zolexora IMS

### Step 1: Open Terminal Settings
1. Navigate to **POS Settings** (`/pos/settings`) in Zolexora IMS.
2. Under **Merchant Payment Rails & Gateways**, select **Direct Dynamic UPI QR**.
3. Fill in:
   - **Merchant UPI Handle (VPA)**: Enter your SBI handle (e.g. `yourbrand@sbi`).
   - **Legal Payee / Business Name**: Enter your name as registered with SBI (e.g. `Zolexora Retail Operations`).
   - **Merchant Category Code (MCC)**: Select your business type (e.g. `5812` for dining/cafe).
   - **Voice Soundbox Audio**: Check **Enable Soundbox voice confirmations**.
4. Click **Save Configuration** (persisted directly to Cloudflare D1 / SQLite database).

### Step 2: Taking Customer Payments
1. In POS Dashboard (`/pos/dashboard`), add items to cart.
2. Select **UPI / QR** as the payment method.
3. The high-resolution Dynamic QR code opens with the exact bill total and your SBI VPA.
4. Customer scans using Google Pay, PhonePe, Paytm, or BHIM.
5. Soundbox chimes and bill settles with zero intermediary deduction.

---

## 8. Useful SBI Merchant Contact Channels
- **SBI Payments Official Portal**: [https://www.sbipayments.com](https://www.sbipayments.com)
- **SBI ePay Gateway**: [https://www.sbiepay.sbi](https://www.sbiepay.sbi)
- **SBI Merchant Support Email**: `merchantdesk@sbipayments.com` / `support.sbiepay@sbi.co.in`
- **Merchant Helpdesk Phone**: `1800 11 2211` / `+91-22-2753 5773`
