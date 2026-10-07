import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CreditCard,
  Users,
  Building2,
  Briefcase,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  DollarSign,
  Activity,
  Layers,
  KeyRound,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export default function CmdDashboard() {
  const { authFetch } = useAuth();
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [terminalConfig, setTerminalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch('/api/v1/payment/handle').then((r) => (r.ok ? r.json() : null)),
      authFetch('/api/v1/settings/terminal').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([payData, termData]) => {
        if (payData && payData.config) setPaymentConfig(payData.config);
        if (termData && termData.settings) setTerminalConfig(termData.settings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-[#0c0d18] border border-purple-500/30 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-200 border border-purple-500/30 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono font-bold tracking-wider">COMMANDER</span>
              <span className="text-slate-400">•</span>
              <span>Command Panel</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Command Panel & Corporate Governance
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Executive command center for sensitive financial rails, bank merchant handles, API secrets, multi-site infrastructure, staff RBAC permissions, and legal tax compliance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Settlement Architecture</div>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                <Zap className="w-3.5 h-3.5" />
                <span>Instant 0-Sec IMPS Rail</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Sensitive Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Payment Rails */}
        <Link
          to="/cmd-panal/payments"
          className="group p-5 bg-slate-900/50 hover:bg-slate-900 border border-purple-500/20 hover:border-purple-500/50 rounded-2xl transition duration-200 shadow-md relative overflow-hidden flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-105 transition">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white group-hover:text-purple-300 transition">
                  Payment Rails & Gateways
                </h3>
                <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded font-mono font-bold">
                  SENSITIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Bank Merchant VPAs, Razorpay/Cashfree API Secrets, RuPay CC & Instant Settle.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-purple-400 font-semibold">
            <span>Configure Rails</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* Card 2: Staff & Roles */}
        <Link
          to="/cmd-panal/users"
          className="group p-5 bg-slate-900/50 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/40 rounded-2xl transition duration-200 shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition">
                Staff & Role Permissions
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Role-based access control (RBAC), cashier credentials, managers, and auditors.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-indigo-400 font-semibold">
            <span>Manage Access</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* Card 3: Sites & Terminals */}
        <Link
          to="/cmd-panal/sites"
          className="group p-5 bg-slate-900/50 hover:bg-slate-900 border border-white/10 hover:border-teal-500/40 rounded-2xl transition duration-200 shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 group-hover:scale-105 transition">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white group-hover:text-teal-300 transition">
                Sites, Stores & Terminals
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Central warehouses, distribution hubs, branch stores, and POS desk assignments.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-teal-400 font-semibold">
            <span>Manage Hierarchy</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* Card 4: Company Legal Profile */}
        <Link
          to="/cmd-panal/company"
          className="group p-5 bg-slate-900/50 hover:bg-slate-900 border border-white/10 hover:border-amber-500/40 rounded-2xl transition duration-200 shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-105 transition">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white group-hover:text-amber-300 transition">
                Company Legal Profile
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                15-digit GSTIN, PAN number, registered corporate address, invoice headers & tax rules.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-amber-400 font-semibold">
            <span>Legal Compliance</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>
      </div>

      {/* Status Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Financial Rails Active Status */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Live Financial Rail Configuration</h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold font-mono">
              ACTIVE IN PRODUCTION
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Merchant VPA (UPI ID)</span>
              <div className="font-mono text-white text-sm font-semibold truncate">
                {paymentConfig?.upi_handle || 'zolexora@icici'}
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>NPCI Direct-to-Bank Routing</span>
              </div>
            </div>

            <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Legal Payee Name</span>
              <div className="text-white text-sm font-semibold truncate">
                {paymentConfig?.merchant_name || 'Zolexora Retail Operations'}
              </div>
              <div className="text-[10px] text-slate-400">
                Category: MCC {paymentConfig?.merchant_category_code || '5812'}
              </div>
            </div>

            <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Payment Gateway</span>
              <div className="text-white text-sm font-semibold uppercase">
                {paymentConfig?.payment_gateway === 'razorpay'
                  ? 'Razorpay PG'
                  : paymentConfig?.payment_gateway === 'cashfree'
                  ? 'Cashfree Payments'
                  : 'Direct Dynamic UPI QR (0% MDR)'}
              </div>
              <div className="text-[10px] text-emerald-400">
                Auto Settle: Enabled (IMPS 24x7)
              </div>
            </div>

            <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Soundbox Chime Audio</span>
              <div className="text-white text-sm font-semibold">
                {paymentConfig?.soundbox_enabled !== false ? 'Enabled (HTML5 Speech API)' : 'Disabled'}
              </div>
              <div className="text-[10px] text-slate-400">
                Speaks amount in real-time over counter speakers
              </div>
            </div>
          </div>
        </div>

        {/* Right: Security & Compliance Checklist */}
        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Security & Audit Status</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Isolated Command Panel Routes</div>
                <div className="text-[11px] text-slate-400">Sensitive financial keys hidden from counter operations</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Encrypted Local Persistence</div>
                <div className="text-[11px] text-slate-400">Cloudflare D1 database with SQLite fallback</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Section 285BA SFT Protection</div>
                <div className="text-[11px] text-slate-400">Current Account ₹50 Lakh annual threshold compliance</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">RuPay Credit Card on UPI</div>
                <div className="text-[11px] text-slate-400">P2M merchant registration active for 0% MDR</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
