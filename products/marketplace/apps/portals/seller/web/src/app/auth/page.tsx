"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store";
import { authApi } from "@/lib/api";
import { signInWithEmailViaFirebase, createEmailAccountViaFirebase, signInWithGoogleViaFirebase, linkGoogleToCurrentFirebaseUser, getFirebaseAuth, createPhoneConfirmation } from "@/lib/firebase";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

type Step = "select" | "login" | "register" | "otp" | "forgot" | "phone" | "not_registered" | "email_otp" | "phone_register";

export default function SellerAuth() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [step, setStep]     = useState<Step>("select");
  const [busy, setBusy]     = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pending, setPending] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneConfirmation, setPhoneConfirmation] = useState<any>(null);
  const [entryMethod, setEntryMethod] = useState<"email" | "mobile" | "google">("email");
  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpResendIn, setOtpResendIn] = useState(0);
  const [otp, setOtp]       = useState(["","","","","",""]);
  const [fEmail, setFEmail] = useState("");
  const [fSent, setFSent]   = useState(false);
  const [form, setForm]     = useState({ name:"", email:"", password:"" });
  const f = (k:string) => (e:any) => setForm(p=>({...p,[k]:e.target.value}));
  const ic = "w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white transition-all";

  const formatCountdown = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!otpExpiresIn && !otpResendIn) return;
    const timer = window.setInterval(() => {
      setOtpExpiresIn((value) => Math.max(0, value - 1));
      setOtpResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpExpiresIn, otpResendIn]);

  const go = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const Tab = () => (
    <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
      {(["login","register"] as const).map(t=>(
        <button key={t} onClick={()=>setStep(t)}
          className={"flex-1 py-2 rounded-lg text-sm font-semibold transition-all "+(step===t?"bg-white text-ink shadow-sm":"text-ink/50")}>
          {t==="login"?"Sign In":"Create Account"}
        </button>
      ))}
    </div>
  );

  const Btn = ({label}:{label:string}) => (
    <button type="button" disabled={busy}
      className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-60">
      {busy?<Loader2 size={16} className="animate-spin"/>:<>{label}<ArrowRight size={15}/></>}
    </button>
  );

  const otpInput = (val:string, i:number) => {
    if(!/^\d*$/.test(val)) return;
    const n=[...otp]; n[i]=val.slice(-1); setOtp(n);
    if(val&&i<5)(document.getElementById("so"+(i+1)) as HTMLInputElement)?.focus();
  };

  const emailOtpInput = (val: string, i: number) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...emailOtp]; next[i] = val.slice(-1); setEmailOtp(next);
    if (val && i < 5) (document.getElementById(`seo${i + 1}`) as HTMLInputElement)?.focus();
  };

  const beginEmailOtp = async () => {
    const email = form.email.trim().toLowerCase();
    const account = await authApi.checkEmail(email);
    if (!account.exists) {
      setEntryMethod("email"); setStep("not_registered"); return;
    }
    await authApi.sendLoginOtp({ email, channel: "email" });
    setPending(email); setEmailOtpSent(true); setEmailOtp(["", "", "", "", "", ""]);
    setOtpExpiresIn(300); setOtpResendIn(60); setStep("email_otp");
  };

  const verifySellerRole = (user: any) => {
    login(user); router.push("/dashboard");
  };

  const handleGoogle = () => go(async () => {
    const firebaseAuth = getFirebaseAuth();
    await firebaseAuth.authStateReady();
    const currentUser = firebaseAuth.currentUser;
    const firebase = currentUser
      ? (currentUser.providerData.some((provider) => provider.providerId === "google.com")
        ? await signInWithGoogleViaFirebase()
        : await linkGoogleToCurrentFirebaseUser())
      : await signInWithGoogleViaFirebase();
    let result;
    try { result = await authApi.firebase(firebase.idToken); }
    catch (err: any) {
      if (err.response?.status !== 409) throw err;
      const name = window.prompt("Enter your full name to create your Zolexora account")?.trim();
      if (!name) return;
      result = await authApi.firebase(firebase.idToken, name);
    }
    verifySellerRole(result.user);
  });

  const content = (
      <div className="min-h-screen bg-ink flex items-center justify-center px-4">
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
          className="w-full max-w-md bg-white rounded-3xl p-8">
          <div className="text-center mb-8">
            <img src="/Zolexora_logo.png" alt="" className="mx-auto mb-2 h-14 w-16 rounded-lg object-contain" />
            <span className="font-display text-2xl font-bold text-ink">Zolexora</span>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">Seller Portal</p>
          </div>
          <AnimatePresence mode="wait">

            {step === "select" && (
              <motion.div key="select" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                <div className="space-y-3">
                  <button type="button" disabled={busy} onClick={handleGoogle} className="w-full h-12 bg-white hover:bg-gray-50 border-2 border-gray-200 text-ink font-bold rounded-2xl flex items-center justify-center gap-3 text-sm transition">
                    <span className="text-lg font-bold">G</span><span>Continue with Google</span>
                  </button>
                  <button type="button" disabled={busy} onClick={()=>setStep("login")} className="w-full h-12 bg-white hover:bg-gray-50 border-2 border-gray-200 text-ink font-bold rounded-2xl flex items-center justify-center gap-3 text-sm transition">
                    <Mail size={18} className="text-gray-600"/><span>Continue with Email</span>
                  </button>
                  <button type="button" disabled={busy} onClick={()=>setStep("phone")} className="w-full h-12 bg-gold hover:bg-amber-400 text-ink font-bold rounded-2xl flex items-center justify-center gap-3 text-sm transition">
                    <span className="text-lg">⌕</span><span>Continue with Phone</span>
                  </button>
                </div>
              </motion.div>
            )}

            {step==="login" && (
              <motion.div key="login" initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:16}}>
                <Tab/>
                <div className="space-y-4">
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input suppressHydrationWarning type="email" placeholder="Email" value={form.email} onChange={f("email")} className={ic}/>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input suppressHydrationWarning type={showPw?"text":"password"} placeholder="Password" value={form.password} onChange={f("password")} className={ic+" pr-10"}/>
                    <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                      {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={()=>{setFEmail(form.email);setStep("forgot")}}
                      className="text-xs text-gold hover:underline font-medium">Forgot password?</button>
                  </div>
                  <div onClick={()=>go(async()=>{
                    const firebase=await signInWithEmailViaFirebase(form.email, form.password);
                    const r=await authApi.firebase(firebase.idToken);
                    verifySellerRole(r.user);
                  })}><Btn label="Sign In"/></div>
                  <button type="button" disabled={busy || !form.email} onClick={()=>go(beginEmailOtp)} className="w-full h-10 border border-gray-200 rounded-xl text-xs font-semibold text-ink hover:bg-gray-50 disabled:opacity-60">
                    Sign In with Email OTP
                  </button>
                  <button type="button" disabled={busy} onClick={()=>go(async()=>{
                    const firebaseAuth = getFirebaseAuth();
                    await firebaseAuth.authStateReady();
                    const currentUser = firebaseAuth.currentUser;
                    const firebase = currentUser
                      ? (currentUser.providerData.some((provider) => provider.providerId === "google.com")
                        ? await signInWithGoogleViaFirebase()
                        : await linkGoogleToCurrentFirebaseUser())
                      : await signInWithGoogleViaFirebase();
                    let r;
                    try { r=await authApi.firebase(firebase.idToken); }
                    catch (err: any) {
                      if (err.response?.status !== 409) throw err;
                      const name=window.prompt("Enter your full name to create your Zolexora account")?.trim();
                      if (!name) return;
                      r=await authApi.firebase(firebase.idToken, name);
                    }
                    verifySellerRole(r.user);
                  })} className="w-full h-11 border border-gray-200 rounded-xl text-sm font-semibold text-ink hover:bg-gray-50 disabled:opacity-60">
                    Continue with Google
                  </button>
                  <button type="button" disabled={busy} onClick={()=>setStep("phone")} className="w-full h-11 border border-gray-200 rounded-xl text-sm font-semibold text-ink hover:bg-gray-50 disabled:opacity-60">
                    Continue with Phone
                  </button>
                </div>
              </motion.div>
            )}

            {step==="register" && (
              <motion.div key="reg" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}}>
                <Tab/>
                <div className="space-y-4">
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input suppressHydrationWarning type="text" placeholder="Your name" value={form.name} onChange={f("name")} className={ic}/>
                  </div>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input suppressHydrationWarning type="email" placeholder="Email" value={form.email} onChange={f("email")} className={ic}/>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input suppressHydrationWarning type={showPw?"text":"password"} placeholder="Password (min 8 chars + digit)" value={form.password} onChange={f("password")} className={ic+" pr-10"}/>
                    <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                      {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                    </button>
                  </div>
                  <div onClick={()=>go(async()=>{
                    if (!form.name.trim()) { toast.error("Enter your full name"); return; }
                    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
                    const firebase = await createEmailAccountViaFirebase(form.email, form.password);
                    const result = await authApi.firebase(firebase.idToken, form.name.trim());
                    login(result.user);
                    if (result.user.role === "seller" || result.user.role === "admin") router.push("/dashboard");
                    else toast.success("Account created. Seller access requires Marketplace approval.");
                  })}><Btn label="Create Seller Account"/></div>
                </div>
              </motion.div>
            )}

            {step==="not_registered" && (
              <motion.div key="not_registered" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}}>
                <div className="space-y-4 text-center">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-bold text-ink">You’re not registered with us</p>
                    <p className="mt-1 text-xs text-gray-600 break-all">{entryMethod === "mobile" ? `+91 ${phone}` : form.email}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={()=>go(async()=>{
                    if (entryMethod === "mobile") { setStep("phone_register"); return; }
                    setStep("register");
                  })} className="w-full h-11 bg-gold text-ink font-bold rounded-xl disabled:opacity-60">Register</button>
                  <button type="button" disabled={busy} onClick={()=>setStep(entryMethod === "mobile" ? "phone" : "login")} className="w-full h-10 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600">{entryMethod === "mobile" ? "Change mobile number" : "Change email"}</button>
                </div>
              </motion.div>
            )}

            {step==="email_otp" && (
              <motion.div key="email_otp" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}}>
                <div className="space-y-4">
                  <p className="text-center text-sm text-gray-600">Code sent to <strong className="text-ink">{pending}</strong></p>
                  <div className="flex justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600"><span>Expires in {formatCountdown(otpExpiresIn)}</span><span>{otpResendIn ? `Resend in ${formatCountdown(otpResendIn)}` : "Ready to resend"}</span></div>
                  <div className="flex justify-center gap-2">{emailOtp.map((digit, i)=><input key={i} id={`seo${i}`} inputMode="numeric" maxLength={1} value={digit} onChange={e=>emailOtpInput(e.target.value,i)} className="w-11 h-12 text-center text-xl font-bold border-2 rounded-xl bg-gray-50 focus:outline-none focus:border-gold" />)}</div>
                  <div onClick={()=>go(async()=>{ const result=await authApi.verifyLoginOtp({email:pending,otp:emailOtp.join("")}); verifySellerRole(result.user); })}><Btn label="Verify & Sign In"/></div>
                  <button type="button" disabled={busy || otpResendIn > 0} onClick={()=>go(async()=>{await authApi.sendLoginOtp({email:pending,channel:"email"});setOtpExpiresIn(300);setOtpResendIn(60);setEmailOtp(["","","","","",""]);})} className="w-full text-xs text-gray-500 py-2 disabled:opacity-50">{otpResendIn ? `Resend OTP in ${formatCountdown(otpResendIn)}` : "Resend OTP"}</button>
                </div>
              </motion.div>
            )}

            {step==="phone" && (
              <motion.div key="phone" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}}>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Phone sign-in is available only for an existing Firebase account with a linked email.</p>
                  <input type="tel" placeholder="+919876543210" value={phone} onChange={e=>setPhone(e.target.value)} className={ic}/>
                  <div id="seller-firebase-phone-recaptcha" />
                  {!phoneConfirmation ? (
                    <div onClick={()=>go(async()=>{
                      const clean = phone.replace(/\D/g, '').slice(-10);
                      if (clean.length !== 10) throw new Error("Enter a valid 10-digit phone number");
                      const account = await authApi.checkPhone(clean);
                      if (!account.exists) { setEntryMethod("mobile"); setStep("not_registered"); return; }
                      setPhoneConfirmation(await createPhoneConfirmation("seller-firebase-phone-recaptcha", `+91${clean}`));
                      setOtpExpiresIn(300); setOtpResendIn(60); toast.success("Verification code sent");
                    })}><Btn label="Send Code"/></div>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs text-gray-500"><span>Expires in {formatCountdown(otpExpiresIn)}</span><span>{otpResendIn ? `Resend in ${formatCountdown(otpResendIn)}` : "Ready to resend"}</span></div>
                      <input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={phoneCode} onChange={e=>setPhoneCode(e.target.value)} className={ic}/>
                      <div onClick={()=>go(async()=>{ const verified=await phoneConfirmation.confirm(phoneCode); const r=await authApi.firebase(await verified.user.getIdToken()); verifySellerRole(r.user); })}><Btn label="Sign In with Phone"/></div>
                    </>
                  )}
                  <button type="button" onClick={()=>setStep("login")} className="w-full text-center text-gold text-sm font-semibold hover:underline py-2">Back to login</button>
                </div>
              </motion.div>
            )}

            {step==="phone_register" && (
              <motion.div key="phone_register" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}}>
                <div className="space-y-4">
                  <p className="text-center text-sm text-gray-600">Verify the phone number <strong className="text-ink">+91 {phone}</strong></p>
                  <div className="flex justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600"><span>Expires in {formatCountdown(otpExpiresIn)}</span><span>{otpResendIn ? `Resend in ${formatCountdown(otpResendIn)}` : "Ready to resend"}</span></div>
                  <input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={phoneCode} onChange={e=>setPhoneCode(e.target.value)} className={ic}/>
                  <div onClick={()=>go(async()=>{if(phoneCode.length!==6) throw new Error("Enter the 6-digit code"); await authApi.verifyPhoneOtp(phone.replace(/\D/g,'').slice(-10),phoneCode,"registration"); toast.success("Phone verified. Continue with email registration."); setStep("register");})}><Btn label="Verify Phone"/></div>
                  <button type="button" disabled={busy || otpResendIn > 0} onClick={()=>go(async()=>{const clean=phone.replace(/\D/g,'').slice(-10);await authApi.sendPhoneOtp(clean,"registration");setOtpExpiresIn(300);setOtpResendIn(60);setPhoneCode("");})} className="w-full text-xs text-gray-500 py-2 disabled:opacity-50">{otpResendIn ? `Resend OTP in ${formatCountdown(otpResendIn)}` : "Resend OTP"}</button>
                </div>
              </motion.div>
            )}

            {step==="otp" && (
              <motion.div key="otp" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}>
                <p className="text-center text-sm text-gray-600 mb-5">
                  Code sent to <strong className="text-ink">{pending}</strong>
                </p>
                <div className="flex justify-center gap-2 mb-5">
                  {otp.map((d,i)=>(
                    <input key={i} id={"so"+i} type="text" inputMode="numeric" maxLength={1} value={d}
                      onChange={e=>otpInput(e.target.value,i)}
                      onKeyDown={e=>{if(e.key==="Backspace"&&!d&&i>0)(document.getElementById("so"+(i-1)) as HTMLInputElement)?.focus()}}
                      title={"digit "+(i+1)}
                      className="w-11 h-12 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-gold bg-gray-50"/>
                  ))}
                </div>
                <div onClick={()=>go(async()=>{
                  const r=await authApi.verifyOtp(pending,otp.join(""));
                  login(r.user); router.push("/dashboard");
                })}><Btn label="Verify"/></div>
                <button type="button" onClick={async()=>{await authApi.resendOtp(pending);toast.success("New code sent");}}
                  className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 py-2">Resend code</button>
              </motion.div>
            )}

            {step==="forgot" && (
              <motion.div key="forgot" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}>
                {fSent?(
                  <div className="text-center space-y-4 py-4">
                    <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                      <Mail size={24} className="text-green-500"/>
                    </div>
                    <p className="font-bold text-ink">Reset link sent!</p>
                    <p className="text-sm text-gray-500">Check <strong>{fEmail}</strong> — also check spam.</p>
                    <button onClick={()=>{setStep("login");setFSent(false)}} className="text-gold text-sm font-semibold hover:underline">Back to login</button>
                  </div>
                ):(
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Enter your seller email to receive a reset link.</p>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
                      <input suppressHydrationWarning type="email" placeholder="Seller email" value={fEmail} onChange={e=>setFEmail(e.target.value)} className={ic}/>
                    </div>
                    <div onClick={()=>go(async()=>{await authApi.forgotPassword(fEmail);setFSent(true);})}><Btn label="Send Reset Link"/></div>
                    <button type="button" onClick={()=>setStep("login")} className="w-full text-center text-gold text-sm font-semibold hover:underline py-2">Back to login</button>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
  );

  return content;
}
