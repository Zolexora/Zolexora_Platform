"use client";
import { useState } from "react";
import { useAuthStore } from "@/store";
import { api } from "@/lib/api";
import { User, Mail, Coins, Shield, Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", { name });
      toast.success("Profile updated");
    } catch { toast.error("Update failed"); }
    finally { setSaving(false); }
  };

  const handleLogout = () => {
    logout();
    router.push("/auth");
    toast.success("Signed out");
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
        <p className="text-ink-muted text-sm mt-0.5">Manage your seller account</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gold flex items-center justify-center text-2xl font-black text-ink">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-ink">{user.name}</p>
            <p className="text-sm text-ink-muted">{user.email}</p>
            <span className="inline-block mt-1 text-[11px] font-bold uppercase tracking-wide bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
              {user.role}
            </span>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-gray-50">
          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">Display Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-3 text-gray-400" />
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your display name"
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-white" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-3 text-gray-400" />
              <input value={user.email} disabled placeholder="Your email address"
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-100 text-sm bg-gray-50 text-ink-muted cursor-not-allowed" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Email cannot be changed</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="h-10 px-5 bg-gold hover:bg-gold-dark rounded-xl flex items-center gap-2 font-bold text-sm text-ink transition-all disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Coins, label: "Coin Balance", value: user.coin_balance?.toLocaleString(), color: "text-amber-700 bg-amber-50" },
          { icon: Shield, label: "Account Status", value: user.is_active ? "Active" : "Suspended", color: user.is_active ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50" },
          { icon: User, label: "Email Verified", value: user.is_email_verified ? "Yes" : "No", color: user.is_email_verified ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${color.split(" ")[1]}`}>
              <Icon size={15} className={color.split(" ")[0]} />
            </div>
            <p className="text-sm font-bold text-ink">{value}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-sm text-ink mb-4">Account</h3>
        <button onClick={handleLogout}
          className="h-10 px-5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
          Sign Out
        </button>
      </div>
    </div>
  );
}
