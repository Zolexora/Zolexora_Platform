import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Menu,
  X,
  ShieldCheck,
  Compass,
  DollarSign,
  Layers,
  ArrowUpRight,
  MapPin,
} from 'lucide-react';

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950 font-sans antialiased">
      {/* ─────────────────────────────────────────────────────────────
          1. MINIMAL HEADER / NAVBAR
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/75 border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <Truck className="h-5 w-5" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tracking-tight text-white">
                  Zolexora
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  TMS
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400 font-medium">
              <a href="#overview" className="hover:text-white transition">Overview</a>
              <a href="#features" className="hover:text-white transition">Features</a>
              <a href="#solutions" className="hover:text-white transition">Solutions</a>
              <a href="#pricing" className="hover:text-white transition">Pricing</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
            </nav>

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-medium text-zinc-300 hover:text-white px-3 py-2 transition"
              >
                Sign In
              </Link>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition shadow-sm hover:shadow-emerald-500/20 active:scale-95"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-800 bg-zinc-950/95 px-6 py-6 space-y-4">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-zinc-300">
              <a href="#overview" onClick={() => setMobileMenuOpen(false)} className="hover:text-white">Overview</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-white">Features</a>
              <a href="#solutions" onClick={() => setMobileMenuOpen(false)} className="hover:text-white">Solutions</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-white">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-white">FAQ</a>
            </nav>
            <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 text-sm font-medium text-zinc-300 border border-zinc-800 rounded-lg"
              >
                Sign In
              </Link>
              <Link
                to="/onboarding"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 text-sm font-semibold bg-emerald-500 text-zinc-950 rounded-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ─────────────────────────────────────────────────────────────
            2. AIRY, ELEGANT HERO SECTION
        ───────────────────────────────────────────────────────────── */}
        <section id="overview" className="relative pt-20 pb-28 md:pt-32 md:pb-36 overflow-hidden">
          {/* Subtle Ambient Light Glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />

          <div className="max-w-4xl mx-auto px-6 text-center">
            {/* Minimalist Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-1 text-xs font-medium text-emerald-300 mb-8 backdrop-blur">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span>Next-Gen Transport & Fleet Cloud</span>
            </div>

            {/* Hero Headline */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] max-w-3xl mx-auto">
              Transport operations,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">
                simplified.
              </span>
            </h1>

            {/* Refined Subtitle */}
            <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal">
              From automated driver dispatch to dynamic freight rate cards and instant GST invoicing.
              Run high-velocity transport logistics with zero friction and total financial clarity.
            </p>

            {/* Action Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/onboarding"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/15"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 px-6 py-3.5 text-sm font-medium text-zinc-300 hover:text-white transition"
              >
                <span>Console Sign In</span>
                <ArrowUpRight className="h-4 w-4 text-zinc-500" />
              </Link>
            </div>

            {/* Quiet Trust Note */}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <span>14-day free trial • No credit card required • Instant setup</span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. MINIMALIST PRODUCT PREVIEW (CLEAN & SPACIOUS)
          ───────────────────────────────────────────────────────────── */}
          <div className="max-w-5xl mx-auto px-6 mt-16 sm:mt-20">
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-2 shadow-2xl backdrop-blur-xl">
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-6 sm:p-8">
                {/* Mockup Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800/60 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <Compass className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Live Operations Command</div>
                      <div className="text-xs text-zinc-400">Active Duty Telemetry & Automated Billing</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                      42 Active Duties
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-zinc-900 text-zinc-400 font-mono border border-zinc-800">
                      99.8% On-Time
                    </span>
                  </div>
                </div>

                {/* Streamlined Live Duty Cards */}
                <div className="mt-6 space-y-3">
                  <div className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                        DT-9102
                      </span>
                      <div className="text-sm font-medium text-zinc-200">MH-04-GP-8842</div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Delhi Hub → Mumbai Depot</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-zinc-400">Driver: R. Sharma</span>
                      <span className="font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        En Route • 82 km/h
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/20">
                        DT-9103
                      </span>
                      <div className="text-sm font-medium text-zinc-200">KA-01-AX-4029</div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Bangalore South → Chennai Port</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-zinc-400">Driver: A. D&apos;Souza</span>
                      <span className="font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        Loading at Facility
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Summary Strip */}
                <div className="mt-6 pt-5 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Statutory Lockout Active: 100% Vehicles Verified</span>
                  </div>
                  <div className="font-mono text-zinc-300">
                    Gross Billed This Period: <span className="text-emerald-400 font-semibold">₹48,25,000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            4. SUBTLE LOGISTICS VERTICALS BAR
        ───────────────────────────────────────────────────────────── */}
        <section className="py-12 border-y border-zinc-800/40 bg-zinc-900/20">
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-400 mb-6">
              Tailored for high-reliability transport verticals
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-sm font-medium text-zinc-300">
              <span className="hover:text-emerald-400 transition">Commercial FTL</span>
              <span className="hover:text-emerald-400 transition">Part Truckload (LTL)</span>
              <span className="hover:text-emerald-400 transition">Cold Chain Logistics</span>
              <span className="hover:text-emerald-400 transition">Industrial Haulage</span>
              <span className="hover:text-emerald-400 transition">Intra-City Delivery</span>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            5. CORE VALUE PILLARS (CLEAN 3-COLUMN WITH ROOM TO BREATHE)
        ───────────────────────────────────────────────────────────── */}
        <section id="features" className="py-28 max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Platform Features
            </h2>
            <p className="mt-3 text-3xl font-bold text-white tracking-tight">
              Three pillars for seamless fleet orchestration
            </p>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Every tool designed to reduce manual coordination, eliminate billing delays, and guarantee compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="p-8 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 hover:border-zinc-700/80 transition">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-6">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Intelligent Dispatch</h3>
              <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Assign bookings and duties in seconds. Automatically matches vehicle capacity, driver status, and route constraints.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 hover:border-zinc-700/80 transition">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 mb-6">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Dynamic Rate Cards</h3>
              <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Configure tiered kilometre slabs, waiting fees, and driver batta. Generate fully compliant GST freight invoices instantly.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 hover:border-zinc-700/80 transition">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-6">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Compliance Sentinel</h3>
              <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Eliminate regulatory fines with automated pre-dispatch checks for expiring licenses, PUC, fitness, and insurance.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            6. DEEP DIVE HIGHLIGHT: OPERATIONS & FINANCIAL CLARITY
        ───────────────────────────────────────────────────────────── */}
        <section id="solutions" className="py-24 border-t border-zinc-800/40 bg-zinc-900/10">
          <div className="max-w-5xl mx-auto px-6 space-y-24">
            {/* Feature Story 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
                  Streamlined Coordination
                </span>
                <h3 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Driver settlements with zero discrepancies
                </h3>
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
                  Record trip cash advances, fuel chits, and FASTag tolls as they happen.
                  Generate net balance settlements when the driver arrives at the destination depot.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Real-time trip advance tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Automated fuel & toll deduction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>One-click settlement receipts</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 space-y-4">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Settlement Summary Preview
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/60 space-y-2.5 text-xs">
                  <div className="flex justify-between text-zinc-300">
                    <span>Base Freight Charge:</span>
                    <span className="font-mono font-medium text-white">₹28,500</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Advance Issued:</span>
                    <span className="font-mono text-zinc-300">- ₹10,000</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>FASTag Toll:</span>
                    <span className="font-mono text-zinc-300">- ₹2,800</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex justify-between font-semibold text-sm text-emerald-400">
                    <span>Net Balance Payable:</span>
                    <span className="font-mono">₹15,700</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Story 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 p-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 space-y-4">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Tenant Isolation Architecture
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                    <span className="text-zinc-300">Multi-Tenant Composite Keys</span>
                    <span className="text-emerald-400 font-mono">Enforced</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                    <span className="text-zinc-300">API Response Time</span>
                    <span className="text-emerald-400 font-mono">&lt; 45ms</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                    <span className="text-zinc-300">Data-at-Rest Encryption</span>
                    <span className="text-emerald-400 font-mono">AES-256</span>
                  </div>
                </div>
              </div>

              <div className="order-1 md:order-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
                  Enterprise Security
                </span>
                <h3 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Strict tenant isolation from the ground up
                </h3>
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
                  Your fleet records, customer contracts, and financial ledgers are completely insulated.
                  Role-based access control allows fine-grained separation between dispatchers, accountants, and branch managers.
                </p>
                <div className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-400">
                  <Layers className="h-4 w-4" />
                  <span>Production PostgreSQL 16 + Async Connection Pooling</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            7. PRICING (CLEAN, TRANSPARENT & SPACIOUS)
        ───────────────────────────────────────────────────────────── */}
        <section id="pricing" className="py-28 max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Plans & Pricing
            </h2>
            <p className="mt-3 text-3xl font-bold text-white tracking-tight">
              Simple pricing for growing fleets
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              Transparent subscriptions with no hidden per-duty commissions.
            </p>

            {/* Period Switch */}
            <div className="mt-8 inline-flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-1.5 rounded-lg transition ${
                  billingPeriod === 'monthly' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-1.5 rounded-lg transition ${
                  billingPeriod === 'annual' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Starter</h3>
                <p className="text-xs text-zinc-400 mt-1">For independent fleets and hauliers.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">
                    {billingPeriod === 'annual' ? '₹4,999' : '₹5,999'}
                  </span>
                  <span className="text-xs text-zinc-500">/ mo</span>
                </div>
                <div className="mt-6 space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Up to 15 vehicles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Core duty dispatch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Driver KYC management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Standard GST invoices</span>
                  </div>
                </div>
              </div>
              <Link
                to="/onboarding"
                className="mt-8 block text-center py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition"
              >
                Choose Starter
              </Link>
            </div>

            {/* Growth (Highlighted) */}
            <div className="relative p-8 rounded-2xl border-2 border-emerald-500 bg-zinc-950 flex flex-col justify-between shadow-xl shadow-emerald-500/10">
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  Most Popular
                </div>
                <h3 className="text-base font-bold text-white">Growth 3PL</h3>
                <p className="text-xs text-zinc-400 mt-1">For expanding logistics operators.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-emerald-400 font-mono">
                    {billingPeriod === 'annual' ? '₹14,999' : '₹18,499'}
                  </span>
                  <span className="text-xs text-zinc-500">/ mo</span>
                </div>
                <div className="mt-6 space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-white font-medium">Up to 75 vehicles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Dynamic rate cards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Statutory compliance lockout</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Driver settlements & FASTag</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Multi-branch operating units</span>
                  </div>
                </div>
              </div>
              <Link
                to="/onboarding"
                className="mt-8 block text-center py-2.5 rounded-xl bg-emerald-500 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition"
              >
                Choose Growth
              </Link>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Enterprise</h3>
                <p className="text-xs text-zinc-400 mt-1">For national freight networks.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">Custom</span>
                </div>
                <div className="mt-6 space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Unlimited vehicles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Private VPC or On-Prem</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Custom ERP connectors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Dedicated SLA support</span>
                  </div>
                </div>
              </div>
              <Link
                to="/onboarding"
                className="mt-8 block text-center py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            8. MINIMALIST FAQ ACCORDION
        ───────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-24 border-t border-zinc-800/40 max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              FAQ
            </h2>
            <p className="mt-2 text-2xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'How fast can we onboard our existing fleet and drivers?',
                a: 'You can import your fleet and driver records via CSV in minutes, or connect through our REST API. Once uploaded, document validity is verified immediately.',
              },
              {
                q: 'How does the Pre-Dispatch Compliance Lockout work?',
                a: 'The system validates driver licenses, PUC, road permits, and fitness certificates before duty confirmation. If any document is expired, assignment is automatically blocked.',
              },
              {
                q: 'Is our organisation data strictly isolated from other tenants?',
                a: 'Yes. Every database query enforces composite tenant keys and JWT claims. Data from different organisations is strictly compartmentalized.',
              },
              {
                q: 'Can we create custom roles for dispatchers and billing managers?',
                a: 'Yes. Organizations can grant specific permissions to dispatchers, accountants, and branch supervisors without exposing full administrative controls.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-medium text-zinc-200 hover:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/40 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            9. CALM, HIGH-IMPACT FINAL CTA
        ───────────────────────────────────────────────────────────── */}
        <section className="py-24 border-t border-zinc-800/40">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Modernize your transport operations today.
            </h2>
            <p className="mt-3 text-sm text-zinc-400 max-w-xl mx-auto">
              Join forward-thinking freight operators. Create your workspace in under 3 minutes.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/onboarding"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-3 text-sm font-medium text-zinc-300 hover:text-white transition"
              >
                <span>Sign In</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          10. MINIMALIST FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950 py-12 text-xs text-zinc-400">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-zinc-300">
            <Truck className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-white">Zolexora TMS</span>
            <span className="text-zinc-600">•</span>
            <span>Enterprise Transport Management</span>
          </div>

          <div className="flex items-center gap-6 text-zinc-400">
            <a href="http://localhost:4030/docs" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition">
              API Docs
            </a>
            <Link to="/onboarding" className="hover:text-emerald-400 transition">
              Onboarding
            </Link>
            <Link to="/login" className="hover:text-emerald-400 transition">
              Sign In
            </Link>
          </div>

          <div className="text-zinc-400">
            © 2026 Zolexora Platform Inc.
          </div>
        </div>
      </footer>
    </div>
  );
}
