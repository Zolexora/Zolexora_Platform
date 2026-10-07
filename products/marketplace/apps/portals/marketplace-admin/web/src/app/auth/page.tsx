"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { authApi } from "@/lib/api";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

export default function AdminAuthPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (res.user.role !== "admin") { toast.error("Admin access required"); return; }
      login(res.user);
      router.push("/dashboard");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
        className="w-full max-w-sm bg-white rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <img src="/Zolexora_logo.png" alt="" className="mb-4 h-16 w-20 rounded-xl object-contain" />
          <h1 className="font-display text-xl font-bold text-ink">Admin Access</h1>
          <p className="text-ink-muted text-sm mt-1 text-center">Zolexora control centre</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email"
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white transition-all" />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white transition-all" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400 hover:text-ink">
              {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-11 bg-gold hover:bg-gold-dark text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Sign In to Admin"}
          </button>
        </form>
        <p className="text-center text-xs text-ink-muted mt-6">Use your authorized administrator credentials.</p>
      </motion.div>
    </div>
  );
}
