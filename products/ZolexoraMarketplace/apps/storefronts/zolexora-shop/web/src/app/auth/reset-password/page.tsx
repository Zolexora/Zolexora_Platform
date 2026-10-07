"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import { Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

function ResetForm() {
  const queryToken = useSearchParams().get("token") || "";
  const [token, setToken] = useState(queryToken);
  const [pw, setPw]   = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);

  useEffect(() => {
    if (queryToken) {
      setToken(queryToken);
      return;
    }
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setToken(hash.get("access_token") || "");
  }, [queryToken]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2)           { toast.error("Passwords don't match"); return; }
    if (pw.length < 8 || !/\d/.test(pw)) { toast.error("Min 8 chars + 1 digit"); return; }
    setBusy(true);
    try { await authApi.resetPassword(token, pw); setDone(true); }
    catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Link expired. Request a new one.");
    }
    finally { setBusy(false); }
  };

  const ic = "w-full h-11 pl-10 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white transition-all";

  if (!token) return <div className="text-center py-8"><p className="text-red-500 font-semibold mb-3">Invalid reset link</p><Link href="/auth" className="text-gold hover:underline text-sm">Back to login</Link></div>;

  if (done) return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto"><CheckCircle size={30} className="text-green-500"/></div>
      <p className="font-bold text-ink text-lg">Password updated!</p>
      <p className="text-sm text-gray-500">You can now log in with your new password.</p>
      <Link href="/auth" className="inline-block h-11 px-8 bg-gold rounded-xl font-bold text-sm text-ink">Go to Login</Link>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="relative"><Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
        <input type={show?"text":"password"} placeholder="New password" required value={pw} onChange={e=>setPw(e.target.value)} className={ic}/>
        <button type="button" onClick={()=>setShow(!show)} className="absolute right-3.5 top-3.5 text-gray-400">{show?<EyeOff size={15}/>:<Eye size={15}/>}</button></div>
      <div className="relative"><Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400"/>
        <input type={show?"text":"password"} placeholder="Confirm password" required value={pw2} onChange={e=>setPw2(e.target.value)} className={ic}/></div>
      <p className="text-[11px] text-gray-400">Min 8 characters, at least one digit</p>
      <button type="submit" disabled={busy} className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-60">
        {busy?<Loader2 size={16} className="animate-spin"/>:"Update Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 bg-cream">
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
        className="w-full max-w-md bg-white rounded-3xl shadow-modal p-8 border border-gray-100">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-2" aria-label="Zolexora home">
            <img src="/Zolexora_logo.png" alt="" className="h-14 w-16 rounded-lg object-contain" />
            <span className="font-display text-2xl font-bold text-ink">Zolexora</span>
          </Link>
          <p className="text-gray-500 text-sm mt-1">Set your new password</p>
        </div>
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin text-gold"/></div>}>
          <ResetForm/>
        </Suspense>
      </motion.div>
    </div>
  );
}
