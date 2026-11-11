import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Save,
  Volume2,
  Zap,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

const GATEWAYS = [
  { id: 'upi_qr', name: 'Direct Dynamic UPI QR', desc: '0% MDR • Direct to SBI / Bank • 0-Sec Instant Settle', tag: 'RECOMMENDED', connect: false },
  { id: 'razorpay', name: 'Razorpay PG', desc: 'Credit/Debit Cards, NetBanking, International & UPI', tag: 'COMING SOON', connect: true },
  { id: 'cashfree', name: 'Cashfree Payments', desc: 'Drop Checkout, Multi-Rail Auto Settle & Webhooks', tag: 'COMING SOON', connect: true },
];

export default function OrgPaymentSetup() {
  const { authFetch, org } = useAuth();

  // Payment Gateway & Rails State
  const [paymentGateway, setPaymentGateway] = useState<string>('upi_qr');
  const [upiHandle, setUpiHandle] = useState<string>('');
  const [merchantName, setMerchantName] = useState<string>('Zolexora Retail Operations');
  const [mcc, setMcc] = useState<string>('5812');
  const [edcTerminalId, setEdcTerminalId] = useState<string>('EDC_TER_001');
  const [soundboxEnabled, setSoundboxEnabled] = useState<boolean>(true);
  const [autoSettle, setAutoSettle] = useState<boolean>(true);

  // Status & Feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; gateway: string } | null>(null);

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
        if (data) {
          const cfg = data;
          setUpiHandle(cfg.upi_handle || '');
          setMerchantName(cfg.merchant_name || '');
          setMcc(cfg.merchant_category_code || '5812');
          setPaymentGateway(GATEWAYS.find((g) => g.id === cfg.payment_gateway && !g.connect) ? cfg.payment_gateway : 'upi_qr');
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
            Configure the merchant VPA, card & netbanking gateway connections, and settlement policies. Cashier POS counters cannot change these.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Payment settings saved for this business.</span>
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
            {GATEWAYS.map((gw) => (
              <button
                type="button"
                key={gw.id}
                disabled={gw.connect}
                onClick={() => setPaymentGateway(gw.id)}
                className={`p-3.5 rounded-xl border text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
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

      {/* Section 2: Card & netbanking gateways (provider connections) */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white">Card & Netbanking Gateways</h2>
            <p className="text-[11px] text-slate-400">Customers pay by card or netbanking through the business's own Razorpay or Cashfree account, connected on the provider's own sign-in and consent screen. IMS never asks for API keys or secrets. Available once Zolexora is an approved Razorpay and Cashfree partner.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {GATEWAYS.filter((g) => g.connect).map((gw) => (
            <div key={gw.id} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/10">
              <div>
                <div className="font-bold text-white">{gw.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{gw.desc}</div>
              </div>
              <button
                type="button"
                disabled
                title="Available once Zolexora is an approved partner"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-slate-400 border border-white/10 rounded-lg font-semibold cursor-not-allowed"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Connect</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
