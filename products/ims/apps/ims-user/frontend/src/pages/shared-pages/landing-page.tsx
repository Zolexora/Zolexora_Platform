import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Boxes,
  ShieldCheck,
  Zap,
  ArrowRight,
  TrendingUp,
  Building2,
  Lock,
  FileSpreadsheet,
  CheckCircle2,
  Terminal,
  Store,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080e] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/10 bg-[#0c0e18]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-600/30">
            Z
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
              ZOLEXORA IMS
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                v2.0 D1 Edge
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Enterprise Retail & Inventory Operations</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs text-slate-300">
          <Link to="/pos" className="hover:text-white transition flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
            <span>POS Register</span>
          </Link>
          <Link to="/dashboard" className="hover:text-white transition flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-emerald-400" />
            <span>Inventory Master</span>
          </Link>
          <Link to="/onboarding" className="hover:text-white transition">
            Store Onboarding
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-white/5 transition"
          >
            Staff Login
          </Link>
          <Link
            to="/onboarding"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 max-w-6xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
          <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Cloudflare D1 Relational Engine & Supabase Auth</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight">
          Next-Generation Retail <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            Point of Sale & Inventory
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          High-speed POS cash register, real-time multi-warehouse stock allocations, material requisitions, and sub-millisecond edge session caching.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/pos"
            className="flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Launch POS Register</span>
          </Link>

          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 px-7 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl text-sm font-bold transition transform hover:-translate-y-0.5"
          >
            <Boxes className="w-4 h-4 text-emerald-400" />
            <span>Open Inventory Portal</span>
          </Link>
        </div>

        {/* Live Metrics Strip */}
        <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="p-4 bg-[#0f111c] border border-white/5 rounded-2xl space-y-1 shadow-md">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>D1 Edge Latency</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">&lt; 15 ms</div>
            <div className="text-[10px] text-emerald-400">Global Cloudflare Mesh</div>
          </div>

          <div className="p-4 bg-[#0f111c] border border-white/5 rounded-2xl space-y-1 shadow-md">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-indigo-400" />
              <span>Multi-Store Sync</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">100% Real-Time</div>
            <div className="text-[10px] text-slate-400">Store 1, Store 2 & Hub</div>
          </div>

          <div className="p-4 bg-[#0f111c] border border-white/5 rounded-2xl space-y-1 shadow-md">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-purple-400" />
              <span>Checkout Speed</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">Instant</div>
            <div className="text-[10px] text-slate-400">Thermal receipt & cash change</div>
          </div>

          <div className="p-4 bg-[#0f111c] border border-white/5 rounded-2xl space-y-1 shadow-md">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auth Architecture</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">Supabase + KV</div>
            <div className="text-[10px] text-emerald-400">Cryptographic 7-Day TTL</div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-6 max-w-6xl mx-auto w-full space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Designed for Modern Multi-Location Retail
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Everything you need to run checkout registers, manage inventory, and audit stock transfers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-[#0e101b] border border-white/5 rounded-2xl space-y-3 hover:border-indigo-500/30 transition shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">High-Speed POS Register</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fast item barcode lookup, instant add-to-cart, cash tendered change calculator, discount toggles, and thermal print-ready sales receipts.
            </p>
          </div>

          <div className="p-6 bg-[#0e101b] border border-white/5 rounded-2xl space-y-3 hover:border-emerald-500/30 transition shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">SKU Inventory Master</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Track stock levels across Main Warehouse, Branch Outlets, and Central Hubs with minimum-stock replenishment alerts and valuation breakdown.
            </p>
          </div>

          <div className="p-6 bg-[#0e101b] border border-white/5 rounded-2xl space-y-3 hover:border-purple-500/30 transition shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Material Issuance & GRN</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Book supplier purchase orders (Goods Receipt Notes) and issue materials with dispatch vouchers and authorization tracking.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 bg-[#0a0b12] py-8 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span>All Systems Operational • Cloudflare D1 + Render</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/landing" className="hover:text-white transition">Home</Link>
            <Link to="/login" className="hover:text-white transition">Staff Sign In</Link>
            <Link to="/onboarding" className="hover:text-white transition">Store Onboarding</Link>
            <Link to="/pos" className="hover:text-white transition">POS Terminal</Link>
          </div>

          <div>© 2026 Zolexora IMS. Enterprise Monorepo Edition.</div>
        </div>
      </footer>
    </div>
  );
}
