import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Boxes,
  ArrowUpRight,
  Store,
  Clock,
  Database,
  Receipt,
  UtensilsCrossed,
  BookOpen,
  Users,
  Wallet,
  BarChart3,
  Settings,
  CreditCard,
  Bike,
  ShieldCheck,
} from 'lucide-react';

interface PosSidepanalProps {
  sellingPoint?: string;
}

export default function PosSidepanal({
  sellingPoint = 'SP_001',
}: PosSidepanalProps) {
  const location = useLocation();

  const navLinks = [
    { label: 'Register Terminal', path: '/pos/dashboard', icon: ShoppingCart },
    { label: 'Online Aggregators', path: '/pos/online-orders', icon: Bike },
    { label: 'Orders & KOT Tickets', path: '/pos/orders', icon: Receipt },
    { label: 'Floor & Table Map', path: '/pos/tables', icon: UtensilsCrossed },
    { label: 'Menu & Quick Keys', path: '/pos/menu', icon: BookOpen },
    { label: 'Customer CRM & Club', path: '/pos/customers', icon: Users },
    { label: 'Cash Drawer & Float', path: '/pos/cash-drawer', icon: Wallet },
    { label: 'POS Sales & Z-Report', path: '/pos/reports', icon: BarChart3 },
    { label: 'Hardware & Printers', path: '/pos/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 border-r border-white/10 bg-[#0f111c] flex flex-col justify-between flex-shrink-0 select-none overflow-hidden z-30">
      {/* 1. Fixed Top Header: Brand */}
      <div className="p-4 pb-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white shadow-md text-sm flex-shrink-0">
            P
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white">ZOLEXORA POS</div>
            <div className="text-[10px] text-emerald-400 font-medium">Front Register Terminal</div>
          </div>
        </div>
      </div>

      {/* 2. Middle Scrollable Content (Scrollable ONLY between Top & Bottom) */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        {/* Main POS Navigation Links (ALL strictly pointing to /pos/*) */}
        <div className="space-y-1">
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            POS Navigation
          </div>
          <nav className="space-y-0.5">
            {navLinks.map((item) => {
              const active =
                location.pathname === item.path ||
                (item.path === '/pos/dashboard' &&
                  (location.pathname === '/pos' || location.pathname === '/pos/dashboard'));
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => localStorage.setItem('zolexora_last_app', 'pos')}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                    active
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-xs font-semibold'
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

        {/* Counter Scope & Hardware Status */}
        <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Terminal Hardware
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <Store className="w-3 h-3 text-emerald-400" />
                Active Desk
              </span>
              <span className="font-mono text-white">{sellingPoint}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <CreditCard className="w-3 h-3 text-indigo-400" />
                Payments
              </span>
              <span className="text-emerald-400 font-medium">Cash / Card / UPI</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <Database className="w-3 h-3 text-cyan-400" />
                Edge Sync
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                D1 Connected
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Fixed Bottom Section: Switchers Dock & Outlet Footer */}
      <div className="p-4 pt-3 border-t border-white/10 flex-shrink-0 bg-[#0f111c] space-y-3">
        {/* Compact Workspace Switchers (Side-by-Side at Bottom) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">
            <span>Switch Workspace</span>
            <span className="text-[8px] text-slate-500 font-mono">DOCK</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Inventory Terminal */}
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
              <ArrowUpRight className="w-3 h-3 text-indigo-400/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition flex-shrink-0" />
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

        {/* Footer Info */}
        <div className="px-1 space-y-1.5 text-xs text-slate-400 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Store className="w-3 h-3 text-slate-500" />
              <span>Outlet</span>
            </span>
            <span className="text-white font-mono text-[11px]">S_001 (Retail)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Terminal</span>
            </span>
            <span className="text-slate-300 font-mono text-[10px]">TERM-SP001-D1</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
