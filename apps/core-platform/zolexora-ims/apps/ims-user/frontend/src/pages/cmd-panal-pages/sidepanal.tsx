import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  CreditCard,
  Users,
  Building2,
  Briefcase,
  Store,
  Boxes,
  ArrowUpRight,
  Lock,
  ChevronRight,
} from 'lucide-react';

export default function CmdSidepanal() {
  const location = useLocation();

  const navLinks = [
    {
      label: 'Command Overview',
      path: '/cmd-panal/dashboard',
      icon: ShieldCheck,
      desc: 'Governance & security audit',
    },
    {
      label: 'Payment Rails & Gateways',
      path: '/cmd-panal/payments',
      icon: CreditCard,
      desc: 'SBI VPA, Razorpay, Cashfree & Instant Settle',
      badge: 'SENSITIVE',
    },
    {
      label: 'Staff & Role Permissions',
      path: '/cmd-panal/users',
      icon: Users,
      desc: 'RBAC, cashier accounts & access control',
    },
    {
      label: 'Sites, Stores & Terminals',
      path: '/cmd-panal/sites',
      icon: Building2,
      desc: 'Warehouses, branches & POS registers',
    },
    {
      label: 'Company Legal Profile',
      path: '/cmd-panal/company',
      icon: Briefcase,
      desc: 'GSTIN, PAN, legal entity & tax rules',
    },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 border-r border-white/10 bg-[#0c0d18] flex flex-col justify-between flex-shrink-0 select-none overflow-hidden z-30">
      {/* 1. Fixed Top Header: Brand & Security Notice */}
      <div className="p-4 pb-3 border-b border-white/5 flex-shrink-0 space-y-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center font-black text-white shadow-lg shadow-purple-900/30 text-sm flex-shrink-0">
            <Lock className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
              <span>COMMAND PANEL</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-purple-500/30 to-indigo-500/30 text-purple-200 border border-purple-500/40 rounded font-mono font-bold tracking-wider">
                COMMANDER
              </span>
            </div>
            <div className="text-[10px] text-purple-300/80 font-medium">Executive Command Center</div>
          </div>
        </div>

        {/* Security Isolation Notice */}
        <div className="px-3 py-2 bg-purple-950/40 border border-purple-500/20 rounded-xl text-[11px] text-purple-200/90 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Central Command for corporate governance & sensitive setup.</span>
        </div>
      </div>

      {/* 2. Middle Scrollable Content (Scrollable ONLY between Top & Bottom) */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        {/* Navigation Links */}
        <nav className="space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Governance & Setup
          </div>
          {navLinks.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/cmd-panal/dashboard' &&
                (location.pathname === '/cmd-panal' ||
                  location.pathname === '/admin' ||
                  location.pathname === '/admin/dashboard'));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-purple-600/20 text-white border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-purple-400'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] px-1 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded font-mono font-bold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${
                    isActive ? 'text-purple-400 translate-x-0.5' : 'text-slate-600 group-hover:translate-x-0.5'
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 3. Fixed Bottom Section: Switchers Dock & Status Footer */}
      <div className="p-4 pt-3 border-t border-white/10 flex-shrink-0 bg-[#0c0d18] space-y-3">
        {/* Compact Operational Switchers (Side-by-Side at Bottom) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">
            <span>Switch Workspace</span>
            <span className="text-[8px] text-slate-500 font-mono">DOCK</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {/* POS Terminal */}
            <Link
              to="/pos/dashboard"
              onClick={() => localStorage.setItem('zolexora_last_app', 'pos')}
              className="flex items-center justify-between px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition group shadow-xs"
              title="Front Desk POS Terminal"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Store className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate">POS</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition flex-shrink-0" />
            </Link>

            {/* Inventory Logistics */}
            <Link
              to="/inv/dashboard"
              onClick={() => localStorage.setItem('zolexora_last_app', 'inv')}
              className="flex items-center justify-between px-2.5 py-1.5 bg-indigo-950/40 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-semibold transition group shadow-xs"
              title="Inventory & Warehouse Portal"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Boxes className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="truncate">Inventory</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* System Status Footer */}
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-slate-300 font-mono">Org Control Center</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">v2.4.0</span>
        </div>
      </div>
    </aside>
  );
}
