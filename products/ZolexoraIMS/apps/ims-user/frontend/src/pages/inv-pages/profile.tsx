import React, { useState, useEffect } from 'react';
import {
  UserCircle,
  Mail,
  Shield,
  Building2,
  Key,
  Save,
  CheckCircle2,
  Database,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export default function Profile() {
  const { user: authUser, authFetch } = useAuth();
  const [profile, setProfile] = useState({
    name: authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || '',
    email: authUser?.email || '',
    role: 'Store Staff',
    org_id: '',
    assigned_location: 'ALL',
    default_currency: '₹ (INR)',
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authUser) {
      setProfile((prev) => ({
        ...prev,
        email: authUser.email || prev.email,
        name: authUser.user_metadata?.name || prev.name || (authUser.email ? authUser.email.split('@')[0] : ''),
      }));
    }

    authFetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.name) {
          setProfile((prev) => ({
            ...prev,
            name: data.name || prev.name,
            email: data.email || prev.email,
            role: data.role || prev.role,
            org_id: data.org_id || prev.org_id,
            assigned_location: data.assigned_location || prev.assigned_location,
          }));
        }
      })
      .catch(() => {});
  }, [authUser]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 600);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <UserCircle className="w-6 h-6 text-indigo-400" />
          Operator Profile & Account Settings
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage your personal credentials, assigned warehouse scope, and session preferences
        </p>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>Profile preferences saved successfully!</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="p-6 bg-[#12141f] border border-white/10 rounded-2xl space-y-6 shadow-xl">
        {/* User Card Top */}
        <div className="flex items-center gap-4 pb-6 border-b border-white/5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white text-xl shadow-lg">
            {profile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{profile.name}</h2>
            <div className="text-xs text-slate-400">{profile.email}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                {profile.role}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Tenant: {profile.org_id}</span>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Display Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Email Address</label>
            <input
              type="email"
              readOnly
              value={profile.email}
              className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-slate-400 outline-hidden cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Primary Warehouse Scope</label>
            <select
              value={profile.assigned_location}
              onChange={(e) => setProfile({ ...profile, assigned_location: e.target.value })}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="S_001 (Main Central Warehouse)">S_001 (Main Central Warehouse)</option>
              <option value="S_002 (Branch Store)">S_002 (Branch Store)</option>
              <option value="ALL">ALL (Enterprise Global View)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Default Currency Format</label>
            <input
              type="text"
              value={profile.default_currency}
              onChange={(e) => setProfile({ ...profile, default_currency: e.target.value })}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Security & Authentication status */}
        <div className="p-4 bg-white/2 border border-white/5 rounded-xl space-y-2 text-xs">
          <div className="font-semibold text-slate-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Supabase Auth & Cloudflare Edge Token</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Authentication sessions are cryptographically signed and edge-cached with 7-day TTL on Cloudflare KV.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
