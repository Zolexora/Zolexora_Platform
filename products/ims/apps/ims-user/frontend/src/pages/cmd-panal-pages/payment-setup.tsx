import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Save,
  Volume2,
  KeyRound,
  ShieldCheck,
  Zap,
  Lock,
  Building,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export default function OrgPaymentSetup() {
  const { authFetch } = useAuth();

  // Payment Gateway & Rails State
  const [paymentGateway, setPaymentGateway] = useState<string>('upi_qr');
  const [upiHandle, setUpiHandle] = useState<string>('zolexora@icici');
  const [merchantName, setMerchantName] = useState<string>('Zolexora Retail Operations');
  const [mcc, setMcc] = useState<string>('5812');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState<string>('');
  const [cashfreeAppId, setCashfreeAppId] = useState<string>('');
  const [cashfreeSecretKey, setCashfreeSecretKey] = useState<string>('');
  const [cashfreeEnv, setCashfreeEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [edcTerminalId, setEdcTerminalId] = useState<string>('EDC_TER_001');
  const [soundboxEnabled, setSoundboxEnabled] = useState<boolean>(true);
  const [autoSettle, setAutoSettle] = useState<boolean>(true);

  // Visibility toggles for sensitive API keys
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [showCashfreeSecret, setShowCashfreeSecret] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; gateway: string } | null>(null);
  const [testingGateway, setTestingGateway] = useState(false);

  // Load from database on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/payment/handle');
      if (res.ok) {
        const data = await res.json();
        if (data && data.config) {
          const cfg = data.config;
          setUpiHandle(cfg.upi_handle || 'zolexora@icici');
          setMerchantName(cfg.merchant_name || 'Zolexora Retail Operations');
          setMcc(cfg.merchant_category_code || '5812');
          setPaymentGateway(cfg.payment_gateway || 'upi_qr');
          setRazorpayKeyId(cfg.razorpay_key_id || '');
          setRazorpayKeySecret(cfg.razorpay_key_secret || '');
          setCashfreeAppId(cfg.cashfree_app_id || '');
          setCashfreeSecretKey(cfg.cashfree_secret_key || '');
          setCashfreeEnv(cfg.cashfree_env || 'sandbox');
          setEdcTerminalId(cfg.edc_terminal_id || 'EDC_TER_001');
          setSoundboxEnabled(cfg.soundbox_enabled !== false);
          setAutoSettle(cfg.auto_settle !== false);
        }
      }
    } catch (err) {
      console.error('Failed to load payment config from DB:', err);
    }
    setLoading(false);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch('/api/v1/payment/handle', {
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
          auto_settle: autoSettle,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save payment settings:', err);
    }
    setSaving(false);
  };

  // Test Soundbox Voice Synthesizer
  const handleTestSoundbox = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `Received payment of rupees 450 successfully via UPI.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
      setTestResult({
        ok: true,
        gateway: 'Voice Soundbox',
        message: 'Speech synthesis announcement dispatched to computer speakers',
      });
    } else {
      setTestResult({
        ok: false,
        gateway: 'Voice Soundbox',
        message: 'Browser does not support HTML5 SpeechSynthesis API',
      });
    }
  };

  // Test Cashfree API Connection
  const handleTestCashfree = async () => {
    setTestingGateway(true);
    try {
      const res = await authFetch('/api/v1/payment/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1.0,
          bill_no: `TEST_${Date.now()}`,
          customer_phone: '9876543210',
          customer_email: 'finance@zolexora.com',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          gateway: 'Cashfree',
          message: `Connection Valid! Session created: ${data.order_id} (Env: ${data.environment})`,
          ok: true,
        });
      } else {
        setTestResult({
          gateway: 'Cashfree',
          message: data.detail || 'Credentials validation rejected by Cashfree API',
          ok: false,
        });
      }
    } catch (err: any) {
      setTestResult({ gateway: 'Cashfree', message: err.message || 'Network error', ok: false });
    }
    setTestingGateway(false);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Payment Rails & Bank Gateways</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
              CONFIDENTIAL • COMMANDER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure merchant VPA, bank settlement accounts, API secrets, and instant settlement policies. These credentials are isolated from cashier POS counters.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving to Database...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Payment credentials securely encrypted and persisted in Cloudflare D1 / SQLite database.</span>
          </div>
        </div>
      )}

      {/* Test Feedback Banner */}
      {testResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            testResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>
              <strong>[{testResult.gateway}]</strong> {testResult.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-white text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Gateway Selector Tabs */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-slate-300 mb-2 font-semibold text-xs">
            Active Checkout Payment Gateway
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'upi_qr',
                name: 'Direct Dynamic UPI QR',
                desc: '0% MDR • Direct to SBI / Bank • 0-Sec Instant Settle',
                tag: 'RECOMMENDED',
              },
              {
                id: 'razorpay',
                name: 'Razorpay PG',
                desc: 'Credit/Debit Cards, NetBanking, International & UPI',
                tag: 'CARDS & NETBANKING',
              },
              {
                id: 'cashfree',
                name: 'Cashfree Payments',
                desc: 'Drop Checkout, Multi-Rail Auto Settle & Webhooks',
                tag: 'ENTERPRISE PG',
              },
            ].map((gw) => (
              <button
                type="button"
                key={gw.id}
                onClick={() => setPaymentGateway(gw.id)}
                className={`p-3.5 rounded-xl border text-left transition ${
                  paymentGateway === gw.id
                    ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-900/20'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{gw.name}</span>
                  {paymentGateway === gw.id && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{gw.desc}</div>
                <span className="mt-2 inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {gw.tag}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 1: NPCI Direct Dynamic UPI (SBI / Bank Merchant VPA) */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Direct Dynamic UPI (NPCI Direct-to-Bank)</h2>
              <p className="text-[11px] text-slate-400">
                0% MDR, 0-second instant settlement directly into your SBI Current Account with RuPay Credit Card support
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestSoundbox}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs font-semibold transition"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Soundbox</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">
              Merchant UPI Handle (VPA) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. yourbusiness@sbi, yourstore@okhdfcbank"
              value={upiHandle}
              onChange={(e) => setUpiHandle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Dynamic QR codes for bills encode this payee VPA (`pa={upiHandle}`).
            </span>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">
              Legal Payee / Business Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Zolexora Retail Operations"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Exact legal business name registered on your Current Account.
            </span>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">
              Merchant Category Code (MCC)
            </label>
            <select
              value={mcc}
              onChange={(e) => setMcc(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            >
              <option value="5812">5812 — Eating Places & Restaurants</option>
              <option value="5814">5814 — Fast Food & Specialty Cafes</option>
              <option value="5411">5411 — Grocery Stores & Supermarkets</option>
              <option value="5311">5311 — Department & Retail Stores</option>
              <option value="5691">5691 — Men's & Women's Apparel</option>
              <option value="5912">5912 — Drug Stores & Pharmacies</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">
              EDC Android Card Terminal ID
            </label>
            <input
              type="text"
              placeholder="e.g. EDC_TER_001 (Pine Labs / Hitachi)"
              value={edcTerminalId}
              onChange={(e) => setEdcTerminalId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>
        </div>

        {/* Checkboxes: Instant Settle & Soundbox */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSettle}
              onChange={(e) => setAutoSettle(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-0 bg-black/40 border-white/20"
            />
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant Settlement Enabled</span>
              </div>
              <div className="text-[11px] text-slate-400">
                0-second real-time IMPS credit to your SBI account without overnight hold.
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={soundboxEnabled}
              onChange={(e) => setSoundboxEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-0 bg-black/40 border-white/20"
            />
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voice Soundbox Audio</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Speaks payment amount loudly over counter speakers upon successful receipt.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Section 2: Razorpay Gateway Credentials */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Razorpay Payment Gateway API Keys</h2>
              <p className="text-[11px] text-slate-400">
                Used for Credit/Debit cards (Visa/Mastercard) and NetBanking orders
              </p>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">dashboard.razorpay.com</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Razorpay Key ID</label>
            <input
              type="text"
              placeholder="rzp_live_xxxxxxxxxxxxxxxx"
              value={razorpayKeyId}
              onChange={(e) => setRazorpayKeyId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Razorpay Key Secret</label>
            <div className="relative">
              <input
                type={showRazorpaySecret ? 'text' : 'password'}
                placeholder="••••••••••••••••••••••••"
                value={razorpayKeySecret}
                onChange={(e) => setRazorpayKeySecret(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowRazorpaySecret(!showRazorpaySecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                {showRazorpaySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Cashfree Payments Credentials */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Cashfree Payments API Credentials</h2>
              <p className="text-[11px] text-slate-400">
                Drop Checkout, dynamic multi-rail webhooks, and 24x7 instant payouts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestCashfree}
            disabled={testingGateway}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg text-xs font-semibold transition"
          >
            {testingGateway ? 'Testing API...' : 'Test Cashfree Connection'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Cashfree App ID</label>
            <input
              type="text"
              placeholder="e.g. CF_APP_xxxxxxxx"
              value={cashfreeAppId}
              onChange={(e) => setCashfreeAppId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Cashfree Secret Key</label>
            <div className="relative">
              <input
                type={showCashfreeSecret ? 'text' : 'password'}
                placeholder="••••••••••••••••••••••••"
                value={cashfreeSecretKey}
                onChange={(e) => setCashfreeSecretKey(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowCashfreeSecret(!showCashfreeSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                {showCashfreeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Environment</label>
            <select
              value={cashfreeEnv}
              onChange={(e) => setCashfreeEnv(e.target.value as any)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            >
              <option value="sandbox">Sandbox (Testing / Test Mode)</option>
              <option value="production">Production (Live Payments)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
