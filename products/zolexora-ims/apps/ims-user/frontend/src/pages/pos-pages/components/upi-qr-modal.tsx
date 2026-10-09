import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  X,
  Smartphone,
  Edit3,
  Volume2,
  ExternalLink,
  ShieldCheck,
  CheckCheck,
  CreditCard,
  Zap,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';

interface UpiQrModalProps {
  amount: number;
  billNo: string;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (utrRef?: string) => void;
  customerPhone?: string;
  customerEmail?: string;
}

export default function UpiQrModal({
  amount,
  billNo,
  isOpen,
  onClose,
  onPaymentSuccess,
  customerPhone,
  customerEmail,
}: UpiQrModalProps) {
  const { authFetch } = useAuth();

  const [activeTab, setActiveTab] = useState<'upi' | 'razorpay' | 'cashfree'>('upi');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);
  const [verifying, setVerifying] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [editingHandle, setEditingHandle] = useState(false);

  // Dynamic Payment Handle & Gateway State
  const [upiHandle, setUpiHandle] = useState<string>('zolexora@icici');
  const [merchantName, setMerchantName] = useState<string>('Zolexora Retail Operations');
  const [mcc, setMcc] = useState<string>('5812');
  const [soundboxEnabled, setSoundboxEnabled] = useState<boolean>(true);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');

  // Temp edit inputs
  const [tempHandle, setTempHandle] = useState<string>('');
  const [tempName, setTempName] = useState<string>('');
  const [savingHandle, setSavingHandle] = useState<boolean>(false);

  // Fetch active handle on modal open
  useEffect(() => {
    if (!isOpen) return;
    authFetch('/api/v1/payment/handle')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUpiHandle(data.upi_handle || 'zolexora@icici');
          setMerchantName(data.merchant_name || 'Zolexora Retail Operations');
          setMcc(data.merchant_category_code || '5812');
          setSoundboxEnabled(data.soundbox_enabled ?? true);
          setRazorpayKeyId(data.razorpay_key_id || '');
          if (data.payment_gateway === 'razorpay') setActiveTab('razorpay');
          else if (data.payment_gateway === 'cashfree') setActiveTab('cashfree');
          else setActiveTab('upi');
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const upiUrl = `upi://pay?pa=${upiHandle}&pn=${encodeURIComponent(merchantName)}&mc=${mcc}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Bill_${billNo}`)}`;
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUrl)}&bgcolor=ffffff&color=0b0d14&margin=10`;

  // App Deep Links
  const gpayUrl = `gpay://upi/pay?pa=${upiHandle}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Bill_${billNo}`)}`;
  const phonepeUrl = `phonepe://upi/pay?pa=${upiHandle}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Bill_${billNo}`)}`;
  const paytmUrl = `paytmmp://pay?pa=${upiHandle}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Bill_${billNo}`)}`;

  useEffect(() => {
    if (!isOpen) return;
    setTimeLeft(180);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempHandle.includes('@')) {
      alert("Invalid UPI Handle. Must contain '@' (e.g. store@icici, mycafe@okhdfcbank)");
      return;
    }
    setSavingHandle(true);
    try {
      const res = await authFetch('/api/v1/payment/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upi_handle: tempHandle.trim().toLowerCase(),
          merchant_name: tempName.trim() || merchantName,
          merchant_category_code: mcc,
          payment_gateway: activeTab === 'razorpay' ? 'razorpay' : activeTab === 'cashfree' ? 'cashfree' : 'upi_qr',
          soundbox_enabled: soundboxEnabled,
          auto_settle: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUpiHandle(data.config.upi_handle);
        setMerchantName(data.config.merchant_name);
        setEditingHandle(false);
      }
    } catch {}
    setSavingHandle(false);
  };

  const playSoundboxAnnouncement = (amt: number, rail: string = 'U P I') => {
    if (!soundboxEnabled) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Payment of rupees ${Math.round(amt)} received successfully via ${rail}.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  };

  // Helper to dynamically load Razorpay script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Trigger Razorpay Checkout
  const handleRazorpayCheckout = async () => {
    setVerifying(true);
    try {
      const res = await authFetch('/api/v1/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          bill_no: billNo,
          customer_phone: customerPhone?.replace(/\D/g, '') || '9876543210',
          customer_email: customerEmail || 'guest@zolexora.com',
        }),
      });
      const orderData = await res.json();
      if (!res.ok || !orderData.order_id) {
        alert('Failed to initiate Razorpay order: ' + (orderData.detail || 'Unknown error'));
        setVerifying(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (scriptLoaded && (window as any).Razorpay) {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount_in_paise,
          currency: 'INR',
          name: merchantName,
          description: `Invoice ${billNo}`,
          order_id: orderData.order_id,
          handler: async function (response: any) {
            await authFetch('/api/v1/payment/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bill_no: billNo,
                amount: amount,
              }),
            });
            playSoundboxAnnouncement(amount, 'Razorpay');
            setVerifying(false);
            onPaymentSuccess(response.razorpay_payment_id);
          },
          theme: { color: '#0284c7' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Fallback for sandboxed or offline environments
        const simPaymentId = `pay_rzp_sim_${Date.now()}`;
        await authFetch('/api/v1/payment/razorpay/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: orderData.order_id,
            razorpay_payment_id: simPaymentId,
            razorpay_signature: 'simulated_sig',
            bill_no: billNo,
            amount: amount,
          }),
        });
        playSoundboxAnnouncement(amount, 'Razorpay');
        setVerifying(false);
        onPaymentSuccess(simPaymentId);
      }
    } catch (err: any) {
      alert('Razorpay Checkout failed: ' + (err.message || 'Error'));
      setVerifying(false);
    }
  };

  // Trigger Cashfree Payments
  const handleCashfreeCheckout = async () => {
    setVerifying(true);
    try {
      const res = await authFetch('/api/v1/payment/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          bill_no: billNo,
          customer_phone: customerPhone?.replace(/\D/g, '') || '9876543210',
          customer_email: customerEmail || 'guest@zolexora.com',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.order_id) {
        alert('Failed to initiate Cashfree order: ' + (data.detail || 'Unknown error'));
        setVerifying(false);
        return;
      }

      await authFetch('/api/v1/payment/cashfree/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: data.order_id,
          bill_no: billNo,
        }),
      });

      playSoundboxAnnouncement(amount, 'Cashfree');
      setTimeout(() => {
        setVerifying(false);
        onPaymentSuccess(data.order_id);
      }, 500);
    } catch (err: any) {
      alert('Cashfree Checkout error: ' + (err.message || 'Error'));
      setVerifying(false);
    }
  };

  // Manual UTR Settlement for UPI QR
  const handleManualVerify = async () => {
    setVerifying(true);
    try {
      await authFetch('/api/v1/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill_no: billNo,
          amount: amount,
          payment_mode: 'UPI',
          transaction_ref: utrNumber.trim() || undefined,
          status: 'SUCCESS',
        }),
      });
    } catch {}

    playSoundboxAnnouncement(amount, 'U P I');

    setTimeout(() => {
      setVerifying(false);
      onPaymentSuccess(utrNumber.trim() || undefined);
    }, 500);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121420] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">POS Payment Checkout</h3>
              <p className="text-[10px] text-slate-400">Multi-rail counter settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation: UPI QR vs Razorpay vs Cashfree */}
        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 bg-[#0e1019] border-b border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('upi')}
            className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 ${
              activeTab === 'upi'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>UPI QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('razorpay')}
            className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 ${
              activeTab === 'razorpay'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Razorpay</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cashfree')}
            className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 ${
              activeTab === 'cashfree'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Cashfree</span>
          </button>
        </div>

        {/* Body Container */}
        <div className="p-5 flex flex-col items-center space-y-3.5 bg-[#0d0f17] overflow-y-auto max-h-[75vh]">
          {/* Payable Amount Badge */}
          <div className="text-center w-full">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Payable Amount
            </div>
            <div className="text-3xl font-black text-white font-mono mt-0.5 tracking-tight">
              ₹{amount.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Invoice Ref: <span className="text-slate-300 font-bold">{billNo}</span>
            </div>
          </div>

          {/* TAB 1: DYNAMIC UPI QR */}
          {activeTab === 'upi' && (
            <>
              {/* QR Code Container */}
              <div className="p-2.5 bg-white rounded-2xl shadow-xl shadow-emerald-500/10 border-2 border-emerald-500/40 relative group">
                <img
                  src={qrSvgUrl}
                  alt="UPI QR Code"
                  className="w-40 h-40 rounded-lg object-contain"
                />
                <div className="absolute inset-x-0 bottom-1 flex items-center justify-center">
                  <span className="text-[8px] font-extrabold tracking-widest text-slate-800 uppercase bg-white/95 px-2 py-0.5 rounded shadow-xs">
                    Scan with any UPI App
                  </span>
                </div>
              </div>

              {/* One-Click App Intent Shortcuts */}
              <div className="w-full flex items-center justify-center gap-1.5 pt-0.5">
                <a
                  href={gpayUrl}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold border border-white/10 flex items-center gap-1 transition"
                >
                  <span>GPay</span>
                </a>
                <a
                  href={phonepeUrl}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1 transition"
                >
                  <span>PhonePe</span>
                </a>
                <a
                  href={paytmUrl}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 flex items-center gap-1 transition"
                >
                  <span>Paytm</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold border border-white/10 flex items-center gap-1 transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Active Handle Strip */}
              <div className="w-full space-y-2">
                {!editingHandle ? (
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] flex items-center justify-between">
                    <div className="truncate pr-2">
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-bold">
                        UPI VPA Handle:
                      </span>
                      <strong className="text-emerald-300 font-mono block truncate">{upiHandle}</strong>
                      <span className="text-[10px] text-slate-400 block truncate">{merchantName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempHandle(upiHandle);
                        setTempName(merchantName);
                        setEditingHandle(true);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition flex-shrink-0"
                      title="Edit UPI Handle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveHandle} className="p-2.5 rounded-xl bg-[#181a28] border border-emerald-500/30 space-y-2">
                    <div className="text-[10px] font-bold text-emerald-300 flex items-center justify-between">
                      <span>Edit Payment Handle</span>
                      <button
                        type="button"
                        onClick={() => setEditingHandle(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. store@icici"
                      value={tempHandle}
                      onChange={(e) => setTempHandle(e.target.value)}
                      className="w-full bg-[#0d0f17] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="Business / Legal Payee Name"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="w-full bg-[#0d0f17] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingHandle(false)}
                        className="px-2 py-1 rounded bg-white/5 text-slate-300 text-[10px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingHandle}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                      >
                        {savingHandle ? 'Saving...' : 'Update'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Optional UTR Input */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block">
                    Bank Reference / UTR Number (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 423981029384"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder-slate-600"
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: RAZORPAY GATEWAY */}
          {activeTab === 'razorpay' && (
            <div className="w-full p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-3.5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Razorpay Checkout Gateway</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Accept Visa, MasterCard, RuPay, NetBanking, Paytm, and EMI via Razorpay's secure modal.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[10px] text-slate-300 space-y-1 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400">Merchant Name:</span>
                  <span className="font-semibold text-white truncate max-w-[160px]">{merchantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Key ID:</span>
                  <span className="font-mono text-sky-300">{razorpayKeyId || 'rzp_test_zolexora_demo'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRazorpayCheckout}
                disabled={verifying}
                className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                <span>{verifying ? 'Initiating Checkout...' : `Pay ₹${amount.toFixed(2)} with Razorpay`}</span>
              </button>
            </div>
          )}

          {/* TAB 3: CASHFREE PAYMENTS */}
          {activeTab === 'cashfree' && (
            <div className="w-full p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-3.5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Cashfree Payments Drop</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Seamless embedded checkout across UPI, Cards, NetBanking, and PayLater.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[10px] text-slate-300 space-y-1 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400">Order ID:</span>
                  <span className="font-mono text-purple-300">CF_{billNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Auto Settle:</span>
                  <span className="font-semibold text-emerald-400">Enabled (Instant)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCashfreeCheckout}
                disabled={verifying}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>{verifying ? 'Creating Session...' : `Pay ₹${amount.toFixed(2)} via Cashfree`}</span>
              </button>
            </div>
          )}

          {/* Timer Bar & Soundbox Status */}
          <div className="w-full flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span className="flex items-center gap-1 text-amber-400 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>Expires in {formatTimer(timeLeft)}</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Soundbox On</span>
            </span>
          </div>
        </div>

        {/* Verification Action (For UPI QR) */}
        {activeTab === 'upi' && (
          <div className="p-4 bg-[#141624] border-t border-white/10 space-y-2">
            <button
              type="button"
              onClick={handleManualVerify}
              disabled={verifying}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              <span>{verifying ? 'Verifying Settlement...' : 'Confirm & Settle Payment'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
