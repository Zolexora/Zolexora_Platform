-- Zolexora IMS schema (Cloudflare D1 / SQLite). Applied by the backend on start; idempotent.
-- Every row belongs to one business: org_id is the Zolexora business id (ZX-ORG-…) from the auth
-- service, and every primary key starts with org_id so one business can never overwrite another's
-- rows. Businesses, people and roles live in the auth service, not here.

CREATE TABLE IF NOT EXISTS stores (
  org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'Active',
  description TEXT,
  PRIMARY KEY (org_id, code)
);

CREATE TABLE IF NOT EXISTS selling_points (
  org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  assigned_store_code TEXT,
  type TEXT,
  status TEXT DEFAULT 'Active',
  PRIMARY KEY (org_id, code)
);

CREATE TABLE IF NOT EXISTS products (
  org_id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  category_code TEXT,
  uom TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 0,
  tax_percent REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  stock_s_001 REAL NOT NULL DEFAULT 0,
  stock_s_002 REAL NOT NULL DEFAULT 0,
  central_stock REAL NOT NULL DEFAULT 0,
  total_stock REAL NOT NULL DEFAULT 0,
  total_valuation REAL NOT NULL DEFAULT 0,
  preferred_supplier_code TEXT,
  status TEXT DEFAULT 'Active',
  last_updated TEXT NOT NULL,
  PRIMARY KEY (org_id, item_code)
);

CREATE TABLE IF NOT EXISTS suppliers (
  org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'Active',
  PRIMARY KEY (org_id, code)
);

CREATE TABLE IF NOT EXISTS supplier_transactions (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  supplier_code TEXT,
  supplier_name TEXT,
  item_code TEXT,
  item_description TEXT,
  category TEXT,
  quantity REAL NOT NULL,
  uom TEXT,
  rate REAL NOT NULL,
  tax_percent REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  receiving_store_code TEXT,
  receiving_store_name TEXT,
  po_invoice_ref TEXT,
  received_by TEXT,
  notes TEXT,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS issuance_transactions (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT DEFAULT 'DISBURSEMENT',
  item_code TEXT,
  item_description TEXT,
  quantity REAL NOT NULL,
  uom TEXT,
  from_store_code TEXT,
  from_store_name TEXT,
  to_selling_point_code TEXT,
  to_selling_point_name TEXT,
  unit_rate REAL NOT NULL,
  total_value REAL NOT NULL,
  requisition_ref TEXT,
  issued_by TEXT,
  status TEXT DEFAULT 'Approved',
  notes TEXT,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS selling_point_sales (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  selling_point_code TEXT,
  selling_point_name TEXT,
  bill_no TEXT,
  customer_name TEXT,
  item_code TEXT,
  item_name TEXT,
  category TEXT,
  quantity REAL NOT NULL,
  uom TEXT,
  rate REAL NOT NULL,
  tax_percent REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  payment_mode TEXT DEFAULT 'Cash',
  payment_status TEXT DEFAULT 'Completed',
  cashier TEXT,
  notes TEXT,
  PRIMARY KEY (org_id, id)
);
CREATE INDEX IF NOT EXISTS idx_sales_org_date ON selling_point_sales (org_id, date);

CREATE TABLE IF NOT EXISTS selling_point_purchases (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  selling_point_code TEXT,
  selling_point_name TEXT,
  source TEXT,
  item_code TEXT,
  item_name TEXT,
  category TEXT,
  quantity REAL NOT NULL,
  uom TEXT,
  cost_rate REAL NOT NULL,
  tax_percent REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL,
  invoice_ref TEXT,
  payment_status TEXT DEFAULT 'Paid',
  received_by TEXT,
  notes TEXT,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS selling_point_expenses (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  selling_point_code TEXT,
  selling_point_name TEXT,
  category TEXT,
  amount REAL NOT NULL,
  payment_mode TEXT,
  paid_to TEXT,
  voucher_ref TEXT,
  recorded_by TEXT,
  status TEXT DEFAULT 'Approved',
  notes TEXT,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS settings (
  org_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  description TEXT,
  PRIMARY KEY (org_id, key)
);

CREATE TABLE IF NOT EXISTS aggregator_orders (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  platform TEXT NOT NULL,
  channel_color TEXT,
  source TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  total_amount REAL NOT NULL,
  payment_status TEXT,
  status TEXT NOT NULL DEFAULT 'NEW',
  rider_json TEXT,
  prep_time_mins INTEGER DEFAULT 20,
  cancel_reason TEXT,
  received_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS customers (
  org_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  tier TEXT DEFAULT 'Silver',
  loyalty_points INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spend REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_visit TEXT,
  PRIMARY KEY (org_id, phone)
);

CREATE TABLE IF NOT EXISTS pos_tables (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  number TEXT NOT NULL,
  section TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'Vacant',
  current_bill REAL DEFAULT 0.0,
  waiter TEXT,
  token TEXT,
  items_count INTEGER DEFAULT 0,
  seated_since TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS cash_drawer_logs (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  cashier TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id, id)
);
