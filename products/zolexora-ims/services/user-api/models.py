from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    id: str
    org_id: str
    email: str
    name: str
    role: str
    scope_type: str = "ALL"
    assigned_location: str = "ALL"
    location_name: Optional[str] = None
    status: str = "Active"
    supabase_auth_id: Optional[str] = None


class ItemCreate(BaseModel):
    item_code: str
    description: str
    category: str
    category_code: Optional[str] = None
    uom: str = "Pcs"
    rate: float = 0.0
    tax_percent: float = 0.0
    min_stock: float = 0.0
    stock_s_001: float = 0.0
    stock_s_002: float = 0.0
    central_stock: float = 0.0
    preferred_supplier_code: Optional[str] = None
    status: str = "Active"


class ItemUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    category_code: Optional[str] = None
    uom: Optional[str] = None
    rate: Optional[float] = None
    tax_percent: Optional[float] = None
    min_stock: Optional[float] = None
    preferred_supplier_code: Optional[str] = None
    status: Optional[str] = None


class ItemResponse(BaseModel):
    item_code: str
    description: str
    category: str
    category_code: Optional[str] = None
    uom: str
    rate: float
    tax_percent: float
    min_stock: float
    stock_s_001: float
    stock_s_002: float
    central_stock: float
    total_stock: float
    total_valuation: float
    preferred_supplier_code: Optional[str] = None
    status: str
    last_updated: str


class SaleItem(BaseModel):
    item_code: str
    quantity: float
    rate: float
    tax_percent: float = 0.0


class SaleRequest(BaseModel):
    selling_point_code: str
    customer_name: Optional[str] = "Walk-in Customer"
    bill_no: Optional[str] = None
    items: List[SaleItem]
    payment_mode: str = "Cash"
    notes: Optional[str] = None


class StockAdjustRequest(BaseModel):
    store_code: str = "S_001"  # S_001, S_002, or central_stock
    adjustment: float  # positive to add, negative to reduce
    reason: Optional[str] = "Manual restock/adjustment"


class DashboardMetrics(BaseModel):
    totalSKUs: int = 0
    totalStockValuation: float = 0.0
    lowStockAlerts: int = 0
    totalTodaySales: float = 0.0
    totalTodayPurchases: float = 0.0
    totalTodayExpenses: float = 0.0
    activeStores: int = 0
    activeSellingPoints: int = 0
    currency: str = "₹"


class AggregatorStatusUpdate(BaseModel):
    status: str  # ACCEPTED, PREPARING, READY, DISPATCHED, CANCELLED
    prep_time_mins: Optional[int] = 20
    reason: Optional[str] = None


class DiningBenefitVerify(BaseModel):
    platform: str  # "Zomato Gold", "Swiggy Dineout", "Dineout Pay", "Magicpin"
    membership_code: str
    bill_amount: float


class AggregatorChannelConfig(BaseModel):
    platform: str  # "urbanpiper", "swiggy", "zomato", "ondc"
    outlet_id: str  # Store ID / Restaurant ID
    api_key: Optional[str] = None
    api_username: Optional[str] = None
    webhook_secret: Optional[str] = None
    auto_accept: bool = False
    is_active: bool = True


class TestWebhookRequest(BaseModel):
    platform: str = "Swiggy"  # "Swiggy", "Zomato", "Dineout", "ONDC"
    customer_name: Optional[str] = "Live Test Customer"
    customer_phone: Optional[str] = "+91 98765 43210"
    item_name: Optional[str] = "Specialty Artisan Cold Brew"
    amount: Optional[float] = 320.0


class PaymentHandleConfig(BaseModel):
    upi_handle: str = "zolexora@icici"  # Merchant VPA, e.g. merchant@okhdfcbank
    merchant_name: str = "Zolexora Retail Operations"
    merchant_category_code: str = "5812"  # MCC (5812: Restaurants, 5411: Groceries)
    payment_gateway: str = "upi_qr"  # upi_qr, razorpay, cashfree, stripe, paytm_edc, pinelabs
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    cashfree_app_id: Optional[str] = None
    cashfree_secret_key: Optional[str] = None
    cashfree_env: Optional[str] = "TEST"  # TEST or PRODUCTION
    stripe_publishable_key: Optional[str] = None
    edc_terminal_id: Optional[str] = None
    soundbox_enabled: bool = True
    auto_settle: bool = True


class GenerateDynamicQrRequest(BaseModel):
    amount: float
    bill_no: str
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None


class TerminalSettingsConfig(BaseModel):
    printer_interface: str = "network"  # network, usb, bluetooth, browser
    printer_ip: str = "192.168.1.180"
    printer_port: str = "9100"
    paper_width: str = "80mm"  # 80mm or 58mm
    auto_cut_paper: bool = True
    drawer_kick_on_cash: bool = True
    kot_printer_ip: str = "192.168.1.185"
    auto_print_kot_on_hold: bool = True
    large_token_font: bool = True
    store_legal_name: str = "Zolexora Retail Operations Pvt Ltd"
    gstin: str = "27AABCZ1234F1Z8"
    store_address: str = "Shop 4, Ground Floor, Cyber City Boulevard, Mumbai"
    phone_on_receipt: str = "+91 98765 43210"
    receipt_footer: str = "Thank you for dining with Zolexora! Have a great day."
    service_charge_percent: float = 0.0
    soundbox_enabled: bool = True


class CustomerModel(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None
    tier: Optional[str] = "Silver"
    loyalty_points: Optional[int] = 0
    total_orders: Optional[int] = 0
    total_spend: Optional[float] = 0.0


class PaymentVerifyRequest(BaseModel):
    bill_no: str
    amount: float
    payment_mode: str = "UPI"  # UPI, Card, Netbanking
    transaction_ref: Optional[str] = None  # Bank UTR / Reference No / Card Auth Code
    status: str = "SUCCESS"


class PosTableModel(BaseModel):
    id: str
    number: str
    section: str
    capacity: int = 4
    status: str = "Vacant"
    current_bill: Optional[float] = 0.0
    waiter: Optional[str] = None
    token: Optional[str] = None
    items_count: Optional[int] = 0
    seated_since: Optional[str] = None


class CashDrawerLogModel(BaseModel):
    id: Optional[str] = None
    timestamp: Optional[str] = None
    type: str  # 'Opening Float' | 'Cash Sale' | 'Pay In' | 'Pay Out' | 'Cash Drop (Safe)'
    amount: float
    reason: str
    cashier: str



