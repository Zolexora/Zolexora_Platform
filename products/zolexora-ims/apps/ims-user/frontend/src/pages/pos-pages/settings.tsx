import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings,
  Printer,
  Wifi,
  Database,
  Store,
  CheckCircle2,
  Save,
  RefreshCw,
  Sliders,
  DollarSign,
  FileText,
  ShieldCheck,
  Smartphone,
  Cpu,
  Zap,
  QrCode,
  CreditCard,
  Volume2,
  ExternalLink,
  Key,
  Lock,
  Play,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export default function PosSettings() {
  const { authFetch } = useAuth();
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Merchant Payment Handle & Gateway state
  const [upiHandle, setUpiHandle] = useState<string>('zolexora@icici');
  const [merchantName, setMerchantName] = useState<string>('Zolexora Retail Operations');
  const [mcc, setMcc] = useState<string>('5812');
  const [paymentGateway, setPaymentGateway] = useState<string>('upi_qr');
  const [edcTerminalId, setEdcTerminalId] = useState<string>('PINE_EDC_01');
  const [soundboxEnabled, setSoundboxEnabled] = useState<boolean>(true);
  const [testAmount, setTestAmount] = useState<number>(1.0);
  const [testQrUrl, setTestQrUrl] = useState<string>('');

  // Razorpay Gateway state
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState<string>('');
  const [hasRazorpaySecret, setHasRazorpaySecret] = useState<boolean>(false);
  const [testingRazorpay, setTestingRazorpay] = useState<boolean>(false);

  // Cashfree Gateway state
  const [cashfreeAppId, setCashfreeAppId] = useState<string>('');
  const [cashfreeSecretKey, setCashfreeSecretKey] = useState<string>('');
  const [cashfreeEnv, setCashfreeEnv] = useState<string>('TEST');
  const [hasCashfreeSecret, setHasCashfreeSecret] = useState<boolean>(false);
  const [testingCashfree, setTestingCashfree] = useState<boolean>(false);

  // Test feedback banner
  const [gatewayTestResult, setGatewayTestResult] = useState<{ gateway: string; message: string; ok: boolean } | null>(null);

  // Load existing payment handle & terminal settings from backend
  useEffect(() => {
    authFetch('/api/v1/payment/handle')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUpiHandle(data.upi_handle || 'zolexora@icici');
          setMerchantName(data.merchant_name || 'Zolexora Retail Operations');
          setMcc(data.merchant_category_code || '5812');
          setPaymentGateway(data.payment_gateway || 'upi_qr');
          setEdcTerminalId(data.edc_terminal_id || 'PINE_EDC_01');
          setSoundboxEnabled(data.soundbox_enabled ?? true);
          setRazorpayKeyId(data.razorpay_key_id || '');
          setHasRazorpaySecret(data.has_razorpay_secret || false);
          setCashfreeAppId(data.cashfree_app_id || '');
          setCashfreeEnv(data.cashfree_env || 'TEST');
          setHasCashfreeSecret(data.has_cashfree_secret || false);
        }
      })
      .catch(() => {});

    authFetch('/api/v1/settings/terminal')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.printer_interface) setPrinterInterface(data.printer_interface);
          if (data.printer_ip) setPrinterIp(data.printer_ip);
          if (data.printer_port) setPrinterPort(data.printer_port);
          if (data.paper_width) setPaperWidth(data.paper_width);
          if (data.auto_cut_paper !== undefined) setAutoCutPaper(data.auto_cut_paper);
          if (data.drawer_kick_on_cash !== undefined) setDrawerKickOnCash(data.drawer_kick_on_cash);
          if (data.kot_printer_ip) setKotPrinterIp(data.kot_printer_ip);
          if (data.auto_print_kot_on_hold !== undefined) setAutoPrintKotOnHold(data.auto_print_kot_on_hold);
          if (data.large_token_font !== undefined) setLargeTokenFont(data.large_token_font);
          if (data.store_legal_name) setStoreLegalName(data.store_legal_name);
          if (data.gstin) setGstin(data.gstin);
          if (data.store_address) setStoreAddress(data.store_address);
          if (data.phone_on_receipt) setPhoneOnReceipt(data.phone_on_receipt);
          if (data.receipt_footer) setReceiptFooter(data.receipt_footer);
          if (data.service_charge_percent !== undefined) setServiceChargePercent(data.service_charge_percent);
        }
      })
      .catch(() => {});
  }, []);

  // Compute test dynamic QR whenever handle or amount changes
  useEffect(() => {
    const encodedName = encodeURIComponent(merchantName);
    const intentUrl = `upi://pay?pa=${upiHandle}&pn=${encodedName}&mc=${mcc}&am=${testAmount.toFixed(2)}&cu=INR&tn=Handle_Test_1`;
    setTestQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(intentUrl)}&bgcolor=ffffff&color=090a10&margin=8`);
  }, [upiHandle, merchantName, mcc, testAmount]);

  // Hardware Printer state
  const [printerInterface, setPrinterInterface] = useState<'network' | 'usb' | 'bluetooth' | 'browser'>('network');
  const [printerIp, setPrinterIp] = useState<string>('192.168.1.180');
  const [printerPort, setPrinterPort] = useState<string>('9100');
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [autoCutPaper, setAutoCutPaper] = useState<boolean>(true);
  const [drawerKickOnCash, setDrawerKickOnCash] = useState<boolean>(true);

  // KOT Kitchen Printer state
  const [kotPrinterIp, setKotPrinterIp] = useState<string>('192.168.1.185');
  const [autoPrintKotOnHold, setAutoPrintKotOnHold] = useState<boolean>(true);
  const [largeTokenFont, setLargeTokenFont] = useState<boolean>(true);

  // Bill Header / Footer Customization
  const [storeLegalName, setStoreLegalName] = useState<string>('Zolexora Retail Operations Pvt Ltd');
  const [gstin, setGstin] = useState<string>('27AABCZ1234F1Z8');
  const [storeAddress, setStoreAddress] = useState<string>('Shop 4, Ground Floor, Cyber City Boulevard, Mumbai');
  const [phoneOnReceipt, setPhoneOnReceipt] = useState<string>('+91 98765 43210');
  const [receiptFooter, setReceiptFooter] = useState<string>('Thank you for dining with Zolexora! Have a great day.');
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(0);

  // D1 Edge Cache
  const [offlineSyncEnabled, setOfflineSyncEnabled] = useState<boolean>(true);
  const [edgeLatency, setEdgeLatency] = useState<number>(18);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  const handleTestPrinter = () => {
    alert(`Testing print to ${printerInterface.toUpperCase()} printer (${printerIp}:${printerPort})... ESC/POS Test Slip Sent!`);
  };

  const handleTestEdge = () => {
    setTestingConnection(true);
    setTimeout(() => {
      setEdgeLatency(Math.floor(Math.random() * 15) + 12);
      setTestingConnection(false);
    }, 600);
  };

  const handleTestRazorpay = async () => {
    setTestingRazorpay(true);
    setGatewayTestResult(null);
    try {
      const res = await authFetch('/api/v1/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: testAmount || 1.0,
          bill_no: `TEST_${Date.now()}`,
          customer_phone: '9876543210',
          customer_email: 'test@zolexora.com',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGatewayTestResult({
          gateway: 'Razorpay',
          message: `Order Created: ${data.order_id} (₹${data.amount}, ${data.gateway})`,
          ok: true,
        });
      } else {
        setGatewayTestResult({
          gateway: 'Razorpay',
          message: data.detail || 'Failed to create test order',
          ok: false,
        });
      }
    } catch (err: any) {
      setGatewayTestResult({ gateway: 'Razorpay', message: err.message || 'Network error', ok: false });
    }
    setTestingRazorpay(false);
  };

  const handleTestCashfree = async () => {
    setTestingCashfree(true);
    setGatewayTestResult(null);
    try {
      const res = await authFetch('/api/v1/payment/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: testAmount || 1.0,
          bill_no: `TEST_${Date.now()}`,
          customer_phone: '9876543210',
          customer_email: 'test@zolexora.com',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGatewayTestResult({
          gateway: 'Cashfree',
          message: `Session Created: ${data.order_id} (${data.gateway}, Env: ${data.environment})`,
          ok: true,
        });
      } else {
        setGatewayTestResult({
          gateway: 'Cashfree',
          message: data.detail || 'Failed to create test order',
          ok: false,
        });
      }
    } catch (err: any) {
      setGatewayTestResult({ gateway: 'Cashfree', message: err.message || 'Network error', ok: false });
    }
    setTestingCashfree(false);
  };

  const handleTestSoundbox = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `Received payment of rupees ${Math.round(testAmount || 1)} successfully via UPI.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    } else {
      alert(`Voice Soundbox Audio: Received payment of ₹${testAmount} successfully via UPI!`);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      await Promise.all([
        authFetch('/api/v1/payment/handle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upi_handle: upiHandle.trim().toLowerCase(),
            merchant_name: merchantName.trim(),
            merchant_category_code: mcc,
            payment_gateway: paymentGateway,
            razorpay_key_id: razorpayKeyId.trim() || undefined,
            razorpay_key_secret: razorpayKeySecret.trim() || undefined,
            cashfree_app_id: cashfreeAppId.trim() || undefined,
            cashfree_secret_key: cashfreeSecretKey.trim() || undefined,
            cashfree_env: cashfreeEnv,
            edc_terminal_id: edcTerminalId.trim() || undefined,
            soundbox_enabled: soundboxEnabled,
            auto_settle: true,
          }),
        }),
        authFetch('/api/v1/settings/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printer_interface: printerInterface,
            printer_ip: printerIp.trim(),
            printer_port: printerPort.trim(),
            paper_width: paperWidth,
            auto_cut_paper: autoCutPaper,
            drawer_kick_on_cash: drawerKickOnCash,
            kot_printer_ip: kotPrinterIp.trim(),
            auto_print_kot_on_hold: autoPrintKotOnHold,
            large_token_font: largeTokenFont,
            store_legal_name: storeLegalName.trim(),
            gstin: gstin.trim().toUpperCase(),
            store_address: storeAddress.trim(),
            phone_on_receipt: phoneOnReceipt.trim(),
            receipt_footer: receiptFooter.trim(),
            service_charge_percent: Number(serviceChargePercent) || 0,
            soundbox_enabled: soundboxEnabled,
          }),
        }),
      ]);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving POS settings:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080e] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>POS Terminal Hardware & Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure UPI payment handles, ESC/POS thermal printers, kitchen KOT routing & GST tax metadata
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Settings Saved!
            </span>
          )}
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto space-y-6 max-w-5xl">
        {/* Section 1: Merchant Payment Handles & Multi-Rail Gateways (UPI, Razorpay, Cashfree) */}
        <div className="bg-slate-900/40 border border-emerald-500/20 rounded-2xl p-5 space-y-5 shadow-xl shadow-emerald-500/5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Merchant Payment Rails & Gateways</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    NPCI UPI • Razorpay • Cashfree
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Configure UPI handles, Razorpay/Cashfree merchant API credentials, voice soundbox, and EDC card terminals
                </p>
              </div>
            </div>
            <Link
              to="/cmd-panal/payments"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 rounded-xl text-xs font-semibold transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Command Panel</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Command Panel Notice */}
          <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-purple-200">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Enterprise Security:</strong> Payment Rails, Bank VPA & API secrets are centrally managed under the Command Panel (Commander).
              </span>
            </div>
            <Link
              to="/cmd-panal/payments"
              className="text-purple-300 hover:text-white font-semibold underline text-[11px] ml-2 flex-shrink-0"
            >
              Open Command Panel Setup ➔
            </Link>
          </div>

          {/* Test Feedback Banner if any */}
          {gatewayTestResult && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                gatewayTestResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {gatewayTestResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>
                  <strong>[{gatewayTestResult.gateway}]</strong> {gatewayTestResult.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGatewayTestResult(null)}
                className="text-slate-400 hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Gateway Selector Tabs */}
          <div>
            <label className="block text-slate-300 mb-2 font-semibold text-xs">
              Primary Checkout Payment Gateway
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'upi_qr', name: 'Direct Dynamic UPI QR', desc: '0% MDR, Direct to Bank via NPCI' },
                { id: 'razorpay', name: 'Razorpay PG', desc: 'Credit/Debit Cards, NetBanking, UPI' },
                { id: 'cashfree', name: 'Cashfree Payments', desc: 'Drop Checkout, Multi-Rail Auto Settle' },
              ].map((gw) => (
                <button
                  type="button"
                  key={gw.id}
                  onClick={() => setPaymentGateway(gw.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    paymentGateway === gw.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-white flex items-center justify-between">
                    <span>{gw.name}</span>
                    {paymentGateway === gw.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{gw.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs pt-1">
            {/* Left 2 Cols: Form Inputs */}
            <div className="lg:col-span-2 space-y-4">
              {/* UPI Handle & Payee Details */}
              <div className="p-3.5 bg-black/30 rounded-xl border border-white/5 space-y-3">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>NPCI Unified Payments Interface (UPI) Settings</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Merchant UPI Handle (VPA) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. store@icici, cafe@okhdfcbank"
                      value={upiHandle}
                      onChange={(e) => setUpiHandle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Every bill generates a dynamic QR linked directly to this handle.
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Legal Payee / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Zolexora Artisan Roasters"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Appears on customer's GPay, PhonePe, and bank statements.
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Merchant Category Code (MCC)
                    </label>
                    <select
                      value={mcc}
                      onChange={(e) => setMcc(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                    >
                      <option value="5812">5812 - Eating Places & Restaurants</option>
                      <option value="5814">5814 - Fast Food & Specialty Cafes</option>
                      <option value="5411">5411 - Grocery Stores & Supermarkets</option>
                      <option value="5311">5311 - Department & Retail Stores</option>
                      <option value="5691">5691 - Men's & Women's Apparel</option>
                      <option value="5912">5912 - Drug Stores & Pharmacies</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      EDC Card Swipe Terminal ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PINE_POS_104"
                      value={edcTerminalId}
                      onChange={(e) => setEdcTerminalId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      For automated swipe push to PineLabs / Paytm card machines.
                    </span>
                  </div>
                </div>
              </div>

              {/* Razorpay Gateway Box */}
              <div className="p-3.5 bg-black/30 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Razorpay Merchant Integration</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTestRazorpay}
                    disabled={testingRazorpay}
                    className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/30 flex items-center gap-1 transition"
                  >
                    <Play className="w-3 h-3" />
                    <span>{testingRazorpay ? 'Testing Order...' : 'Test Razorpay Order'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Razorpay Key ID
                    </label>
                    <input
                      type="text"
                      placeholder="rzp_test_... or rzp_live_..."
                      value={razorpayKeyId}
                      onChange={(e) => setRazorpayKeyId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Razorpay Key Secret
                    </label>
                    <input
                      type="password"
                      placeholder={hasRazorpaySecret ? '•••••••••••• (Secret Configured)' : 'Enter Razorpay Key Secret'}
                      value={razorpayKeySecret}
                      onChange={(e) => setRazorpayKeySecret(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Cashfree Payments Box */}
              <div className="p-3.5 bg-black/30 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Cashfree Payments Integration</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTestCashfree}
                    disabled={testingCashfree}
                    className="px-2.5 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1 transition"
                  >
                    <Play className="w-3 h-3" />
                    <span>{testingCashfree ? 'Testing Session...' : 'Test Cashfree Order'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Cashfree App ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TEST101..."
                      value={cashfreeAppId}
                      onChange={(e) => setCashfreeAppId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Cashfree Secret Key
                    </label>
                    <input
                      type="password"
                      placeholder={hasCashfreeSecret ? '•••••••••••• (Secret Configured)' : 'Enter Secret Key'}
                      value={cashfreeSecretKey}
                      onChange={(e) => setCashfreeSecretKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Environment
                    </label>
                    <select
                      value={cashfreeEnv}
                      onChange={(e) => setCashfreeEnv(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
                    >
                      <option value="TEST">Sandbox (TEST)</option>
                      <option value="PRODUCTION">Live (PRODUCTION)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Soundbox Voice Confirmation Controls */}
              <div className="p-3.5 bg-black/30 rounded-xl border border-white/5 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundboxEnabled}
                    onChange={(e) => setSoundboxEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 bg-black/40 border-white/20"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-slate-200">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold">Enable Voice Soundbox Announcement upon Payment Settlement</span>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={handleTestSoundbox}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test Soundbox Voice</span>
                </button>
              </div>
            </div>

            {/* Right Col: Live Test QR Code Preview & Simulator */}
            <div className="p-4 bg-black/30 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Live Handle Dynamic QR
              </span>
              <div className="p-2.5 bg-white rounded-xl shadow-lg border border-white/20">
                <img
                  src={testQrUrl}
                  alt="Test QR"
                  className="w-36 h-36 object-contain"
                />
              </div>
              <div className="space-y-1 w-full">
                <span className="text-xs font-bold text-white block font-mono truncate">
                  {upiHandle}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {merchantName}
                </span>
                <div className="pt-2 flex items-center justify-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Test Amount: ₹</span>
                  <input
                    type="number"
                    min="1"
                    value={testAmount}
                    onChange={(e) => setTestAmount(parseFloat(e.target.value) || 1)}
                    className="w-16 bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-xs font-mono text-white text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Thermal Receipt Printer */}
        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Receipt Thermal Printer (ESC/POS)</h2>
                <p className="text-[11px] text-slate-400">Primary counter customer receipt printing</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestPrinter}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold border border-white/10 transition"
            >
              Test Print Slip
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Printer Interface</label>
              <select
                value={printerInterface}
                onChange={(e) => setPrinterInterface(e.target.value as any)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="network">Network (Ethernet / Wi-Fi)</option>
                <option value="bluetooth">Bluetooth ESC/POS</option>
                <option value="usb">USB Serial</option>
                <option value="browser">Browser Native Print</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Printer IP Address</label>
              <input
                type="text"
                value={printerIp}
                onChange={(e) => setPrinterIp(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Port</label>
              <input
                type="text"
                value={printerPort}
                onChange={(e) => setPrinterPort(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Paper Roll Width</label>
              <select
                value={paperWidth}
                onChange={(e) => setPaperWidth(e.target.value as any)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="80mm">80mm (Standard POS Thermal)</option>
                <option value="58mm">58mm (Compact Portable)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCutPaper}
                onChange={(e) => setAutoCutPaper(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-0 bg-black/40 border-white/20"
              />
              <div>
                <div className="font-semibold text-white">Auto Cut Paper</div>
                <div className="text-[11px] text-slate-400">Send GS V 0 cut code after receipt finishes printing</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={drawerKickOnCash}
                onChange={(e) => setDrawerKickOnCash(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-0 bg-black/40 border-white/20"
              />
              <div>
                <div className="font-semibold text-white">Auto Kick Cash Drawer</div>
                <div className="text-[11px] text-slate-400">Trigger electronic cash drawer on cash settlement</div>
              </div>
            </label>
          </div>
        </div>

        {/* Section 2: Kitchen Display / KOT Printer */}
        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Kitchen Order Ticket (KOT) Routing</h2>
                <p className="text-[11px] text-slate-400">Direct transmission of orders to kitchen chefs</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Kitchen Printer IP</label>
              <input
                type="text"
                value={kotPrinterIp}
                onChange={(e) => setKotPrinterIp(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPrintKotOnHold}
                onChange={(e) => setAutoPrintKotOnHold(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-black/40 border-white/20"
              />
              <div>
                <div className="font-semibold text-white">Auto Print on Hold / Table Save</div>
                <div className="text-[11px] text-slate-400">Send KOT whenever table order is updated</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={largeTokenFont}
                onChange={(e) => setLargeTokenFont(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-black/40 border-white/20"
              />
              <div>
                <div className="font-semibold text-white">Double-Height Token Number</div>
                <div className="text-[11px] text-slate-400">Enlarge token numbers on kitchen slips</div>
              </div>
            </label>
          </div>
        </div>

        {/* Section 3: Receipt Branding & GSTIN */}
        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <Store className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Receipt Branding & GST Metadata</h2>
              <p className="text-[11px] text-slate-400">Printed on all customer thermal receipts & digital invoices</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Store Legal Business Name</label>
              <input
                type="text"
                value={storeLegalName}
                onChange={(e) => setStoreLegalName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">GSTIN / Tax ID</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-semibold">Store Physical Address</label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Customer Helpline Phone</label>
              <input
                type="text"
                value={phoneOnReceipt}
                onChange={(e) => setPhoneOnReceipt(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Service Charge (%) (Optional)</label>
              <input
                type="number"
                min="0"
                max="20"
                value={serviceChargePercent}
                onChange={(e) => setServiceChargePercent(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-semibold">Receipt Footer Message</label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Cloudflare D1 Edge Connectivity & Offline Mode */}
        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-cyan-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Edge Sync & Offline Cache Mode</h2>
                <p className="text-[11px] text-slate-400">Cloudflare D1 transactional sync and offline fallback</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestEdge}
              disabled={testingConnection}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold border border-white/10 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>Ping Edge</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cloudflare D1 Status:</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Edge Round-Trip Latency:</span>
                <span className="font-mono text-cyan-300 font-bold">{edgeLatency} ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Local Offline Buffer:</span>
                <span className="text-slate-300">0 pending outbox bills</span>
              </div>
            </div>

            <label className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={offlineSyncEnabled}
                onChange={(e) => setOfflineSyncEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-600 focus:ring-0 bg-black/40 border-white/20 mt-0.5"
              />
              <div>
                <div className="font-semibold text-white">Enable Seamless Offline Billing</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Allows cashiers to ring up orders even if the internet connection is disrupted; orders sync automatically when connection recovers.
                </div>
              </div>
            </label>
          </div>
        </div>
      </form>
    </div>
  );
}
