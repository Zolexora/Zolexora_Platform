-- ====================================================================
-- Zolexora IMS — Cloudflare D1 Relational Database Initial Schema
-- ====================================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  owner_email TEXT,
  currency TEXT DEFAULT '₹',
  status TEXT DEFAULT 'Active',
  created_at TEXT NOT NULL
);

-- 2. Stores (Inventory Stores / Warehouses)
CREATE TABLE IF NOT EXISTS stores (
  code TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'Active',
  description TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 3. Selling Points (Counters, Outlets, POS Desks)
CREATE TABLE IF NOT EXISTS selling_points (
  code TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  assigned_store_code TEXT,
  type TEXT,
  status TEXT DEFAULT 'Active',
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_store_code) REFERENCES stores(code) ON DELETE SET NULL
);

-- 4. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  scope_type TEXT DEFAULT 'ALL', -- 'ALL', 'STORE', 'SELLING_POINT'
  assigned_location TEXT DEFAULT 'ALL', -- 'ALL', 'S_001', 'SP_001'
  location_name TEXT,
  status TEXT DEFAULT 'Active',
  supabase_auth_id TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);

-- 5. Products & Inventory
CREATE TABLE IF NOT EXISTS products (
  item_code TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 6. Suppliers Master
CREATE TABLE IF NOT EXISTS suppliers (
  code TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'Active',
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 7. Supplier Transactions (Purchase Orders & Stock Inwards)
CREATE TABLE IF NOT EXISTS supplier_transactions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_code) REFERENCES suppliers(code) ON DELETE SET NULL,
  FOREIGN KEY (item_code) REFERENCES products(item_code) ON DELETE SET NULL,
  FOREIGN KEY (receiving_store_code) REFERENCES stores(code) ON DELETE SET NULL
);

-- 8. Issuance Transactions (Store to Selling Point stock transfers)
CREATE TABLE IF NOT EXISTS issuance_transactions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (item_code) REFERENCES products(item_code) ON DELETE SET NULL,
  FOREIGN KEY (from_store_code) REFERENCES stores(code) ON DELETE SET NULL,
  FOREIGN KEY (to_selling_point_code) REFERENCES selling_points(code) ON DELETE SET NULL
);

-- 9. Selling Point Sales
CREATE TABLE IF NOT EXISTS selling_point_sales (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (selling_point_code) REFERENCES selling_points(code) ON DELETE SET NULL,
  FOREIGN KEY (item_code) REFERENCES products(item_code) ON DELETE SET NULL
);

-- 10. Selling Point Purchases (Direct local purchasing)
CREATE TABLE IF NOT EXISTS selling_point_purchases (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (selling_point_code) REFERENCES selling_points(code) ON DELETE SET NULL,
  FOREIGN KEY (item_code) REFERENCES products(item_code) ON DELETE SET NULL
);

-- 11. Selling Point Expenses
CREATE TABLE IF NOT EXISTS selling_point_expenses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (selling_point_code) REFERENCES selling_points(code) ON DELETE SET NULL
);

-- 12. Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  value TEXT,
  description TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ====================================================================
-- Initial Seed Data
-- ====================================================================

INSERT OR IGNORE INTO organizations (id, name, industry, owner_email, currency, status, created_at)
VALUES ('ORG_ZOLEXORA_001', 'Zolexora_1''s org', 'Retail & E-Commerce', 'admin@zolexora.com', '₹', 'Active', '2026-09-04T00:00:00.000Z');

INSERT OR IGNORE INTO stores (code, org_id, name, type, status, description) VALUES
('S_001', 'ORG_ZOLEXORA_001', 'Store 1 - Main Branch', 'Main Outlet Store', 'Active', 'Primary inventory depot'),
('S_002', 'ORG_ZOLEXORA_001', 'Store 2 - Outlet Branch', 'Outlet Store', 'Active', 'Secondary distribution outlet'),
('S_000', 'ORG_ZOLEXORA_001', 'Central Depot Warehouse', 'Central Depot', 'Active', 'Central replenishment warehouse');

INSERT OR IGNORE INTO selling_points (code, org_id, name, assigned_store_code, type, status) VALUES
('SP_001', 'ORG_ZOLEXORA_001', 'Front Counter / Retail Sales', 'S_001', 'Front Operations', 'Active'),
('SP_002', 'ORG_ZOLEXORA_001', 'Branch Dispenser Counter', 'S_002', 'Outlet Counter', 'Active'),
('SP_003', 'ORG_ZOLEXORA_001', 'Main Production / Kitchen', 'S_001', 'Production Unit', 'Active');

INSERT OR IGNORE INTO users (id, org_id, email, password_hash, name, role, scope_type, assigned_location, location_name, status, created_at, last_login) VALUES
('USR_SUPER_001', 'ORG_ZOLEXORA_001', 'superadmin@zolexora.com', 'managed_by_supabase_auth', 'Super Administrator', 'SuperAdmin', 'ALL', 'ALL', 'Global Access (All Stores & SPs)', 'Active', '2026-09-04T00:00:00.000Z', '2026-09-04T00:00:00.000Z'),
('USR_001', 'ORG_ZOLEXORA_001', 'admin@zolexora.com', 'managed_by_supabase_auth', 'Zolexora Admin', 'System Administrator & Owner', 'ALL', 'ALL', 'Global Access (All Stores & SPs)', 'Active', '2026-09-04T00:00:00.000Z', '2026-09-04T00:00:00.000Z'),
('USR_002', 'ORG_ZOLEXORA_001', 'store1@zolexora.com', 'managed_by_supabase_auth', 'Ramesh Sharma', 'Store Incharge', 'STORE', 'S_001', 'Store 1 - Main Branch', 'Active', '2026-09-04T00:00:00.000Z', NULL),
('USR_003', 'ORG_ZOLEXORA_001', 'pos1@zolexora.com', 'managed_by_supabase_auth', 'Pooja Verma', 'Selling Point Cashier', 'SELLING_POINT', 'SP_001', 'Front Counter / Retail Sales', 'Active', '2026-09-04T00:00:00.000Z', NULL),
('USR_004', 'ORG_ZOLEXORA_001', 'pos2@zolexora.com', 'managed_by_supabase_auth', 'Sunil Kumar', 'Selling Point Cashier', 'SELLING_POINT', 'SP_002', 'Branch Dispenser Counter', 'Active', '2026-09-04T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO suppliers (code, org_id, name, category, contact_person, phone, email, status) VALUES
('SUP_001', 'ORG_ZOLEXORA_001', 'A.T. Overseas', 'Imported Gourmet & Dry Foods', 'Mr. Amit Thapar', '+91 98101 23456', 'sales@atoverseas.com', 'Active'),
('SUP_002', 'ORG_ZOLEXORA_001', 'Agarwal Enterprises', 'Provisions & Kirana', 'Mr. R. K. Agarwal', '+91 98112 34567', 'agarwal.ent@gmail.com', 'Active'),
('SUP_003', 'ORG_ZOLEXORA_001', 'Ajay Cold Drinks', 'Beverages & Soft Drinks', 'Mr. Ajay Verma', '+91 98123 45678', 'ajaycolddrinks@yahoo.com', 'Active'),
('SUP_004', 'ORG_ZOLEXORA_001', 'Bankey Behari Dairy & Paneer Bhandar', 'Fresh Dairy, Paneer & Mawa', 'Mr. Bankey Lal', '+91 98134 56789', 'bbdairy@gmail.com', 'Active'),
('SUP_005', 'ORG_ZOLEXORA_001', 'Chef''s Bakeology Ifo Dayal Singh', 'Breads, Buns & Pastries', 'Chef Dayal Singh', '+91 98145 67890', 'bakeology@outlook.com', 'Active'),
('SUP_006', 'ORG_ZOLEXORA_001', 'Deepak Stationery Mart', 'Office Stationery & Billing Paper', 'Mr. Deepak Jain', '+91 98156 78901', 'deepakstationery@gmail.com', 'Active'),
('SUP_007', 'ORG_ZOLEXORA_001', 'Design Xpress', 'Menu Cards, Collateral & Printing', 'Mr. Nitin Saxena', '+91 98167 89012', 'print@designxpress.in', 'Active'),
('SUP_008', 'ORG_ZOLEXORA_001', 'Essel Charcoals', 'Tandoor Charcoal & Fuel', 'Mr. S. L. Singhania', '+91 98178 90123', 'esselcharcoals@gmail.com', 'Active'),
('SUP_009', 'ORG_ZOLEXORA_001', 'Friends Electric Works', 'Lighting, Bulbs & Electricals', 'Mr. Joginder Pal', '+91 98189 01234', 'friendselectric@gmail.com', 'Active'),
('SUP_010', 'ORG_ZOLEXORA_001', 'Goodwill Traders', 'General Hospitality Hardware', 'Mr. Manpreet Singh', '+91 98190 12345', 'goodwilltraders@gmail.com', 'Active'),
('SUP_011', 'ORG_ZOLEXORA_001', 'Hari Shankar Singh', 'Vegetables & Fresh Greens', 'Mr. Hari Shankar', '+91 98201 23456', 'harishankar.fresh@gmail.com', 'Active'),
('SUP_012', 'ORG_ZOLEXORA_001', 'Hot Cakes Private Limited', 'Confectionery & Special Cakes', 'Ms. Ananya Roy', '+91 98212 34567', 'orders@hotcakes.co.in', 'Active'),
('SUP_013', 'ORG_ZOLEXORA_001', 'Jai Guru Ji Traders', 'Spices, Masala & Seasonings', 'Mr. Gurpreet Sethi', '+91 98223 45678', 'jaigurujitraders@gmail.com', 'Active'),
('SUP_014', 'ORG_ZOLEXORA_001', 'K B Kulfi', 'Traditional Kulfi & Ice Creams', 'Mr. Kailash B.', '+91 98234 56789', 'kbkulfi@gmail.com', 'Active'),
('SUP_015', 'ORG_ZOLEXORA_001', 'Kanshi Ram Enterprises', 'Commercial Kitchen Crockery', 'Mr. Kanshi Ram', '+91 98245 67890', 'krrkitchenware@gmail.com', 'Active'),
('SUP_016', 'ORG_ZOLEXORA_001', 'L R Wholesale Services Pvt. Ltd.', 'Bulk Institutional Supplies', 'Mr. Lalit Rao', '+91 98256 78901', 'info@lrwholesale.com', 'Active'),
('SUP_017', 'ORG_ZOLEXORA_001', 'M S Manufactures and Distributors Pvt Ltd.', 'Linens & Table Runners', 'Mr. M. S. Sodhi', '+91 98267 89012', 'msdistributors@gmail.com', 'Active'),
('SUP_018', 'ORG_ZOLEXORA_001', 'MR International', 'Premium Cutlery & Holloware', 'Mr. Manish Rawat', '+91 98278 90123', 'mrinternational@gmail.com', 'Active'),
('SUP_019', 'ORG_ZOLEXORA_001', 'Navpallav Agro Products Pvt. Ltd', 'Grains, Basmati Rice & Pulses', 'Mr. Pallav Gupta', '+91 98289 01234', 'agro@navpallav.com', 'Active'),
('SUP_020', 'ORG_ZOLEXORA_001', 'New Harry Store', 'Imported Condiments & Syrups', 'Mr. Harinder Suri', '+91 98290 12345', 'harrystore@gmail.com', 'Active'),
('SUP_021', 'ORG_ZOLEXORA_001', 'Pindi Kirana Store', 'Premium Tea, Sugar & Dry Grocery', 'Mr. Satish Pindi', '+91 98301 23456', 'pindikirana@gmail.com', 'Active'),
('SUP_022', 'ORG_ZOLEXORA_001', 'Rajesh Kumar (29 Jaguar)', 'Poultry & Fresh Meats', 'Mr. Rajesh Kumar', '+91 98312 34567', 'rajesh29jaguar@gmail.com', 'Active'),
('SUP_023', 'ORG_ZOLEXORA_001', 'Sms Commercial', 'Takeaway Cups, Boxes & Disposables', 'Mr. Sanjay Mishra', '+91 98323 45678', 'smscommercial@gmail.com', 'Active'),
('SUP_024', 'ORG_ZOLEXORA_001', 'Sms Housekeeping', 'Cleaning Chemicals & Detergents', 'Mr. S. M. Sharma', '+91 98334 56789', 'smshk@gmail.com', 'Active'),
('SUP_025', 'ORG_ZOLEXORA_001', 'Sms Marketing Solutions', 'Branded Signage & Packaging', 'Mr. Shivam Malhotra', '+91 98345 67890', 'smsmarketing@gmail.com', 'Active'),
('SUP_026', 'ORG_ZOLEXORA_001', 'SRD Traders', 'Cooking Oils & Ghee', 'Mr. Suresh Dani', '+91 98356 78901', 'srdtraders@gmail.com', 'Active'),
('SUP_027', 'ORG_ZOLEXORA_001', 'T K Traders', 'Cleaning Tools, Brooms & Mops', 'Mr. Tarun Kalra', '+91 98367 89012', 'tktraders@gmail.com', 'Active'),
('SUP_028', 'ORG_ZOLEXORA_001', 'Tulip Enterprises', 'Tissue Paper, Napkins & Foil', 'Ms. Meenakshi Tulip', '+91 98378 90123', 'tulipenterprises@gmail.com', 'Active');

INSERT OR IGNORE INTO products (item_code, org_id, description, category, category_code, uom, rate, tax_percent, min_stock, stock_s_001, stock_s_002, central_stock, total_stock, total_valuation, preferred_supplier_code, status, last_updated) VALUES
('ITM_001', 'ORG_ZOLEXORA_001', 'Special Assam Orthodox Tea Leaves', 'Tea & Beverages', 'CAT_TEA', 'Kg', 650, 5, 10, 25, 15, 40, 80, 52000, 'SUP_021', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_002', 'ORG_ZOLEXORA_001', 'Fresh Cow Milk 1L Pack', 'Dairy & Fresh', 'CAT_DAI', 'Pack', 65, 0, 30, 40, 30, 50, 120, 7800, 'SUP_004', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_003', 'ORG_ZOLEXORA_001', 'Fresh Malai Paneer Block', 'Dairy & Fresh', 'CAT_DAI', 'Kg', 380, 0, 15, 15, 10, 20, 45, 17100, 'SUP_004', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_004', 'ORG_ZOLEXORA_001', 'Artisan Multigrain Bread Loaf', 'Bakery & Desserts', 'CAT_BAK', 'Loaf', 90, 5, 20, 20, 15, 15, 50, 4500, 'SUP_005', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_005', 'ORG_ZOLEXORA_001', 'Kesar Pista Kulfi Sticks', 'Bakery & Desserts', 'CAT_BAK', 'Pcs', 45, 18, 50, 60, 40, 50, 150, 6750, 'SUP_014', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_006', 'ORG_ZOLEXORA_001', 'Hardwood Charcoal Briquettes 10kg', 'Kitchen Fuel', 'CAT_FUE', 'Bags', 850, 18, 10, 15, 5, 15, 35, 29750, 'SUP_008', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_007', 'ORG_ZOLEXORA_001', 'Heavy Duty Floor Cleaner 5L', 'Housekeeping & Hygiene', 'CAT_HK', 'Can', 550, 18, 10, 10, 5, 10, 25, 13750, 'SUP_024', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_008', 'ORG_ZOLEXORA_001', 'A4 Executive Copier Paper 75GSM', 'Stationery & Office', 'CAT_STA', 'Ream', 280, 12, 10, 10, 5, 15, 30, 8400, 'SUP_006', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_009', 'ORG_ZOLEXORA_001', 'LED Warm Spotlight 12W GU10', 'Engineering & Electrical', 'CAT_ENG', 'Pcs', 195, 18, 15, 15, 10, 15, 40, 7800, 'SUP_009', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_010', 'ORG_ZOLEXORA_001', 'Packaged Drinking Water 500ml (Crate 24)', 'Beverages', 'CAT_BEV', 'Crate', 240, 18, 20, 25, 15, 20, 60, 14400, 'SUP_003', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_011', 'ORG_ZOLEXORA_001', 'Basmati Rice Classic 25kg Bag', 'Grocery & Staples', 'CAT_GRO', 'Bags', 2400, 5, 5, 8, 4, 6, 18, 43200, 'SUP_019', 'Active', '2026-09-04T00:00:00.000Z'),
('ITM_012', 'ORG_ZOLEXORA_001', 'Signature Chai Cardboard Cups 150ml (Pack 100)', 'Packaging & Disposables', 'CAT_PAC', 'Pack', 180, 18, 30, 40, 30, 20, 90, 16200, 'SUP_023', 'Active', '2026-09-04T00:00:00.000Z');

-- 13. Online Food & Quick-Commerce Aggregator Orders (Swiggy, Zomato, ONDC, UrbanPiper)
CREATE TABLE IF NOT EXISTS aggregator_orders (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 14. Customer Relationship Management (CRM) & Loyalty
CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  tier TEXT DEFAULT 'Silver',
  loyalty_points INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spend REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_visit TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO settings (key, org_id, value, description) VALUES
('HOTEL_NAME', 'ORG_ZOLEXORA_001', 'Zolexora Retail Operations', 'Organization brand title'),
('CURRENCY_SYMBOL', 'ORG_ZOLEXORA_001', '₹', 'Global currency symbol'),
('INDUSTRY_VERTICAL', 'ORG_ZOLEXORA_001', 'Retail & E-Commerce', 'Selected industry vertical'),
('PAYMENT_HANDLE_CONFIG', 'ORG_ZOLEXORA_001', '{"upi_handle":"zolexora@icici","merchant_name":"Zolexora Retail Operations","merchant_category_code":"5812","payment_gateway":"upi_qr","edc_terminal_id":"PINE_EDC_01","soundbox_enabled":true,"auto_settle":true}', 'Active payment handle and merchant gateway settings'),
('TERMINAL_SETTINGS', 'ORG_ZOLEXORA_001', '{"printer_interface":"network","printer_ip":"192.168.1.180","printer_port":"9100","paper_width":"80mm","auto_cut_paper":true,"drawer_kick_on_cash":true,"kot_printer_ip":"192.168.1.185","auto_print_kot_on_hold":true,"large_token_font":true,"store_legal_name":"Zolexora Retail Operations Pvt Ltd","gstin":"27AABCZ1234F1Z8","store_address":"Shop 4, Ground Floor, Cyber City Boulevard, Mumbai","phone_on_receipt":"+91 98765 43210","receipt_footer":"Thank you for dining with Zolexora! Have a great day.","service_charge_percent":0,"soundbox_enabled":true}', 'Hardware printer, tax metadata and receipt styling');

-- Additional POS Products Seed
INSERT OR IGNORE INTO products (item_code, org_id, description, category, category_code, uom, rate, tax_percent, min_stock, stock_s_001, stock_s_002, central_stock, total_stock, total_valuation, preferred_supplier_code, status, last_updated) VALUES
('P001', 'ORG_ZOLEXORA_001', 'Logitech MX Master 3S Mouse', 'Electronics', 'CAT_ELE', 'Pcs', 8999.0, 18.0, 5, 25, 10, 50, 85, 764915.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P002', 'ORG_ZOLEXORA_001', 'Keychron K2 Mechanical Keyboard', 'Electronics', 'CAT_ELE', 'Pcs', 7499.0, 18.0, 5, 14, 5, 20, 39, 292461.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P003', 'ORG_ZOLEXORA_001', 'Dell UltraSharp 27 4K Monitor', 'Electronics', 'CAT_ELE', 'Pcs', 52000.0, 18.0, 2, 6, 2, 12, 20, 1040000.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P004', 'ORG_ZOLEXORA_001', 'Sony WH-1000XM5 Headphones', 'Audio', 'CAT_AUD', 'Pcs', 29990.0, 18.0, 3, 9, 4, 15, 28, 839720.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P005', 'ORG_ZOLEXORA_001', 'Apple AirPods Pro (2nd Gen)', 'Audio', 'CAT_AUD', 'Pcs', 24900.0, 18.0, 5, 18, 8, 30, 56, 1394400.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P006', 'ORG_ZOLEXORA_001', 'Anker 737 Power Bank (24K)', 'Accessories', 'CAT_ACC', 'Pcs', 12499.0, 18.0, 5, 20, 7, 40, 67, 837433.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P007', 'ORG_ZOLEXORA_001', 'Samsung T7 Shield 2TB SSD', 'Storage', 'CAT_STO', 'Pcs', 16999.0, 18.0, 5, 15, 6, 25, 46, 781954.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P008', 'ORG_ZOLEXORA_001', 'Belkin BoostCharge Pro 3-in-1', 'Accessories', 'CAT_ACC', 'Pcs', 11999.0, 18.0, 3, 11, 3, 18, 32, 383968.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P009', 'ORG_ZOLEXORA_001', 'Ergotron LX Desk Mount Arm', 'Office', 'CAT_OFF', 'Pcs', 15500.0, 18.0, 2, 8, 2, 10, 20, 310000.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P010', 'ORG_ZOLEXORA_001', 'CalDigit TS4 Thunderbolt 4 Dock', 'Accessories', 'CAT_ACC', 'Pcs', 38500.0, 18.0, 2, 4, 1, 8, 13, 500500.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P011', 'ORG_ZOLEXORA_001', 'Shure SM7B Vocal Dynamic Mic', 'Audio', 'CAT_AUD', 'Pcs', 36900.0, 18.0, 2, 5, 2, 7, 14, 516600.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('P012', 'ORG_ZOLEXORA_001', 'Elgato Stream Deck XL 32 Keys', 'Electronics', 'CAT_ELE', 'Pcs', 21990.0, 18.0, 3, 7, 3, 14, 24, 527760.0, 'SUP_010', 'Active', '2026-09-04T00:00:00.000Z'),
('F001', 'ORG_ZOLEXORA_001', 'Assam Special Masala Chai', 'Beverages', 'CAT_BEV', 'Cups', 120.0, 5.0, 20, 150, 100, 200, 450, 54000.0, 'SUP_021', 'Active', '2026-09-04T00:00:00.000Z'),
('F002', 'ORG_ZOLEXORA_001', 'Artisan Cappuccino Roast', 'Beverages', 'CAT_BEV', 'Cups', 220.0, 5.0, 20, 90, 60, 150, 300, 66000.0, 'SUP_021', 'Active', '2026-09-04T00:00:00.000Z'),
('F003', 'ORG_ZOLEXORA_001', 'Paneer Tikka Grilled Sandwich', 'Snacks', 'CAT_SNK', 'Plates', 260.0, 5.0, 10, 40, 30, 60, 130, 33800.0, 'SUP_004', 'Active', '2026-09-04T00:00:00.000Z'),
('F004', 'ORG_ZOLEXORA_001', 'Crispy Farmhouse Veg Burger', 'Snacks', 'CAT_SNK', 'Pcs', 240.0, 5.0, 10, 35, 25, 50, 110, 26400.0, 'SUP_005', 'Active', '2026-09-04T00:00:00.000Z');

-- 15. POS Restaurant & Cafe Tables
CREATE TABLE IF NOT EXISTS pos_tables (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
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
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 16. POS Cash Drawer Logs
CREATE TABLE IF NOT EXISTS cash_drawer_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  cashier TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Initial POS Tables Seed
INSERT OR IGNORE INTO pos_tables (id, org_id, number, section, capacity, status, current_bill, waiter, token, items_count, seated_since, updated_at) VALUES
('t1', 'ORG_ZOLEXORA_001', 'T-01', 'Main Hall', 2, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('t2', 'ORG_ZOLEXORA_001', 'T-02', 'Main Hall', 4, 'Occupied', 1450.0, 'Rajesh', 'TK-101', 3, '24 mins ago', '2026-09-04T00:00:00.000Z'),
('t3', 'ORG_ZOLEXORA_001', 'T-03', 'Main Hall', 4, 'Billed', 2890.0, 'Suresh', 'TK-098', 6, '48 mins ago', '2026-09-04T00:00:00.000Z'),
('t4', 'ORG_ZOLEXORA_001', 'T-04', 'Main Hall', 6, 'Occupied', 3820.0, 'Rajesh', 'TK-104', 7, '35 mins ago', '2026-09-04T00:00:00.000Z'),
('t5', 'ORG_ZOLEXORA_001', 'T-05', 'Main Hall', 2, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('t6', 'ORG_ZOLEXORA_001', 'T-06', 'Main Hall', 8, 'Reserved', 0.0, 'Anil', NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('ac1', 'ORG_ZOLEXORA_001', 'AC-01', 'AC Lounge', 4, 'Occupied', 1950.0, 'Pooja', 'TK-108', 4, '12 mins ago', '2026-09-04T00:00:00.000Z'),
('ac2', 'ORG_ZOLEXORA_001', 'AC-02', 'AC Lounge', 4, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('ac3', 'ORG_ZOLEXORA_001', 'AC-03', 'AC Lounge', 6, 'Occupied', 4120.0, 'Pooja', 'TK-095', 9, '55 mins ago', '2026-09-04T00:00:00.000Z'),
('ac4', 'ORG_ZOLEXORA_001', 'AC-04', 'AC Lounge', 8, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('rt1', 'ORG_ZOLEXORA_001', 'RT-01', 'Rooftop Patio', 4, 'Occupied', 2340.0, 'Vikas', 'TK-106', 5, '18 mins ago', '2026-09-04T00:00:00.000Z'),
('rt2', 'ORG_ZOLEXORA_001', 'RT-02', 'Rooftop Patio', 4, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('rt3', 'ORG_ZOLEXORA_001', 'RT-03', 'Rooftop Patio', 2, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('rt4', 'ORG_ZOLEXORA_001', 'RT-04', 'Rooftop Patio', 6, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('b1', 'ORG_ZOLEXORA_001', 'BAR-01', 'Bar Counter', 2, 'Occupied', 850.0, 'Karan', 'TK-109', 2, '10 mins ago', '2026-09-04T00:00:00.000Z'),
('b2', 'ORG_ZOLEXORA_001', 'BAR-02', 'Bar Counter', 2, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z'),
('b3', 'ORG_ZOLEXORA_001', 'BAR-03', 'Bar Counter', 2, 'Vacant', 0.0, NULL, NULL, 0, NULL, '2026-09-04T00:00:00.000Z');

-- Initial Cash Drawer Logs Seed
INSERT OR IGNORE INTO cash_drawer_logs (id, org_id, timestamp, type, amount, reason, cashier, created_at) VALUES
('cd_1', 'ORG_ZOLEXORA_001', '08:00 AM', 'Opening Float', 3000.0, 'Shift morning float assigned', 'Cashier SP-01', '2026-09-05T08:00:00.000Z'),
('cd_2', 'ORG_ZOLEXORA_001', '09:42 AM', 'Cash Sale', 1450.0, 'Bill #904120', 'Cashier SP-01', '2026-09-05T09:42:00.000Z'),
('cd_3', 'ORG_ZOLEXORA_001', '10:15 AM', 'Pay Out', -250.0, 'Dairy fresh milk delivery emergency', 'Cashier SP-01', '2026-09-05T10:15:00.000Z'),
('cd_4', 'ORG_ZOLEXORA_001', '11:30 AM', 'Cash Sale', 2190.0, 'Bill #904126', 'Cashier SP-01', '2026-09-05T11:30:00.000Z'),
('cd_5', 'ORG_ZOLEXORA_001', '01:05 PM', 'Cash Drop (Safe)', -4000.0, 'Midday cash drop to vault safe', 'Supervisor Raj', '2026-09-05T13:05:00.000Z'),
('cd_6', 'ORG_ZOLEXORA_001', '02:20 PM', 'Pay In', 1000.0, 'Small coins & change replenish', 'Cashier SP-01', '2026-09-05T14:20:00.000Z'),
('cd_7', 'ORG_ZOLEXORA_001', '03:10 PM', 'Cash Sale', 1200.0, 'Bill #904130', 'Cashier SP-01', '2026-09-05T15:10:00.000Z');

-- Additional CRM Customers Seed (matching customers.tsx)
INSERT OR IGNORE INTO customers (phone, org_id, name, email, tier, loyalty_points, total_orders, total_spend, created_at, last_visit) VALUES
('+91 91234 56789', 'ORG_ZOLEXORA_001', 'Sneha Patel (VIP)', 'sneha.p@outlook.com', 'Gold', 620, 14, 18200.0, '2026-08-10T11:00:00Z', 'Yesterday'),
('+91 99887 76655', 'ORG_ZOLEXORA_001', 'Amit Verma', 'amit.verma@tech.in', 'Silver', 340, 8, 9400.0, '2026-08-15T12:00:00Z', '3 days ago'),
('+91 94455 66778', 'ORG_ZOLEXORA_001', 'Pooja Reddy', 'pooja.r@yahoo.com', 'Gold', 850, 19, 24300.0, '2026-08-05T16:00:00Z', 'Last week'),
('+91 97711 22334', 'ORG_ZOLEXORA_001', 'Rahul Kapoor', 'rahul.k@design.io', 'Bronze', 110, 3, 3100.0, '2026-08-25T17:00:00Z', '2 weeks ago'),
('+91 98112 34567', 'ORG_ZOLEXORA_001', 'Dr. Ananya Roy', 'ananya.roy@health.org', 'Platinum', 2150, 42, 56900.0, '2026-07-01T08:00:00Z', 'Today');

-- Initial Selling Point Sales Seed (for reports & analytics)
INSERT OR IGNORE INTO selling_point_sales (id, org_id, timestamp, date, selling_point_code, selling_point_name, bill_no, customer_name, item_code, item_name, category, quantity, uom, rate, tax_percent, total_amount, payment_mode, payment_status, cashier, notes) VALUES
('sl_01', 'ORG_ZOLEXORA_001', '2026-09-05T08:30:00.000Z', '2026-09-05', 'SP_001', 'Front Counter / Retail Sales', 'BILL-904120', 'Dr. Ananya Roy', 'P002', 'Oat Milk Cappuccino', 'Beverages', 2, 'Cups', 220.0, 5.0, 462.0, 'Cash', 'Completed', 'Cashier SP-01', 'Morning coffee'),
('sl_02', 'ORG_ZOLEXORA_001', '2026-09-05T09:15:00.000Z', '2026-09-05', 'SP_001', 'Front Counter / Retail Sales', 'BILL-904121', 'Vikram Sharma', 'P001', 'Artisan Espresso Single', 'Beverages', 1, 'Cups', 140.0, 5.0, 147.0, 'UPI', 'Completed', 'Cashier SP-01', 'Dynamic UPI QR'),
('sl_03', 'ORG_ZOLEXORA_001', '2026-09-05T10:45:00.000Z', '2026-09-05', 'SP_001', 'Front Counter / Retail Sales', 'BILL-904122', 'Sneha Patel', 'P004', 'Butter Croissant Flaky', 'Bakery', 2, 'Pcs', 160.0, 5.0, 336.0, 'UPI', 'Completed', 'Cashier SP-01', 'Breakfast order'),
('sl_04', 'ORG_ZOLEXORA_001', '2026-09-05T12:20:00.000Z', '2026-09-05', 'SP_001', 'Front Counter / Retail Sales', 'BILL-904123', 'Amit Verma', 'P006', 'Tandoori Paneer Roll', 'Mains', 2, 'Plates', 240.0, 5.0, 504.0, 'Credit Card', 'Completed', 'Cashier SP-01', 'Lunch rush'),
('sl_05', 'ORG_ZOLEXORA_001', '2026-09-05T13:10:00.000Z', '2026-09-05', 'SP_001', 'Front Counter / Retail Sales', 'BILL-904124', 'Rahul Malhotra', 'P012', 'Parmesan Truffle Fries', 'Appetizers', 2, 'Plates', 220.0, 5.0, 462.0, 'UPI', 'Completed', 'Cashier SP-01', 'Dine-in Table T-02');


