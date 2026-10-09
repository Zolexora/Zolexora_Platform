"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCartStore, useAuthStore } from "@/store";
import { cartApi, coinsApi, usersApi, Address } from "@/lib/api";
import {
  Trash2, Plus, Minus, ShoppingBag, Coins, ArrowRight,
  QrCode, Smartphone, CreditCard, CheckCircle, Copy, Loader2,
  MapPin, Check, PlusCircle, CheckCircle2, ShieldCheck, Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import toast from "react-hot-toast";

type PayMethod = "razorpay" | "upi" | "coins";
type Step = "cart" | "address" | "payment" | "upi_scan" | "done";

interface Addr { name:string; phone:string; email:string; address:string; city:string; state:string; pincode:string; }

interface UpiData {
  amount: number;
  upi_link: string;
  upi_id: string;
  order_id: string;
  type: "upi";
}

interface RazorpayCheckout {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: {
    key?: string;
    amount: number;
    currency: string;
    order_id?: string;
    name: string;
    description: string;
    handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => Promise<void>;
    prefill: { name: string; email: string; contact: string };
    theme: { color: string };
    modal: { ondismiss: () => void };
  }): RazorpayCheckout;
}

/* Simple QR using canvas (replace with `qrcode` npm pkg for production) */
function QRCanvas({ data, size=180 }: { data:string; size?:number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(!ref.current||!data)return;
    const ctx=ref.current.getContext("2d")!;
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,size,size);
    ctx.fillStyle="#111";
    const cell=size/25;
    for(let r=0;r<25;r++) for(let c=0;c<25;c++)
      if((r+c*3+data.charCodeAt(r%data.length))%3===0) ctx.fillRect(c*cell,r*cell,cell-1,cell-1);
    [[0,0],[0,18],[18,0]].forEach(([r,c])=>{
      ctx.strokeStyle="#111";ctx.lineWidth=2;
      ctx.strokeRect(c*cell,r*cell,7*cell,7*cell);
      ctx.fillRect((c+2)*cell,(r+2)*cell,3*cell,3*cell);
    });
  },[data,size]);
  return <canvas ref={ref} width={size} height={size} className="rounded-2xl border-2 border-gray-100 shadow"/>;
}

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, loading, fetch, updateQty, removeItem } = useCartStore();

  const [step,       setStep]       = useState<Step>("cart");
  const [busy,       setBusy]       = useState(false);
  const [coinBal,    setCoinBal]    = useState(0);
  const [coinsToUse, setCoinsToUse] = useState(0);
  const [payMethod,  setPayMethod]  = useState<PayMethod>("razorpay");
  const [upiData,    setUpiData]    = useState<UpiData | null>(null);
  const [utr,        setUtr]        = useState("");
  const [orderId,    setOrderId]    = useState("");
  const [addr, setAddr] = useState<Addr>({ name:"",phone:"",email:"",address:"",city:"",state:"",pincode:"" });

  // Address card selection and creation states
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [showNewForm,    setShowNewForm]    = useState(false);
  const [savingAddr,     setSavingAddr]     = useState(false);
  const [verifiedPhones, setVerifiedPhones] = useState<string[]>([]);
  const [verifiedEmails, setVerifiedEmails] = useState<string[]>([]);
  const [phoneMode,      setPhoneMode]      = useState<"select" | "custom">("select");
  const [emailMode,      setEmailMode]      = useState<"select" | "custom">("select");
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [phoneOtpSent,   setPhoneOtpSent]   = useState(false);
  const [phoneVerified,  setPhoneVerified]  = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [emailOtpSent,   setEmailOtpSent]   = useState(false);
  const [emailVerified,  setEmailVerified]  = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Pincode Resolution State
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeResolved, setPincodeResolved] = useState<any>(null);
  const [pincodeError, setPincodeError] = useState("");
  const [postOffices, setPostOffices] = useState<any[]>([]);
  const [serviceability, setServiceability] = useState<any>(null);

  const [newAddrForm, setNewAddrForm] = useState({
    name: "",
    phone: "",
    email: "",
    house_no: "",
    village_town: "",
    landmark: "",
    pincode: "",
    post_office: "",
    district: "",
    division: "",
    region: "",
    state: "",
    country: "INDIA",
    postal_delivery_status: "",
    digipin: "",
    address_line: "",
    city: "",
    is_default: false,
    phone_otp: "",
    email_otp: "",
  });

  const handlePincodeChange = async (pin: string) => {
    const clean = pin.replace(/\D/g, "").slice(0, 6);
    setNewAddrForm(prev => ({
      ...prev,
      pincode: clean,
      post_office: "",
      district: "",
      division: "",
      region: "",
      state: "",
      country: "INDIA",
      postal_delivery_status: "",
    }));
    setPincodeResolved(null);
    setPincodeError("");
    setPostOffices([]);
    setServiceability(null);

    if (clean.length === 6) {
      setPincodeLoading(true);
      try {
        const [data, serv] = await Promise.all([
          usersApi.lookupPincode(clean),
          usersApi.checkServiceability(clean).catch(() => null),
        ]);
        setPincodeResolved(data);
        setPostOffices(data.post_offices);
        setServiceability(serv);

        let autoPo = "";
        if (data.post_offices.length === 1) {
          autoPo = data.post_offices[0].name;
        }

        setNewAddrForm(prev => ({
          ...prev,
          post_office: autoPo,
          district: data.district,
          division: data.division,
          region: data.region,
          state: data.state,
          country: data.country || "INDIA",
          postal_delivery_status: data.postal_delivery_status,
          city: prev.village_town || data.district,
        }));
      } catch (err: any) {
        setPincodeError(err?.response?.data?.detail || "Pincode not found or invalid. Please check.");
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const selectAddress = (a: Address) => {
    setSelectedAddrId(a.id);
    setAddr({
      name: a.name,
      phone: a.phone,
      email: a.email || user?.email || "",
      address: a.address_line,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    });
  };

  const loadSavedAddresses = async () => {
    try {
      const [list, profile] = await Promise.all([
        usersApi.getAddresses().catch(() => []),
        usersApi.getProfile().catch(() => null),
      ]);
      setSavedAddresses(list);

      const phones = profile?.contacts?.verified_phones || Array.from(new Set(list.map((a: Address) => a.phone).filter(Boolean)));
      const emails = profile?.contacts?.verified_emails || (user?.email ? [user.email] : []);

      setVerifiedPhones(phones);
      setVerifiedEmails(emails);

      if (phones.length > 0) {
        setPhoneMode("select");
        setNewAddrForm(prev => ({ ...prev, phone: phones[0] }));
        setPhoneVerified(true);
      } else {
        setPhoneMode("custom");
        setPhoneVerified(false);
      }

      if (emails.length > 0) {
        setEmailMode("select");
        setNewAddrForm(prev => ({ ...prev, email: emails[0] }));
        setEmailVerified(true);
      } else {
        setEmailMode("custom");
        setEmailVerified(false);
      }

      if (list.length > 0) {
        const def = list.find(a => a.is_default) || list[0];
        selectAddress(def);
        setShowNewForm(false);
      } else {
        setShowNewForm(true);
      }
    } catch {
      setShowNewForm(true);
    }
  };

  useEffect(()=>{
    if(!user){router.push("/auth");return;}
    fetch();
    coinsApi.balance().then(d=>setCoinBal(d.coin_balance)).catch(()=>{});
    if(user) {
      setAddr(a=>({...a,name:user.name||"",email:user.email||""}));
      setNewAddrForm(a=>({...a,name:user.name||"",email:user.email||""}));
      loadSavedAddresses();
    }
  },[user, fetch, router]);

  const subtotal     = items.reduce((s,i) => s + ((i.product.price.amount_minor / 100) * i.quantity), 0);
  const tax          = subtotal * 0.18;
  const delivery     = subtotal >= 499 ? 0 : 49;
  const maxCoins     = Math.min(coinBal,Math.floor((subtotal*0.5)/0.01));
  const coinDiscount = parseFloat((coinsToUse*0.01).toFixed(2));
  const total        = Math.max(0,subtotal-coinDiscount+delivery);

  const go = async (fn:()=>Promise<void>) => {
    setBusy(true);
    try{
      await fn();
    } catch(error) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckout = () => go(async()=>{
    const res = await cartApi.checkout({
      coins_to_use:coinsToUse, payment_method:payMethod,
      delivery_address:addr,
    });

    if(res.type==="coins"){ setOrderId(res.order_id); setStep("done"); fetch(); return; }

    if(res.type==="upi"){
      setUpiData(res as UpiData); setOrderId(res.order_id); setStep("upi_scan");
      if(typeof window!=="undefined"&&/Android|iPhone|iPad/i.test(navigator.userAgent))
        window.location.href=res.upi_link;
      return;
    }

    if(res.type==="razorpay"){
      try {
        if (!(window as any).Razorpay) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }
        const razorpayKey = res.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY;
        if (!razorpayKey) {
          toast.error("Razorpay Key ID is not configured on the backend.");
          return;
        }
        const rzp = new (window as any).Razorpay({
          key: razorpayKey,
          amount: Math.round(res.amount * 100),
          currency: "INR",
          order_id: res.razorpay_order_id,
          name: "Zolexora",
          description: "Order Payment",
          handler: async (rz: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await cartApi.verifyRazorpay(rz.razorpay_order_id, rz.razorpay_payment_id, rz.razorpay_signature);
              setOrderId(res.order_id);
              setStep("done");
              fetch();
            } catch (e: any) {
              toast.error(e?.response?.data?.detail || "Payment verification failed");
            }
          },
          prefill: { name: addr.name, email: addr.email, contact: addr.phone },
          theme: { color: "#FFB800" },
          modal: { ondismiss: () => toast("Payment cancelled", { icon: "ℹ️" }) },
        });
        rzp.open();
      } catch (err) {
        toast.error("Failed to load Razorpay payment SDK");
      }
      return;
    }

    if(res.type==="cashfree"){
      try {
        if (!(window as any).Cashfree) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }
        const mode = (res.environment || process.env.NEXT_PUBLIC_CASHFREE_MODE || "sandbox").toLowerCase();
        const cashfree = (window as any).Cashfree({ mode: mode === "production" ? "production" : "sandbox" });
        cashfree.checkout({
          paymentSessionId: res.payment_session_id,
          redirectTarget: "_modal"
        }).then(async (result: { error?: { message?: string }; paymentDetails?: any }) => {
          if (result?.error) {
            toast.error(result.error.message || "Payment cancelled or failed");
          }
          if (result?.paymentDetails) {
            try {
              await cartApi.verifyCashfree(res.order_id);
            } catch { /* auto-sync fallback */ }
            setOrderId(res.order_id);
            setStep("done");
            fetch();
            router.push(`/orders/${res.order_id}`);
          }
        }).catch(() => {
          // Fallback if modal cannot open
          cashfree.checkout({ paymentSessionId: res.payment_session_id, redirectTarget: "_self" });
        });
      } catch (e) {
        toast.error("Failed to load payment gateway");
      }
      return;
    }

    toast("Order saved. We'll contact you.",{icon:"ℹ️"});
    router.push("/orders");
  });

  const submitUtr = () => go(async()=>{
    if(!utr.trim()||utr.trim().length<6){toast.error("Enter a valid UTR / Transaction Reference");return;}
    await cartApi.upiPaid(orderId,utr.trim());
    setStep("done"); fetch();
    toast.success("Payment submitted! Pending verification.");
  });

  if(!user) return null;

  /* ── DONE ─────────────────────────────────────────────────────── */
  if(step==="done") return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <motion.div initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}}
        className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={40} className="text-green-500"/>
      </motion.div>
      <h1 className="font-display text-2xl font-bold text-ink mb-2">
        {upiData?"Payment Submitted!":"Order Placed!"}
      </h1>
      <p className="text-ink-muted text-sm mb-2">Order #{orderId.slice(0,8).toUpperCase()}</p>
      {upiData&&<p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-8">
        Your payment is <strong>pending verification</strong>. We&apos;ll confirm within a few hours.
      </p>}
      <Link href="/orders" className="h-12 px-8 bg-gold rounded-xl inline-flex items-center gap-2 font-bold text-sm text-ink">
        View My Orders <ArrowRight size={16}/>
      </Link>
    </div>
  );

  /* ── UPI SCAN ──────────────────────────────────────────────────── */
  if(step==="upi_scan"&&upiData) return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="font-display text-xl font-bold text-ink mb-1 text-center">Pay via UPI</h1>
      <p className="text-ink-muted text-sm text-center mb-6">
        Amount: <strong className="text-ink">₹{upiData.amount?.toLocaleString("en-IN")}</strong>
      </p>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-4 mb-4">
        <QRCanvas data={upiData.upi_link} size={200}/>
        <p className="text-xs text-ink-muted text-center">Scan with GPay, PhonePe, Paytm or any UPI app</p>
        <div className="w-full border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 text-center mb-2">Or pay directly to UPI ID:</p>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
            <span className="flex-1 font-mono text-sm font-bold text-ink">{upiData.upi_id}</span>
            <button onClick={()=>{navigator.clipboard.writeText(upiData.upi_id);toast.success("Copied!");}}
              className="text-gray-400 hover:text-gold"><Copy size={14}/></button>
          </div>
        </div>
        <a href={upiData.upi_link}
          className="w-full h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors">
          <Smartphone size={16}/> Open UPI App
        </a>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 mb-4 text-xs text-blue-800 space-y-1">
        <p className="font-semibold mb-1">After paying:</p>
        <p>1. Copy the UTR / Transaction Reference from your UPI app</p>
        <p>2. Paste it below and click &quot;I have paid&quot;</p>
        <p>3. We verify within a few hours and confirm your order</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <label className="block text-sm font-semibold text-ink">UTR / Transaction Reference</label>
        <input value={utr} onChange={e=>setUtr(e.target.value)} placeholder="e.g. 415123456789"
          className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono focus:outline-none focus:border-gold focus:bg-white transition-all"/>
        <p className="text-[11px] text-gray-400">12-digit UTR from your UPI app transaction history</p>
        <button onClick={submitUtr} disabled={busy||!utr.trim()}
          className="w-full h-12 bg-gold hover:bg-amber-400 rounded-xl font-bold text-sm text-ink transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {busy?<Loader2 size={16} className="animate-spin"/>:<><CheckCircle size={16}/> I have paid — Submit</>}
        </button>
      </div>
      <button onClick={()=>{setStep("cart");setUpiData(null);setUtr("");}} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 py-2">← Back to cart</button>
    </div>
  );

  /* ── PAYMENT ───────────────────────────────────────────────────── */
  if(step==="payment") return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <button onClick={()=>setStep("address")} className="text-sm text-gray-400 hover:text-gray-600 mb-4">← Back</button>
      <h1 className="font-display text-xl font-bold text-ink mb-6">Payment Method</h1>
      <div className="space-y-3 mb-6">
        {[
          {id:"razorpay",label:"Card / Net Banking / Wallet",desc:"Visa, Mastercard, UPI apps, wallets via Razorpay",icon:<CreditCard size={20} className="text-blue-600"/>,badge:"Instant"},
          {id:"upi",label:"UPI / QR Code",desc:"Pay directly to our UPI ID — manual verification within hours",icon:<QrCode size={20} className="text-green-600"/>,badge:"Manual verify"},
          ...(total===0?[{id:"coins",label:"Pay with Coins",desc:"Your coins cover the full amount",icon:<Coins size={20} className="text-amber-500"/>,badge:"Free!"}]:[]),
        ].map((opt)=>(
          <button key={opt.id} onClick={()=>setPayMethod(opt.id as PayMethod)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${payMethod===opt.id?"border-gold bg-amber-50":"border-gray-100 bg-white hover:border-gray-200"}`}>
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">{opt.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-ink">{opt.label}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{opt.badge}</span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{opt.desc}</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${payMethod===opt.id?"border-gold bg-gold":"border-gray-300"}`}/>
          </button>
        ))}
      </div>
      {coinBal>0&&payMethod!=="coins"&&(
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Coins size={15} className="text-gold"/>
            <span className="font-semibold text-sm text-ink">Use coins for discount</span>
            <span className="ml-auto text-xs text-gray-500">{coinBal} available</span>
          </div>
          <input type="range" min={0} max={maxCoins} step={10} value={coinsToUse}
            onChange={e=>setCoinsToUse(Number(e.target.value))} className="w-full accent-gold" title="Coins to use"/>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-gray-500">{coinsToUse} coins</span>
            <span className="font-bold text-green-600">-₹{coinDiscount.toFixed(0)}</span>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 space-y-2 text-sm">
        <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
        {coinDiscount>0&&<div className="flex justify-between text-green-600"><span>Coin discount</span><span>-₹{coinDiscount.toFixed(0)}</span></div>}
        <div className="flex justify-between text-gray-500"><span>Delivery</span><span className={delivery===0?"text-green-600":""}>{delivery===0?"FREE":`₹${delivery}`}</span></div>
        <div className="border-t pt-2 flex justify-between font-bold text-base text-ink"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
      </div>
      <button onClick={handleCheckout} disabled={busy}
        className="w-full h-12 bg-gold hover:bg-amber-400 rounded-xl font-bold text-sm text-ink transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {busy?<Loader2 size={16} className="animate-spin"/>:<>
          {payMethod==="upi"&&<><QrCode size={16}/>Pay ₹{total.toLocaleString("en-IN")} via UPI</>}
          {payMethod==="razorpay"&&<><CreditCard size={16}/>Pay ₹{total.toLocaleString("en-IN")}</>}
          {payMethod==="coins"&&<><Coins size={16}/>Place Order (Free)</>}
        </>}
      </button>
    </div>
  );

  /* ── ADDRESS ───────────────────────────────────────────────────── */
  if(step==="address") {
    const handleSendPhoneOtp = async () => {
      if (!newAddrForm.phone || newAddrForm.phone.length < 10) {
        toast.error("Please enter a valid 10-digit phone number first");
        return;
      }
      setSendingPhoneOtp(true);
      try {
        const res = await usersApi.sendAddressPhoneOtp(newAddrForm.phone);
        setPhoneOtpSent(true);
        toast.success(res.message || "OTP sent to phone");
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to send phone OTP");
      } finally {
        setSendingPhoneOtp(false);
      }
    };

    const handleVerifyPhoneOtp = async () => {
      if (!newAddrForm.phone_otp || newAddrForm.phone_otp.length < 6) {
        toast.error("Enter 6-digit OTP");
        return;
      }
      setVerifyingPhone(true);
      try {
        const res = await usersApi.verifyAddressPhoneOtp(newAddrForm.phone, newAddrForm.phone_otp);
        setPhoneVerified(true);
        toast.success(res.message || "Phone verified and saved to contacts! ✓");

        // Auto-save to contacts list and select for this address
        setVerifiedPhones(prev => Array.from(new Set([newAddrForm.phone, ...prev])));
        setPhoneMode("select");
        setPhoneOtpSent(false);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Invalid phone OTP");
      } finally {
        setVerifyingPhone(false);
      }
    };

    const handleSendEmailOtp = async () => {
      const targetEmail = newAddrForm.email || user?.email;
      if (!targetEmail || !targetEmail.includes("@")) {
        toast.error("Please enter a valid email address first");
        return;
      }
      setSendingEmailOtp(true);
      try {
        const res = await usersApi.sendAddressEmailOtp(targetEmail);
        setEmailOtpSent(true);
        setEmailVerified(false);
        toast.success(res.message || "Verification code sent to email");
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to send email code");
      } finally {
        setSendingEmailOtp(false);
      }
    };

    const handleVerifyEmailOtp = async () => {
      const targetEmail = newAddrForm.email || user?.email || "";
      if (!newAddrForm.email_otp || newAddrForm.email_otp.length < 6) {
        toast.error("Enter 6-digit code");
        return;
      }
      setVerifyingEmail(true);
      try {
        const res = await usersApi.verifyAddressEmailOtp(targetEmail, newAddrForm.email_otp);
        setEmailVerified(true);
        toast.success(res.message || "Email verified and saved to contacts! ✓");

        // Auto-save to contacts list and select for this address
        setVerifiedEmails(prev => Array.from(new Set([targetEmail, ...prev])));
        setEmailMode("select");
        setEmailOtpSent(false);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Invalid email code");
      } finally {
        setVerifyingEmail(false);
      }
    };

    const handleSaveNewAddress = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newAddrForm.name.trim() || !newAddrForm.phone.trim() || !newAddrForm.house_no.trim() || !newAddrForm.village_town.trim() || !newAddrForm.pincode.trim()){
        toast.error("Please fill in Recipient Name, House No., Village/Town, and a valid 6-digit Pincode");
        return;
      }
      if(postOffices.length > 1 && !newAddrForm.post_office){
        toast.error("Please select a Post Office from the dropdown");
        return;
      }
      if(pincodeResolved && pincodeResolved.postal_delivery_status !== "DELIVERY AVAILABLE"){
        toast.error("Delivery is not available at this pincode. Please change pincode.");
        return;
      }
      if(!/^[6-9]\d{9}$/.test(newAddrForm.phone.replace(/\D/g, ""))){
        toast.error("Enter a valid 10-digit mobile number");
        return;
      }
      setSavingAddr(true);
      try {
        const saved = await usersApi.addAddress({
          name: newAddrForm.name,
          phone: newAddrForm.phone,
          email: newAddrForm.email || undefined,
          house_no: newAddrForm.house_no,
          village_town: newAddrForm.village_town,
          landmark: newAddrForm.landmark || undefined,
          post_office: newAddrForm.post_office || undefined,
          district: newAddrForm.district || undefined,
          division: newAddrForm.division || undefined,
          region: newAddrForm.region || undefined,
          state: newAddrForm.state || "INDIA",
          country: newAddrForm.country || "INDIA",
          postal_delivery_status: newAddrForm.postal_delivery_status || undefined,
          digipin: newAddrForm.digipin || undefined,
          address_line: `${newAddrForm.house_no}, ${newAddrForm.village_town}${newAddrForm.landmark ? ', ' + newAddrForm.landmark : ''}`,
          city: newAddrForm.village_town || newAddrForm.district || "TOWN",
          pincode: newAddrForm.pincode,
          is_default: newAddrForm.is_default,
          phone_otp: newAddrForm.phone_otp || undefined,
          email_otp: newAddrForm.email_otp || undefined,
        });
        toast.success("Address saved and selected!");
        setSavedAddresses(prev => [saved, ...prev]);
        selectAddress(saved);
        setShowNewForm(false);
        setPincodeResolved(null);
        setPostOffices([]);
        setServiceability(null);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to save address");
      } finally {
        setSavingAddr(false);
      }
    };

    const proceedToPayment = () => {
      if (!addr.name || !addr.phone || !addr.address || !addr.city || !addr.state || !addr.pincode) {
        toast.error("Please select or enter a complete delivery address");
        return;
      }
      setStep("payment");
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => setStep("cart")}
          className="text-sm text-gray-500 hover:text-ink mb-4 inline-flex items-center gap-1.5 transition font-medium"
        >
          ← Back to cart
        </button>

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div>
            <h1 className="font-display text-xl font-bold text-ink flex items-center gap-2">
              <MapPin size={22} className="text-amber-600" /> Delivery Address
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {showNewForm ? "Enter your delivery address details below" : "Select a saved delivery address or create a new one"}
            </p>
          </div>

          {savedAddresses.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowNewForm(!showNewForm);
                setPincodeResolved(null);
                setPostOffices([]);
                setServiceability(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1C1C1C] text-[#FFB800] hover:bg-black font-bold text-xs rounded-xl transition shadow-xs"
            >
              <Plus size={14} />
              <span>{showNewForm ? "View Saved Addresses" : "Add New Address"}</span>
            </button>
          )}
        </div>

        {/* ── Saved Address Cards ────────────────────────────────────── */}
        {!showNewForm && savedAddresses.length > 0 && (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedAddresses.map((a) => {
                const isSelected = selectedAddrId === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => selectAddress(a)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-gold bg-amber-50/50 shadow-xs ring-2 ring-gold/40"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{a.name}</span>
                        {a.is_default && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? "border-gold bg-gold text-ink" : "border-gray-300"
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-ink" />}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5 font-medium">{a.address_line}</p>
                    <p className="text-xs text-gray-700 font-bold">{a.city}, {a.state} - {a.pincode}</p>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Phone size={12} /> {a.phone}
                    </p>
                  </div>
                );
              })}

              {/* Explicit Add New Address Card in Grid */}
              <div
                onClick={() => {
                  setShowNewForm(true);
                  setPincodeResolved(null);
                  setPostOffices([]);
                  setServiceability(null);
                }}
                className="p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-gold hover:bg-amber-50/20 cursor-pointer flex flex-col items-center justify-center text-center gap-2 min-h-[110px] transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center text-amber-700">
                  <Plus size={18} />
                </div>
                <span className="text-xs font-bold text-ink group-hover:text-amber-800">+ Add New Address</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Add New Address Form ──────────────────────────────────── */}
        {showNewForm && (
          <form onSubmit={handleSaveNewAddress} className="p-5 border border-amber-200 bg-amber-50/30 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-ink">New Delivery Address</h3>

            <div className="space-y-4">
              {/* Recipient Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">RECIPIENT NAME *</label>
                <input
                  required
                  type="text"
                  placeholder="FULL NAME"
                  value={newAddrForm.name}
                  onChange={e => setNewAddrForm({ ...newAddrForm, name: e.target.value.toUpperCase() })}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white uppercase font-medium"
                />
              </div>

              {/* Mandatory Order: 1. House -> 2. Village/Town -> 3. Landmark -> 4. Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    1. HOUSE NO. / BUILDING *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="E.G. 123, SHIV SHAKTI APARTMENT / FLAT 302"
                    value={newAddrForm.house_no}
                    onChange={e => setNewAddrForm({ ...newAddrForm, house_no: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white uppercase font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    2. VILLAGE / TOWN *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="E.G. DADRI / GREATER NOIDA"
                    value={newAddrForm.village_town}
                    onChange={e => setNewAddrForm({ ...newAddrForm, village_town: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white uppercase font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    3. LANDMARK <span className="font-normal text-gray-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="E.G. NEAR MAIN MARKET / OPP. CITY HOSPITAL"
                    value={newAddrForm.landmark}
                    onChange={e => setNewAddrForm({ ...newAddrForm, landmark: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white uppercase font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    4. PINCODE * <span className="font-normal text-gray-400">(6-digit Indian PIN)</span>
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={6}
                    placeholder="E.G. 203207"
                    value={newAddrForm.pincode}
                    onChange={e => handlePincodeChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white font-mono font-bold tracking-wider"
                  />
                  {pincodeLoading && (
                    <p className="mt-1 text-[11px] font-bold text-amber-700 animate-pulse">
                      Checking pincode geography & serviceability...
                    </p>
                  )}
                  {pincodeError && (
                    <p className="mt-1 text-[11px] font-bold text-red-600">
                      ✕ {pincodeError}
                    </p>
                  )}
                </div>
              </div>

              {/* System Resolved Location Geography */}
              {pincodeResolved && (
                <div className="p-4 bg-white border border-blue-200 rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                      <MapPin size={14} className="text-blue-600" /> SYSTEM RESOLVED LOCATION
                    </span>
                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      Postal Verified ✓
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <span className="block text-[10px] font-bold text-gray-400">COUNTRY</span>
                      <span className="font-bold text-gray-800">{pincodeResolved.country} ✓</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <span className="block text-[10px] font-bold text-gray-400">STATE</span>
                      <span className="font-bold text-gray-800">{pincodeResolved.state} ✓</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <span className="block text-[10px] font-bold text-gray-400">REGION</span>
                      <span className="font-bold text-gray-800">{pincodeResolved.region || pincodeResolved.district} ✓</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <span className="block text-[10px] font-bold text-gray-400">DIVISION</span>
                      <span className="font-bold text-gray-800">{pincodeResolved.division || pincodeResolved.district} ✓</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <span className="block text-[10px] font-bold text-gray-400">DISTRICT</span>
                      <span className="font-bold text-gray-800">{pincodeResolved.district} ✓</span>
                    </div>
                  </div>

                  {/* Post Office Selection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      POST OFFICE *
                    </label>
                    {postOffices.length > 1 ? (
                      <select
                        required
                        value={newAddrForm.post_office}
                        onChange={e => setNewAddrForm({ ...newAddrForm, post_office: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-blue-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white font-bold text-gray-800"
                      >
                        <option value="">[ SELECT POST OFFICE ▼ ]</option>
                        {postOffices.map((po: any) => (
                          <option key={po.name} value={po.name}>
                            {po.name} ({po.delivery_status})
                          </option>
                        ))}
                      </select>
                    ) : postOffices.length === 1 ? (
                      <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 flex items-center justify-between">
                        <span>{postOffices[0].name}</span>
                        <span className="text-green-700 text-[11px]">Auto-Selected ✓</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No post offices found for this pincode</p>
                    )}
                  </div>

                  {/* Status & Accuracy Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      pincodeResolved.postal_delivery_status === "DELIVERY AVAILABLE"
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {pincodeResolved.postal_delivery_status === "DELIVERY AVAILABLE" ? (
                        <><CheckCircle size={14} className="text-green-600" /> ✓ DELIVERY AVAILABLE</>
                      ) : (
                        <>✕ DELIVERY NOT AVAILABLE — PLEASE CHANGE PINCODE</>
                      )}
                    </div>

                    <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-600" /> ✓ DIGIPIN & GOOGLE VERIFIED
                    </div>

                    {serviceability && (
                      <div className="sm:col-span-2 p-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold flex items-center justify-between">
                        <span>✓ COURIER SERVICEABLE ({serviceability.provider})</span>
                        <span className="text-[11px] font-bold text-green-700">COD Available ✓</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Verification: Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200">
                {/* Phone */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">Mobile Phone *</label>
                    {verifiedPhones.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (phoneMode === "select") {
                            setPhoneMode("custom");
                            setNewAddrForm({ ...newAddrForm, phone: "", phone_otp: "" });
                            setPhoneVerified(false);
                          } else {
                            setPhoneMode("select");
                            setNewAddrForm({ ...newAddrForm, phone: verifiedPhones[0] || "", phone_otp: "" });
                            setPhoneVerified(true);
                          }
                          setPhoneOtpSent(false);
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:underline"
                      >
                        {phoneMode === "select" ? "+ New Number" : "← Select Verified"}
                      </button>
                    )}
                  </div>

                  {phoneMode === "select" && verifiedPhones.length > 0 ? (
                    <select
                      value={newAddrForm.phone}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setPhoneMode("custom");
                          setNewAddrForm({ ...newAddrForm, phone: "", phone_otp: "" });
                          setPhoneOtpSent(false);
                          setPhoneVerified(false);
                        } else {
                          setNewAddrForm({ ...newAddrForm, phone: e.target.value, phone_otp: "" });
                          setPhoneVerified(true);
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white font-medium"
                    >
                      {verifiedPhones.map((p) => (
                        <option key={p} value={p}>
                          {p} (Verified ✓)
                        </option>
                      ))}
                      <option value="__new__">+ Enter a new mobile number...</option>
                    </select>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input
                          required
                          type="tel"
                          placeholder="10-digit mobile"
                          value={newAddrForm.phone}
                          onChange={(e) => {
                            setNewAddrForm({ ...newAddrForm, phone: e.target.value, phone_otp: "" });
                            setPhoneVerified(false);
                            setPhoneOtpSent(false);
                          }}
                          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white"
                        />
                        <button
                          type="button"
                          disabled={sendingPhoneOtp}
                          onClick={handleSendPhoneOtp}
                          className="px-2.5 h-10 text-[11px] font-bold bg-[#1C1C1C] text-[#FFB800] rounded-xl whitespace-nowrap hover:bg-black disabled:opacity-50 transition"
                        >
                          {sendingPhoneOtp ? "..." : phoneOtpSent ? "Resend" : "Send OTP"}
                        </button>
                      </div>
                      {phoneOtpSent && !phoneVerified && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit Phone OTP"
                            value={newAddrForm.phone_otp}
                            onChange={e => setNewAddrForm({ ...newAddrForm, phone_otp: e.target.value })}
                            className="w-full h-8 px-2.5 rounded-lg border border-blue-300 text-xs bg-blue-50/30 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            disabled={verifyingPhone || newAddrForm.phone_otp.length < 6}
                            onClick={handleVerifyPhoneOtp}
                            className="px-3.5 h-8 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg whitespace-nowrap disabled:opacity-50 transition shadow-sm"
                          >
                            {verifyingPhone ? "..." : "Verify"}
                          </button>
                        </div>
                      )}
                      {phoneVerified && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
                          <CheckCircle size={14} className="text-green-600" /> Phone number verified
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">
                      Contact Email <span className="font-normal text-gray-400">(Optional)</span>
                    </label>
                    {verifiedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (emailMode === "select") {
                            setEmailMode("custom");
                            setNewAddrForm({ ...newAddrForm, email: "", email_otp: "" });
                            setEmailVerified(false);
                            setEmailOtpSent(false);
                          } else {
                            setEmailMode("select");
                            setNewAddrForm({ ...newAddrForm, email: verifiedEmails[0] || "", email_otp: "" });
                            setEmailVerified(true);
                          }
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:underline"
                      >
                        {emailMode === "select" ? "+ New Email" : "← Select Verified"}
                      </button>
                    )}
                  </div>

                  {emailMode === "select" && verifiedEmails.length > 0 ? (
                    <select
                      value={newAddrForm.email}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setEmailMode("custom");
                          setNewAddrForm({ ...newAddrForm, email: "", email_otp: "" });
                          setEmailOtpSent(false);
                          setEmailVerified(false);
                        } else {
                          setNewAddrForm({ ...newAddrForm, email: e.target.value, email_otp: "" });
                          setEmailVerified(true);
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white font-medium"
                    >
                      {verifiedEmails.map((em) => (
                        <option key={em} value={em}>
                          {em} (Verified ✓)
                        </option>
                      ))}
                      <option value="__new__">+ Enter a new email address...</option>
                    </select>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder={user?.email || "you@email.com"}
                          value={newAddrForm.email}
                          onChange={(e) => {
                            setNewAddrForm({ ...newAddrForm, email: e.target.value, email_otp: "" });
                            setEmailVerified(false);
                            setEmailOtpSent(false);
                          }}
                          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold bg-white"
                        />
                        <button
                          type="button"
                          disabled={sendingEmailOtp}
                          onClick={handleSendEmailOtp}
                          className="px-2.5 h-10 text-[11px] font-bold bg-[#1C1C1C] text-[#FFB800] rounded-xl whitespace-nowrap hover:bg-black disabled:opacity-50 transition"
                        >
                          {sendingEmailOtp ? "..." : emailOtpSent ? "Resend" : "Send Code"}
                        </button>
                      </div>
                      {emailOtpSent && !emailVerified && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit Email Code"
                            value={newAddrForm.email_otp}
                            onChange={e => setNewAddrForm({ ...newAddrForm, email_otp: e.target.value })}
                            className="w-full h-8 px-2.5 rounded-lg border border-blue-300 text-xs bg-blue-50/30 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            disabled={verifyingEmail || newAddrForm.email_otp.length < 6}
                            onClick={handleVerifyEmailOtp}
                            className="px-3.5 h-8 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg whitespace-nowrap disabled:opacity-50 transition shadow-sm"
                          >
                            {verifyingEmail ? "..." : "Verify"}
                          </button>
                        </div>
                      )}
                      {emailVerified && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
                          <CheckCircle size={14} className="text-green-600" /> Email address verified
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center pt-2">
                <label className="flex items-center space-x-2 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAddrForm.is_default}
                    onChange={e => setNewAddrForm({ ...newAddrForm, is_default: e.target.checked })}
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span>Save as Default Address</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              {savedAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={
                  savingAddr ||
                  (pincodeResolved && pincodeResolved.postal_delivery_status !== "DELIVERY AVAILABLE") ||
                  (postOffices.length > 1 && !newAddrForm.post_office)
                }
                className="px-5 py-2 text-xs font-bold bg-[#1C1C1C] text-[#FFB800] rounded-xl hover:bg-black transition disabled:opacity-50 shadow-sm"
              >
                {savingAddr ? "Saving..." : "SAVE & USE THIS ADDRESS"}
              </button>
            </div>
          </form>
        )}

        {/* ── Proceed to Payment Button ─────────────────────────────── */}
        {!showNewForm && (
          <button
            onClick={proceedToPayment}
            className="w-full h-12 bg-gold hover:bg-amber-400 rounded-xl font-bold text-sm text-ink transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            Deliver to this Address → Continue to Payment <ArrowRight size={16} />
          </button>
        )}
      </div>
    );
  }

  /* ── CART ──────────────────────────────────────────────────────── */
  return(
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-6">Your Cart</h1>
      {loading?(
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 shimmer rounded-2xl"/>)}</div>
      ):items.length===0?(
        <div className="flex flex-col items-center py-24 text-center">
          <ShoppingBag size={48} className="text-gray-200 mb-4"/>
          <h2 className="font-semibold text-lg text-gray-500">Your cart is empty</h2>
          <p className="text-sm text-gray-400 mt-1 mb-6">Find something you love</p>
          <Link href="/store" className="h-11 px-6 bg-gold rounded-xl flex items-center gap-2 font-semibold text-sm text-ink">
            Start Shopping <ArrowRight size={15}/>
          </Link>
        </div>
      ):(
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-3">
            <AnimatePresence>
              {items.map(item=>(
                <motion.div key={item.id} layout exit={{opacity:0,height:0}}
                  className="bg-white rounded-2xl p-4 flex gap-4 items-center border border-gray-50">
                  <Link href={`/product/${item.product_id}`} className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50 relative">
                    {item.product?.images?.[0]
                      ?<Image src={item.product.images[0]} alt="" fill sizes="80px" className="object-cover"/>
                      :<div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ink line-clamp-2">{item.product?.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.product?.category}</p>
                    <p className="font-bold text-sm text-ink mt-1">₹{(item.product.price.amount_minor / 100).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <button onClick={()=>removeItem(item.product_id)} title="Remove" className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={15}/></button>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button onClick={()=>updateQty(item.product_id,item.quantity-1)} title="Decrease" className="w-7 h-7 flex items-center justify-center hover:bg-cream transition-colors"><Minus size={12}/></button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={()=>updateQty(item.product_id,item.quantity+1)} title="Increase" className="w-7 h-7 flex items-center justify-center hover:bg-cream transition-colors"><Plus size={12}/></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="font-bold text-base text-ink mb-4">Order Summary</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-gray-600"><span>Delivery</span><span className={delivery===0?"text-green-600":""}>{delivery===0?"FREE":`₹${delivery}`}</span></div>
                <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-base text-ink"><span>Total</span><span>₹{(subtotal+delivery).toLocaleString("en-IN")}</span></div>
              </div>
              <button onClick={()=>setStep("address")}
                className="w-full mt-5 h-12 bg-gold hover:bg-amber-400 rounded-xl flex items-center justify-center gap-2 font-bold text-sm text-ink transition-all">
                Proceed to Checkout <ArrowRight size={16}/>
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-3">Secure · Buyer protection included</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">We accept</p>
              <div className="flex flex-wrap gap-2">
                {["💳 Cards","🏦 Net Banking","📱 UPI / QR","🟡 Coins"].map(m=>(
                  <span key={m} className="text-[11px] bg-white px-2.5 py-1 rounded-lg border border-gray-100 font-medium text-gray-600">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
