import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Truck,
  FileSpreadsheet,
  BarChart3,
  UserCircle,
  PackagePlus,
  ArrowUpRight,
  Database,
  Store,
  ShoppingCart,
  ShieldCheck,
} from 'lucide-react';

export default function Sidepanal() {
  const location = useLocation();

  const navLinks = [
    { label: 'Dashboard', path: '/inv/dashboard', icon: LayoutDashboard },
    { label: 'Products Master', path: '/inv/products', icon: Boxes },
    { label: 'Requisitions', path: '/inv/requisitions', icon: ClipboardList },
    { label: 'Suppliers & Vendors', path: '/inv/suppliers', icon: Truck },
    { label: 'Issuance Logs', path: '/inv/issuance-logs', icon: FileSpreadsheet },
    { label: 'Reports & Analytics', path: '/inv/reports', icon: BarChart3 },
    { label: 'Profile Settings', path: '/inv/profile', icon: UserCircle },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 border-r border-white/10 bg-[#0f111c] flex flex-col justify-between flex-shrink-0 select-none overflow-hidden z-30">
      {/* 1. Fixed Top Header: Brand */}
      <div className="p-4 pb-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white shadow-md text-sm flex-shrink-0">
            Z
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white">ZOLEXORA IMS</div>
            <div className="text-[10px] text-slate-400">Inventory & Logistics</div>
          </div>
        </div>
      </div>

      {/* 2. Middle Scrollable Content (Scrollable ONLY between Top & Bottom) */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        {/* Quick Action Forms */}
        <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Quick Actions
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <Link
              to="/inv/forms/sku-addition"
              className="flex items-center gap-2 px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold transition"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>+ New SKU</span>
            </Link>
            <Link
              to="/inv/forms/purchase-entry"
              className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold transition"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>+ Purchase GRN</span>
            </Link>
            <Link
              to="/inv/forms/issuance-entry"
              className="flex items-center gap-2 px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>+ Issue Material</span>
            </Link>
          </div>
        </div>

        {/* Main Navigation Links */}
        <div className="space-y-1">
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Inventory Navigation
          </div>
          <nav className="space-y-0.5">
            {navLinks.map((item) => {
              const active =
                location.pathname === item.path ||
                (item.path === '/inv/dashboard' &&
                  (location.pathname === '/' ||
                    location.pathname === '/inv' ||
                    location.pathname === '/dashboard'));
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-xs font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 3. Fixed Bottom Section: Switchers Dock & Scope Footer */}
      <div className="p-4 pt-3 border-t border-white/10 flex-shrink-0 bg-[#0f111c] space-y-3">
        {/* Compact Workspace Switchers (Side-by-Side at Bottom) */}
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
              <ArrowUpRight className="w-3 h-3 text-emerald-400/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition flex-shrink-0" />
            </Link>

            {/* Command Panel (Commander) */}
            <Link
              to="/cmd-panal/dashboard"
              onClick={() => localStorage.setItem('zolexora_last_app', 'cmd-panal')}
              className="flex items-center justify-between px-2.5 py-1.5 bg-purple-950/40 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 rounded-lg text-xs font-semibold transition group shadow-xs"
              title="Command Panel (Commander)"
            >
              <div className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className="truncate">Command</span>
              </div>
              <ArrowUpRight className="w-3 h-3 text-purple-400/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* System Scope Info */}
        <div className="px-1 space-y-1.5 text-xs text-slate-400 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Store className="w-3 h-3 text-slate-500" />
              <span>Scope</span>
            </span>
            <span className="text-white font-mono text-[11px]">S_001 (Main)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Database className="w-3 h-3 text-indigo-400" />
              <span>Cloudflare D1</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Sync Active
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
