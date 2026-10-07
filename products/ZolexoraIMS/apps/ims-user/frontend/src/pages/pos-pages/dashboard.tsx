import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Store,
  Clock,
  CheckCircle2,
  RefreshCw,
  History,
  AlertCircle,
  Percent,
  UtensilsCrossed,
  ChefHat,
  PauseCircle,
  Keyboard,
  Volume2,
  VolumeX,
  FileText,
  Sparkles,
  Phone,
  User,
  Tag,
  Zap,
  PackageCheck,
  Award,
  ArrowUpRight,
} from 'lucide-react';
import ReceiptModal, { CartItem, SaleReceipt } from './components/receipt-modal';
import RecentSalesDrawer, { RecentTxn } from './components/recent-sales-drawer';
import PosTableSelector, { PosTable } from './components/pos-table-selector';
import KotModal, { KotData } from './components/kot-modal';
import HeldOrdersDrawer, { HeldOrder } from './components/held-orders-drawer';
import UpiQrModal from './components/upi-qr-modal';
import ShortcutsModal from './components/shortcuts-modal';
import RegisterSummaryModal from './components/register-summary-modal';
import { useAuth } from '../../lib/auth-context';

export interface Product {
  item_code: string;
  description: string;
  category: string;
  rate: number;
  tax_percent: number;
  stock_s_001: number;
  stock_s_002: number;
  central_stock: number;
  total_stock: number;
  uom: string;
  status: string;
  shortcode?: string;
  is_veg?: boolean;
}

const DEFAULT_PRODUCTS: Product[] = [
  { item_code: "P001", shortcode: "MS", description: "Logitech MX Master 3S Mouse", category: "Electronics", rate: 8999.0, tax_percent: 18.0, stock_s_001: 25, stock_s_002: 10, central_stock: 50, total_stock: 85, uom: "Pcs", status: "Active" },
  { item_code: "P002", shortcode: "KB", description: "Keychron K2 Mechanical Keyboard", category: "Electronics", rate: 7499.0, tax_percent: 18.0, stock_s_001: 14, stock_s_002: 5, central_stock: 20, total_stock: 39, uom: "Pcs", status: "Active" },
  { item_code: "P003", shortcode: "MON", description: "Dell UltraSharp 27 4K Monitor", category: "Electronics", rate: 52000.0, tax_percent: 18.0, stock_s_001: 6, stock_s_002: 2, central_stock: 12, total_stock: 20, uom: "Pcs", status: "Active" },
  { item_code: "P004", shortcode: "HP", description: "Sony WH-1000XM5 Headphones", category: "Audio", rate: 29990.0, tax_percent: 18.0, stock_s_001: 9, stock_s_002: 4, central_stock: 15, total_stock: 28, uom: "Pcs", status: "Active" },
  { item_code: "P005", shortcode: "AP", description: "Apple AirPods Pro (2nd Gen)", category: "Audio", rate: 24900.0, tax_percent: 18.0, stock_s_001: 18, stock_s_002: 8, central_stock: 30, total_stock: 56, uom: "Pcs", status: "Active" },
  { item_code: "P006", shortcode: "PB", description: "Anker 737 Power Bank (24K)", category: "Accessories", rate: 12499.0, tax_percent: 18.0, stock_s_001: 20, stock_s_002: 7, central_stock: 40, total_stock: 67, uom: "Pcs", status: "Active" },
  { item_code: "P007", shortcode: "SSD", description: "Samsung T7 Shield 2TB SSD", category: "Storage", rate: 16999.0, tax_percent: 18.0, stock_s_001: 15, stock_s_002: 6, central_stock: 25, total_stock: 46, uom: "Pcs", status: "Active" },
  { item_code: "P008", shortcode: "WP", description: "Belkin BoostCharge Pro 3-in-1", category: "Accessories", rate: 11999.0, tax_percent: 18.0, stock_s_001: 11, stock_s_002: 3, central_stock: 18, total_stock: 32, uom: "Pcs", status: "Active" },
  { item_code: "P009", shortcode: "ARM", description: "Ergotron LX Desk Mount Arm", category: "Office", rate: 15500.0, tax_percent: 18.0, stock_s_001: 8, stock_s_002: 2, central_stock: 10, total_stock: 20, uom: "Pcs", status: "Active" },
  { item_code: "P010", shortcode: "DK", description: "CalDigit TS4 Thunderbolt 4 Dock", category: "Accessories", rate: 38500.0, tax_percent: 18.0, stock_s_001: 4, stock_s_002: 1, central_stock: 8, total_stock: 13, uom: "Pcs", status: "Active" },
  { item_code: "P011", shortcode: "MIC", description: "Shure SM7B Vocal Dynamic Mic", category: "Audio", rate: 36900.0, tax_percent: 18.0, stock_s_001: 5, stock_s_002: 2, central_stock: 7, total_stock: 14, uom: "Pcs", status: "Active" },
  { item_code: "P012", shortcode: "SD", description: "Elgato Stream Deck XL 32 Keys", category: "Electronics", rate: 21990.0, tax_percent: 18.0, stock_s_001: 7, stock_s_002: 3, central_stock: 14, total_stock: 24, uom: "Pcs", status: "Active" },
  // Quick F&B / Cafe items for Petpooja-style demo
  { item_code: "F001", shortcode: "TEA", description: "Assam Special Masala Chai", category: "Beverages", rate: 120.0, tax_percent: 5.0, stock_s_001: 150, stock_s_002: 100, central_stock: 200, total_stock: 450, uom: "Cups", status: "Active", is_veg: true },
  { item_code: "F002", shortcode: "COF", description: "Artisan Cappuccino Roast", category: "Beverages", rate: 220.0, tax_percent: 5.0, stock_s_001: 90, stock_s_002: 60, central_stock: 150, total_stock: 300, uom: "Cups", status: "Active", is_veg: true },
  { item_code: "F003", shortcode: "SW", description: "Paneer Tikka Grilled Sandwich", category: "Snacks", rate: 260.0, tax_percent: 5.0, stock_s_001: 40, stock_s_002: 30, central_stock: 60, total_stock: 130, uom: "Plates", status: "Active", is_veg: true },
  { item_code: "F004", shortcode: "BG", description: "Crispy Farmhouse Veg Burger", category: "Snacks", rate: 240.0, tax_percent: 5.0, stock_s_001: 35, stock_s_002: 25, central_stock: 50, total_stock: 110, uom: "Pcs", status: "Active", is_veg: true },
];

export type OrderServiceType = 'Quick Bill' | 'Dine-In' | 'Takeaway';

export default function POSTerminal() {
  const { authFetch, user } = useAuth();

  // Core Data
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sellingPoint, setSellingPoint] = useState<string>('SP_001');

  // Service Mode & Table
  const [orderType, setOrderType] = useState<OrderServiceType>('Quick Bill');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showTablePicker, setShowTablePicker] = useState<boolean>(false);

  // Customer CRM
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);

  // Cart & Pricing
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI' | 'Split'>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customDiscountAmount, setCustomDiscountAmount] = useState<number>(0);
  const [couponCode, setCouponCode] = useState<string>('');

  // Modals & Drawers
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [kotData, setKotData] = useState<KotData | null>(null);
  const [recentTxns, setRecentTxns] = useState<RecentTxn[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [heldDrawerOpen, setHeldDrawerOpen] = useState<boolean>(false);
  const [upiModalOpen, setUpiModalOpen] = useState<boolean>(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState<boolean>(false);

  // Audio Feedback Toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Live Clock & Token Counter
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());
  const [tokenCounter, setTokenCounter] = useState<number>(101);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Web Audio Synth Feedback
  const playSound = useCallback((type: 'beep' | 'success' | 'click' | 'delete') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'beep') {
        osc.frequency.setValueAtTime(850, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.09);
        osc.frequency.setValueAtTime(783.99, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.38);
      } else if (type === 'delete') {
        osc.frequency.setValueAtTime(280, now);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'click') {
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch {}
  }, [soundEnabled]);

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Inventory from D1
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/items');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Merge with default products if needed
          setProducts((prev) => {
            const map = new Map<string, Product>();
            DEFAULT_PRODUCTS.forEach((p) => map.set(p.item_code, p));
            data.forEach((p: Product) => map.set(p.item_code, { ...map.get(p.item_code), ...p }));
            return Array.from(map.values());
          });
        }
      }
    } catch {}

    try {
      const txRes = await authFetch('/api/v1/transactions?limit=25');
      if (txRes.ok) {
        const txData = await txRes.json();
        if (Array.isArray(txData)) {
          setRecentTxns(txData);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Customer Phone CRM Database lookup
  useEffect(() => {
    const cleaned = customerPhone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      authFetch(`/api/v1/customers/${cleaned}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((cust) => {
          if (cust && cust.name) {
            setCustomerName(`${cust.name} (${cust.tier || 'Member'})`);
            setLoyaltyPoints(cust.loyalty_points || 0);
          } else {
            setCustomerName(`Guest (${cleaned.slice(-4)})`);
            setLoyaltyPoints(0);
          }
        })
        .catch(() => {
          setCustomerName(`Guest (${cleaned.slice(-4)})`);
          setLoyaltyPoints(0);
        });
    } else if (cleaned.length === 0) {
      setCustomerName('Walk-in Customer');
      setLoyaltyPoints(0);
    }
  }, [customerPhone]);

  // Categories Filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ['All', 'Favorites', ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.description.toLowerCase().includes(q) ||
        p.item_code.toLowerCase().includes(q) ||
        (p.shortcode && p.shortcode.toLowerCase().includes(q));

      if (selectedCategory === 'Favorites') {
        return matchesSearch && (p.rate < 500 || p.rate > 20000);
      }
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Add to Cart
  const addToCart = (product: Product, note?: string) => {
    playSound('beep');
    const currentStoreStock = sellingPoint === 'SP_001' ? product.stock_s_001 : product.stock_s_002;
    const existing = cart.find((item) => item.item_code === product.item_code);
    const curQtyInCart = existing ? existing.quantity : 0;

    if (curQtyInCart + 1 > currentStoreStock) {
      alert(`Stock Limit: Only ${currentStoreStock} ${product.uom} available in ${sellingPoint}.`);
      return;
    }

    if (existing) {
      setCart(
        cart.map((item) =>
          item.item_code === product.item_code
            ? { ...item, quantity: item.quantity + 1, notes: note || item.notes }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          item_code: product.item_code,
          description: product.description,
          rate: product.rate,
          quantity: 1,
          tax_percent: product.tax_percent || 18.0,
          notes: note,
        },
      ]);
    }
  };

  // Quantity Adjust
  const updateQuantity = (item_code: string, delta: number) => {
    playSound(delta > 0 ? 'beep' : 'delete');
    const product = products.find((p) => p.item_code === item_code);
    const currentStoreStock = product
      ? sellingPoint === 'SP_001'
        ? product.stock_s_001
        : product.stock_s_002
      : 999;

    setCart(
      cart
        .map((item) => {
          if (item.item_code === item_code) {
            const next = item.quantity + delta;
            if (next > currentStoreStock) {
              alert(`Maximum stock in this counter is ${currentStoreStock}`);
              return item;
            }
            return { ...item, quantity: next };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Update Item Note / Modifier
  const updateItemNote = (item_code: string, note: string) => {
    setCart(
      cart.map((i) => (i.item_code === item_code ? { ...i, notes: note } : i))
    );
  };

  // Remove Item
  const removeFromCart = (item_code: string) => {
    playSound('delete');
    setCart(cart.filter((item) => item.item_code !== item_code));
  };

  // Clear Cart
  const clearCart = () => {
    playSound('delete');
    setCart([]);
    setCashTendered('');
    setDiscountPercent(0);
    setCustomDiscountAmount(0);
    setCouponCode('');
  };

  // Totals Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.rate * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (customDiscountAmount > 0) return customDiscountAmount;
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent, customDiscountAmount]);

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const taxAmount = useMemo(() => {
    return (discountedSubtotal * 18.0) / 100;
  }, [discountedSubtotal]);

  const grandTotal = Math.round(discountedSubtotal + taxAmount);
  const tenderedVal = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedVal - grandTotal);

  // Apply Coupon Code
  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'GOLD15' || code === 'ZOMATOGOLD' || code.includes('GOLD')) {
      const disc = Math.min(subtotal * 0.15, 300);
      setCustomDiscountAmount(Math.round(disc));
      setDiscountPercent(0);
      playSound('success');
      alert(`🎉 Zomato Gold 15% Dining Privilege applied (-₹${Math.round(disc)})!`);
    } else if (code === 'DINEOUT20' || code.includes('DINEOUT')) {
      const disc = Math.min(subtotal * 0.20, 400);
      setCustomDiscountAmount(Math.round(disc));
      setDiscountPercent(0);
      playSound('success');
      alert(`🎉 Swiggy Dineout 20% Privilege applied (-₹${Math.round(disc)})!`);
    } else if (code === 'ZOLEXORA10' || code === 'SAVE10') {
      setDiscountPercent(10);
      playSound('success');
      alert('10% Promotional discount applied!');
    } else if (code === 'FLAT50') {
      setCustomDiscountAmount(50);
      playSound('success');
      alert('₹50 Flat discount applied!');
    } else {
      alert('Invalid or expired coupon code. Try GOLD15, DINEOUT20, SAVE10, or FLAT50.');
    }
  };

  // Hold / Park Active Order
  const handleHoldOrder = () => {
    if (cart.length === 0) {
      alert('Cannot hold an empty cart.');
      return;
    }
    playSound('click');
    const orderLabel = selectedTable
      ? `Table ${selectedTable}`
      : customerName !== 'Walk-in Customer'
      ? customerName
      : `Order #${Date.now().toString().slice(-4)}`;

    const newHold: HeldOrder = {
      id: `HOLD_${Date.now()}`,
      label: orderLabel,
      order_type: orderType,
      table_no: selectedTable || undefined,
      customer_name: customerName,
      timestamp: new Date().toISOString(),
      items: [...cart],
      subtotal: grandTotal,
    };

    setHeldOrders((prev) => [newHold, ...prev]);
    clearCart();
    setSelectedTable(null);
    alert(`Order parked as "${orderLabel}". Retrieve from Held Orders tab.`);
  };

  // Resume Held Order
  const handleResumeOrder = (order: HeldOrder) => {
    playSound('success');
    setCart(order.items);
    setOrderType(order.order_type as OrderServiceType);
    setSelectedTable(order.table_no || null);
    setCustomerName(order.customer_name);
    setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));
    setHeldDrawerOpen(false);
  };

  // Generate KOT (Kitchen Order Ticket)
  const handleFireKot = () => {
    if (cart.length === 0) {
      alert('Cannot generate KOT for empty cart.');
      return;
    }
    playSound('click');
    const kotNo = `KOT-${Date.now().toString().slice(-4)}`;
    setKotData({
      kot_no: kotNo,
      table_no: selectedTable || undefined,
      order_type: orderType,
      server_name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Captain 01',
      timestamp: new Date().toISOString(),
      items: [...cart],
    });
  };

  // Settle Bill & Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Please select products to bill.');
      return;
    }

    if (paymentMode === 'Cash' && tenderedVal > 0 && tenderedVal < grandTotal) {
      alert(`Tendered cash (₹${tenderedVal}) is less than total amount (₹${grandTotal}).`);
      return;
    }

    playSound('success');
    const billNo = `BILL-${Date.now().toString().slice(-6)}`;
    const currentToken = `TK-${tokenCounter}`;
    setTokenCounter((c) => c + 1);

    const salePayload = {
      selling_point_code: sellingPoint,
      customer_name: customerName.trim() || 'Walk-in Customer',
      customer_phone: customerPhone.trim() || undefined,
      bill_no: billNo,
      order_type: orderType,
      table_no: selectedTable || undefined,
      items: cart.map((c) => ({
        item_code: c.item_code,
        quantity: c.quantity,
        rate: c.rate,
        tax_percent: c.tax_percent,
        notes: c.notes,
      })),
      payment_mode: paymentMode,
      notes: `${orderType} sale via Zolexora POS terminal`,
    };

    try {
      await authFetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      });

      if (customerPhone.trim()) {
        const cleaned = customerPhone.replace(/\D/g, '');
        if (cleaned.length >= 10) {
          const earnedPoints = Math.round(grandTotal * 0.05);
          const newTotalPoints = (loyaltyPoints || 0) + earnedPoints;
          const tier = newTotalPoints > 1000 ? 'Platinum' : newTotalPoints > 300 ? 'Gold' : 'Silver';
          await authFetch('/api/v1/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: customerPhone.trim(),
              name: customerName.replace(/\s*\(.*?\)\s*/g, '').trim() || `Customer ${cleaned.slice(-4)}`,
              tier: tier,
              loyalty_points: newTotalPoints,
              total_orders: 1,
              total_spend: grandTotal,
            }),
          });
        }
      }
    } catch {}

    // Deduct stock in local view
    setProducts((prev) =>
      prev.map((p) => {
        const itemInCart = cart.find((c) => c.item_code === p.item_code);
        if (!itemInCart) return p;
        const dec = itemInCart.quantity;
        const s1 = sellingPoint === 'SP_001' ? Math.max(0, p.stock_s_001 - dec) : p.stock_s_001;
        const s2 = sellingPoint === 'SP_002' ? Math.max(0, p.stock_s_002 - dec) : p.stock_s_002;
        return {
          ...p,
          stock_s_001: s1,
          stock_s_002: s2,
          total_stock: s1 + s2 + p.central_stock,
        };
      })
    );

    const receiptObj: SaleReceipt = {
      bill_no: billNo,
      token_no: currentToken,
      date: new Date().toLocaleString(),
      selling_point: sellingPoint === 'SP_001' ? 'Counter 1 (Main Branch)' : 'Counter 2 (Branch Store)',
      cashier: user?.user_metadata?.name || user?.email || 'POS Cashier 01',
      customer_name: customerName.trim() || 'Walk-in Customer',
      customer_phone: customerPhone || undefined,
      order_type: orderType,
      table_no: selectedTable || undefined,
      items: [...cart],
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: grandTotal,
      payment_mode: paymentMode,
      tendered: paymentMode === 'Cash' ? (tenderedVal > 0 ? tenderedVal : grandTotal) : undefined,
      change: paymentMode === 'Cash' ? changeDue : undefined,
      loyalty_points: Math.round(grandTotal * 0.05),
    };

    setReceipt(receiptObj);

    setRecentTxns((prev) => [
      {
        id: `tx_${Date.now()}`,
        bill_no: billNo,
        timestamp: new Date().toISOString(),
        customer_name: customerName.trim() || 'Walk-in Customer',
        total_amount: grandTotal,
        payment_mode: paymentMode,
      },
      ...prev,
    ]);

    clearCart();
    setSelectedTable(null);
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleHoldOrder();
      } else if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleCheckout();
      } else if (e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        handleFireKot();
      } else if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setShowTablePicker((prev) => !prev);
      } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setHeldDrawerOpen(true);
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        setDrawerOpen(true);
      } else if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        setUpiModalOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'Escape') {
        setShowTablePicker(false);
        setDrawerOpen(false);
        setHeldDrawerOpen(false);
        setUpiModalOpen(false);
        setShortcutsModalOpen(false);
        setSummaryModalOpen(false);
        setKotData(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, grandTotal, customerName, selectedTable, orderType, paymentMode]);

  // Handle Search Enter key (Quick shortcode / first item add)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        addToCart(filteredProducts[0]);
        setSearchQuery('');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#07080e]">
      {/* Top Petpooja-Style Service Bar */}
      <header className="bg-[#0f111c] border-b border-white/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 select-none">
        {/* Left: Service Type Tabs */}
        <div className="flex items-center gap-2">
          <div className="bg-[#151828] p-1 rounded-xl border border-white/10 flex items-center gap-1">
            <button
              onClick={() => {
                setOrderType('Quick Bill');
                setShowTablePicker(false);
                playSound('click');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                orderType === 'Quick Bill'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Quick Bill</span>
            </button>

            <button
              onClick={() => {
                setOrderType('Dine-In');
                setShowTablePicker(true);
                playSound('click');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                orderType === 'Dine-In'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Dine-In</span>
              {selectedTable && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-white/20 text-white font-mono text-[10px]">
                  {selectedTable}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setOrderType('Takeaway');
                setShowTablePicker(false);
                playSound('click');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                orderType === 'Takeaway'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Takeaway</span>
            </button>
          </div>

          {/* Table Selector toggle when Dine-In */}
          {orderType === 'Dine-In' && (
            <button
              onClick={() => setShowTablePicker((p) => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 text-indigo-300 rounded-xl text-xs font-semibold transition"
            >
              <Store className="w-3.5 h-3.5 text-indigo-400" />
              <span>{selectedTable ? `Table: ${selectedTable}` : 'Select Table [Alt+T]'}</span>
            </button>
          )}
        </div>

        {/* Right: Quick Action Buttons & Stats */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Selling Point Select */}
          <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 text-slate-300">
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={sellingPoint}
              onChange={(e) => setSellingPoint(e.target.value)}
              className="bg-transparent text-white font-medium outline-hidden cursor-pointer text-xs"
            >
              <option value="SP_001" className="bg-[#10121d] text-white">SP_001 (Main Counter)</option>
              <option value="SP_002" className="bg-[#10121d] text-white">SP_002 (Outlet Dispenser)</option>
            </select>
          </div>

          {/* Held Orders Button */}
          <button
            onClick={() => setHeldDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition ${
              heldOrders.length > 0
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title="Parked / Held Orders [Alt+H]"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">Held ({heldOrders.length})</span>
          </button>

          {/* Shift Z-Report */}
          <button
            onClick={() => setSummaryModalOpen(true)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/10 text-slate-300 transition"
            title="Shift Z-Report & Cash Drawer"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Z-Report</span>
          </button>

          {/* Recent Orders Ledger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/10 text-slate-300 transition"
            title="Recent Sales Invoices [Alt+R]"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>Orders ({recentTxns.length})</span>
          </button>

          {/* Audio Feedback Toggle */}
          <button
            onClick={() => setSoundEnabled((p) => !p)}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-white transition"
            title={soundEnabled ? 'Audio Chimes On' : 'Audio Chimes Muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Keyboard Shortcuts */}
          <button
            onClick={() => setShortcutsModalOpen(true)}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-indigo-400 hover:text-white transition"
            title="Keyboard Shortcuts Cheatsheet"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* D1 Sync Refresh */}
          <button
            onClick={fetchData}
            title="Refresh D1 stock ledger"
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Interactive Work Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Product Catalog OR Table Picker */}
        <section className="flex-1 flex flex-col min-w-0 border-r border-white/10 bg-[#090b12]">
          {showTablePicker && orderType === 'Dine-In' ? (
            /* Table Management View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-[#121422] border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-indigo-400" />
                  Dine-In Table Floor Map
                </span>
                <button
                  onClick={() => setShowTablePicker(false)}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-semibold transition"
                >
                  Switch to Product Grid
                </button>
              </div>
              <PosTableSelector
                selectedTable={selectedTable}
                onSelectTable={(table: PosTable) => {
                  setSelectedTable(table.code);
                  setShowTablePicker(false);
                  playSound('click');
                }}
              />
            </div>
          ) : (
            /* Standard High-Speed Product Catalog */
            <>
              {/* Search Bar & Barcode Scanner */}
              <div className="p-3 border-b border-white/10 bg-[#0e101a] space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Scan barcode or type item title, shortcode (e.g. TEA, MS, P001)... [Press / to Search]"
                    className="w-full bg-[#161826] border border-white/10 rounded-xl pl-9 pr-14 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        playSound('click');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {cat === 'Favorites' ? '⭐ Favorites' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto p-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-slate-500 text-xs">
                    No items matching "{searchQuery}" in {selectedCategory}.
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const currentStock = sellingPoint === 'SP_001' ? product.stock_s_001 : product.stock_s_002;
                    const inCartItem = cart.find((i) => i.item_code === product.item_code);
                    const isOutOfStock = currentStock <= 0;

                    return (
                      <button
                        key={product.item_code}
                        disabled={isOutOfStock}
                        onClick={() => addToCart(product)}
                        className={`p-3 bg-[#11131f] border rounded-2xl text-left flex flex-col justify-between transition group relative ${
                          isOutOfStock
                            ? 'opacity-40 border-white/5 cursor-not-allowed'
                            : inCartItem
                            ? 'border-indigo-500/60 bg-indigo-950/20 shadow-md ring-1 ring-indigo-500/40'
                            : 'border-white/5 hover:border-indigo-500/30 hover:bg-[#151726]'
                        }`}
                      >
                        {/* Shortcode & Veg Indicator */}
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 group-hover:text-indigo-300 font-bold">
                            {product.shortcode || product.item_code}
                          </span>
                          {product.is_veg && (
                            <span className="w-3.5 h-3.5 rounded border border-emerald-500 flex items-center justify-center p-0.5" title="Vegetarian">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div className="my-1">
                          <h4 className="font-bold text-xs text-slate-100 group-hover:text-white line-clamp-2 leading-snug">
                            {product.description}
                          </h4>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {product.category}
                          </span>
                        </div>

                        {/* Price & Stock Counter */}
                        <div className="w-full pt-2 border-t border-white/5 flex items-center justify-between">
                          <div>
                            <div className="font-black text-sm text-emerald-400 font-mono">
                              ₹{product.rate.toFixed(2)}
                            </div>
                            <div className={`text-[10px] font-mono ${
                              currentStock < 5 ? 'text-amber-400 font-bold' : 'text-slate-500'
                            }`}>
                              Stock: {currentStock}
                            </div>
                          </div>

                          {inCartItem ? (
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                              {inCartItem.quantity}
                            </span>
                          ) : (
                            <span className="w-6 h-6 rounded-lg bg-white/5 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 flex items-center justify-center transition">
                              <Plus className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

        {/* Right Side: Fast Checkout & Active Cart Panel */}
        <aside className="w-80 md:w-96 bg-[#0c0e18] flex flex-col justify-between flex-shrink-0 border-l border-white/10 select-none">
          {/* Cart Header & Customer CRM */}
          <div className="p-3.5 border-b border-white/10 bg-[#10121d] space-y-2.5">
            {/* Customer CRM Phone Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Customer Mobile (10-digit CRM)"
                  className="w-full bg-[#181a29] border border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              {loyaltyPoints > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold">
                  <Award className="w-3 h-3" />
                  <span>{loyaltyPoints} Pts</span>
                </div>
              )}
            </div>

            {/* Active Customer & Table Indicator */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 truncate">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-white truncate max-w-[140px]">{customerName}</span>
                {orderType === 'Dine-In' && selectedTable && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-[10px]">
                    {selectedTable}
                  </span>
                )}
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold transition"
                >
                  Clear All [F4]
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2 py-16">
                <ShoppingCart className="w-12 h-12 stroke-1 text-slate-600" />
                <p className="font-medium text-slate-400">Your Cart is Empty</p>
                <p className="text-[11px] text-slate-600 text-center max-w-[180px]">
                  Select catalog products, scan barcodes, or use keyboard shortcuts to bill.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.item_code}
                  className="p-2.5 bg-white/5 border border-white/5 rounded-xl space-y-2 group hover:border-white/15 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {item.description}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        ₹{item.rate.toFixed(2)} × {item.quantity}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-xs text-emerald-400 font-mono">
                        ₹{(item.rate * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity and Modifier Note Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                    {/* Item note chip */}
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => updateItemNote(item.item_code, e.target.value)}
                      placeholder="Add prep note (e.g. less spicy)..."
                      className="bg-transparent text-[11px] text-amber-300 placeholder-slate-600 outline-hidden w-36 italic"
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.item_code, -1)}
                        className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-xs text-white font-mono px-1">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.item_code, 1)}
                        className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.item_code)}
                        className="ml-1 text-slate-500 hover:text-rose-400 p-0.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing, Tender & Action Panel */}
          <div className="p-3.5 border-t border-white/10 bg-[#0e101c] space-y-3">
            {/* Discount & Coupon Bar */}
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-400 font-semibold mr-1">Discount:</span>
              {[0, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    setDiscountPercent(pct);
                    setCustomDiscountAmount(0);
                    playSound('click');
                  }}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    discountPercent === pct && customDiscountAmount === 0
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {pct === 0 ? 'None' : `${pct}%`}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setCouponCode('GOLD15');
                  const disc = Math.min(subtotal * 0.15, 300);
                  setCustomDiscountAmount(Math.round(disc));
                  setDiscountPercent(0);
                  playSound('success');
                }}
                className={`px-2 py-0.5 rounded font-bold transition text-[10px] ${
                  couponCode === 'GOLD15' && customDiscountAmount > 0
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                }`}
                title="Apply Zomato Gold 15% Dining Privilege"
              >
                ★ Gold
              </button>

              <div className="flex-1 flex items-center ml-1">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon"
                  className="w-full bg-[#181a29] border border-white/10 rounded-l px-1.5 py-0.5 text-[10px] text-white uppercase outline-hidden"
                />
                <button
                  onClick={handleApplyCoupon}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-r text-[10px]"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs border-t border-white/5 pt-2">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="font-mono text-slate-200">₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Discount</span>
                  <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>GST (CGST 9% + SGST 9%)</span>
                <span className="font-mono text-slate-200">₹{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-base font-black text-white border-t border-white/10 pt-1.5">
                <span>NET PAYABLE</span>
                <span className="font-mono text-emerald-400 text-lg">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-4 gap-1">
              {(['Cash', 'UPI', 'Card', 'Split'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setPaymentMode(mode);
                    playSound('click');
                    if (mode === 'UPI') {
                      setUpiModalOpen(true);
                    }
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    paymentMode === mode
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {mode === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                  {mode === 'UPI' && <QrCode className="w-3.5 h-3.5" />}
                  {mode === 'Card' && <CreditCard className="w-3.5 h-3.5" />}
                  {mode === 'Split' && <Percent className="w-3.5 h-3.5" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>

            {/* Cash Quick Tenders */}
            {paymentMode === 'Cash' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder="Cash Received (₹)"
                    className="flex-1 bg-[#181a29] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono placeholder-slate-500 outline-hidden"
                  />
                  {[grandTotal, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashTendered(amt.toString())}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-mono text-slate-300 font-bold"
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                {tenderedVal > grandTotal && (
                  <div className="p-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-400">
                    <span>Change to Return:</span>
                    <span className="font-mono font-black text-sm">₹{changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons: Hold, KOT, Settle */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleHoldOrder}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition"
                title="Hold / Park Order [F8]"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Hold [F8]</span>
              </button>

              <button
                onClick={handleFireKot}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition"
                title="Kitchen Order Ticket [Alt+K]"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>KOT [Alt+K]</span>
              </button>
            </div>

            {/* Big Settle / Pay Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-black transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition" />
              <span>PAY & PRINT BILL [F9] • ₹{grandTotal.toFixed(2)}</span>
            </button>
          </div>
        </aside>
      </div>

      {/* MODALS & DRAWERS */}
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      <KotModal
        kot={kotData}
        onClose={() => setKotData(null)}
        onConfirmFire={() => {
          playSound('success');
          alert('KOT successfully fired to Kitchen Station!');
          setKotData(null);
        }}
      />
      <HeldOrdersDrawer
        isOpen={heldDrawerOpen}
        onClose={() => setHeldDrawerOpen(false)}
        heldOrders={heldOrders}
        onResumeOrder={handleResumeOrder}
        onDeleteOrder={(id) => setHeldOrders((prev) => prev.filter((o) => o.id !== id))}
      />
      <RecentSalesDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        transactions={recentTxns}
        onSelectTxn={(txn) => {
          alert(`Selected invoice ${txn.bill_no} for customer ${txn.customer_name}. Total: ₹${txn.total_amount}`);
        }}
      />
      <UpiQrModal
        amount={grandTotal}
        billNo={receipt?.bill_no || `BILL-${Date.now().toString().slice(-6)}`}
        customerPhone={customerPhone}
        isOpen={upiModalOpen}
        onClose={() => setUpiModalOpen(false)}
        onPaymentSuccess={() => {
          setUpiModalOpen(false);
          handleCheckout();
        }}
      />
      <ShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
      <RegisterSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        transactions={recentTxns}
        sellingPoint={sellingPoint}
        cashierName={user?.user_metadata?.name || user?.email || 'POS Cashier 01'}
      />
    </div>
  );
}
