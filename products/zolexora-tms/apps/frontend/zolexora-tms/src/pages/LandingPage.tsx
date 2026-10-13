import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Users,
  MapPin,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  Menu,
  X,
  Lock,
  Fuel,
  Compass,
  ArrowUpRight,
  Award,
  TrendingUp,
} from 'lucide-react';

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [activeTab, setActiveTab] = useState<'dispatch' | 'financials' | 'compliance'>('dispatch');
  
  // Interactive ROI Calculator State
  const [fleetSize, setFleetSize] = useState<number>(35);
  const [tripsPerMonth, setTripsPerMonth] = useState<number>(22);

  // FAQ open states
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Derived ROI calculations
  const estimatedFuelSavingsMonthly = Math.round(fleetSize * tripsPerMonth * 450);
  const hoursSavedMonthly = Math.round(fleetSize * 4.5);
  const annualSavingsInLakhs = ((estimatedFuelSavingsMonthly * 12 + hoursSavedMonthly * 12 * 350) / 100000).toFixed(1);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NOTIFICATION BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="relative isolate flex items-center justify-center gap-x-3 overflow-hidden bg-gradient-to-r from-emerald-950 via-zinc-900 to-emerald-950 px-6 py-2.5 text-xs font-medium text-emerald-300 border-b border-emerald-500/20 shadow-sm">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="truncate">
          <strong>Zolexora TMS Enterprise v2.4</strong> — Automated Multi-Tenant Dispatch & Dynamic Financial Slabs Now Live.
        </span>
        <Link
          to="/onboarding"
          className="hidden md:inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 ml-2"
        >
          Claim 14-Day Production Trial <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGATION HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:border-emerald-400 group-hover:scale-105 transition duration-200 shadow-lg shadow-emerald-500/10">
                <Truck className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition">
                    Zolexora <span className="text-emerald-400">TMS</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Enterprise
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 tracking-wide font-medium">
                  Transport Management System
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-zinc-300">
              <a href="#features" className="hover:text-emerald-400 transition">Features</a>
              <a href="#operations" className="hover:text-emerald-400 transition">Live Operations</a>
              <a href="#financials" className="hover:text-emerald-400 transition">Financial Engine</a>
              <a href="#calculator" className="hover:text-emerald-400 transition">ROI Calculator</a>
              <a href="#architecture" className="hover:text-emerald-400 transition">Architecture</a>
              <a href="#pricing" className="hover:text-emerald-400 transition">Pricing</a>
              <a href="#faq" className="hover:text-emerald-400 transition">FAQ</a>
            </nav>

            {/* Desktop CTAs */}
            <div className="hidden sm:flex items-center gap-4">
              <a
                href="http://localhost:4030/docs"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-2 rounded-lg border border-transparent hover:border-zinc-800 transition"
              >
                API Docs
              </a>
              <Link
                to="/login"
                className="text-sm font-semibold text-zinc-200 hover:text-emerald-400 transition px-3 py-2"
              >
                Sign In
              </Link>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-zinc-800 bg-zinc-950 px-4 pt-4 pb-6 space-y-4">
            <nav className="flex flex-col space-y-3 text-base font-medium text-zinc-300">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-400">Features</a>
              <a href="#operations" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-400">Live Operations</a>
              <a href="#financials" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-400">Financial Engine</a>
              <a href="#calculator" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-400">ROI Calculator</a>
              <a href="#architecture" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-400">Architecture</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-400">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-emerald-400">FAQ</a>
            </nav>
            <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2.5 text-sm font-semibold text-zinc-200 border border-zinc-800 rounded-lg hover:bg-zinc-900"
              >
                Sign In to Console
              </Link>
              <Link
                to="/onboarding"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2.5 text-sm font-semibold bg-emerald-500 text-zinc-950 rounded-lg hover:bg-emerald-400"
              >
                Register Organisation
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          3. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        {/* Glow Effects Background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-teal-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-semibold text-emerald-300 mb-8 backdrop-blur shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Unified Multi-Tenant Fleet Orchestration Engine</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.12]">
            Modern Transport Operations.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
              Zero Leakage. Total Control.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-3xl mx-auto text-lg sm:text-xl text-zinc-400 leading-relaxed">
            The mission-critical logistics software powering regional hauliers and enterprise 3PLs.
            Automate driver duty allocation, manage dynamic GST rate cards, enforce strict safety compliance,
            and reconcile trip expenses in real time.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/onboarding"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-emerald-500 px-8 py-4 text-base font-bold text-zinc-950 transition hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-500/20 active:scale-98"
            >
              <span>Start Free 14-Day Trial</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 px-8 py-4 text-base font-semibold text-zinc-200 transition"
            >
              <span>Sign In to Console</span>
              <ArrowUpRight className="h-4 w-4 text-zinc-400" />
            </Link>
          </div>

          {/* Health indicator */}
          <div className="mt-8 flex items-center justify-center gap-3 text-xs text-zinc-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Production Core Ready • Sub-50ms API Latency • Strict Tenant Isolation</span>
          </div>

          {/* Metrics Proof Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur text-left">
              <div className="text-3xl font-extrabold text-emerald-400">99.98%</div>
              <div className="text-xs font-semibold text-zinc-300 mt-1">On-Time Dispatch SLA</div>
              <div className="text-[11px] text-zinc-500 mt-1">Automated duty allocation</div>
            </div>
            <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur text-left">
              <div className="text-3xl font-extrabold text-emerald-400">4.2x</div>
              <div className="text-xs font-semibold text-zinc-300 mt-1">Faster Billing Cycles</div>
              <div className="text-[11px] text-zinc-500 mt-1">From delivery to GST invoice</div>
            </div>
            <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur text-left">
              <div className="text-3xl font-extrabold text-emerald-400">0%</div>
              <div className="text-xs font-semibold text-zinc-300 mt-1">Multi-Tenant Leakage</div>
              <div className="text-[11px] text-zinc-500 mt-1">Tenant composite keys & RLS</div>
            </div>
            <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur text-left">
              <div className="text-3xl font-extrabold text-emerald-400">100%</div>
              <div className="text-xs font-semibold text-zinc-300 mt-1">Automated Compliance</div>
              <div className="text-[11px] text-zinc-500 mt-1">Driver & vehicle expiry sentinel</div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. LIVE INTERACTIVE PLATFORM SIMULATOR
        ───────────────────────────────────────────────────────────── */}
        <div id="operations" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Window header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-500/70" />
                <div className="h-3 w-3 rounded-full bg-amber-500/70" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
                <span className="ml-3 text-xs font-mono text-zinc-400 hidden sm:inline">
                  tms.zolexora.com/operations/command-center
                </span>
              </div>
              {/* Simulation Navigation Tabs */}
              <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('dispatch')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'dispatch'
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Live Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('financials')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'financials'
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Rate Cards & Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('compliance')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'compliance'
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Compliance Sentinel
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="p-6 md:p-8">
              {activeTab === 'dispatch' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Compass className="h-5 w-5 text-emerald-400" />
                        Live Fleet Telemetry & Active Duties
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Continuous synchronization with operating units, GPS beacons, and driver check-ins.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        48 Vehicles Active
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        2 Sched Ahead
                      </span>
                    </div>
                  </div>

                  {/* Active Duty Rows */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Duty Card 1 */}
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 hover:border-emerald-500/40 transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                            DUTY-8941
                          </span>
                          <span className="text-xs text-zinc-400 font-semibold">MH-04-GP-8842</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ON SCHEDULE
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-semibold text-zinc-200">
                        <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                        <span>Delhi Central Hub</span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                        <span>Mumbai Western Depot</span>
                      </div>
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                        <span>Driver: Ramesh Sharma</span>
                        <span className="text-emerald-400 font-mono">Progress: 68% • 84 km/h</span>
                      </div>
                    </div>

                    {/* Duty Card 2 */}
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 hover:border-emerald-500/40 transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/20">
                            DUTY-8942
                          </span>
                          <span className="text-xs text-zinc-400 font-semibold">KA-01-AX-4029</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          LOADING CARGO
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-semibold text-zinc-200">
                        <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                        <span>Bangalore South Facility</span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                        <span>Chennai Port Terminal</span>
                      </div>
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                        <span>Driver: Anthony D&apos;Souza</span>
                        <span className="text-amber-400 font-mono">Gate Entry Completed</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'financials' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-emerald-400" />
                        Dynamic Freight Slabs & Instant Billing
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Granular rate cards calculate per km, waiting charges, toll, and driver allowances automatically.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                      Current Period: Active FY-26 Q3
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
                      <div className="text-xs text-zinc-400">Period Gross Billing</div>
                      <div className="text-2xl font-bold text-white mt-1">₹48,25,400</div>
                      <div className="text-[11px] text-emerald-400 mt-1 font-medium">↑ 18.4% vs last period</div>
                    </div>
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
                      <div className="text-xs text-zinc-400">Driver Trip Advances</div>
                      <div className="text-2xl font-bold text-white mt-1">₹6,40,200</div>
                      <div className="text-[11px] text-zinc-400 mt-1 font-medium">Reconciled via FASTag & Fuel</div>
                    </div>
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
                      <div className="text-xs text-zinc-400">Realized Margin</div>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">28.4%</div>
                      <div className="text-[11px] text-emerald-400 mt-1 font-medium">Zero untracked detention</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 text-xs font-mono text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span>Rate Slab: Base ₹2,400 (first 30km) + ₹28.50/km thereafter + ₹150/hr waiting charge</span>
                    <span className="text-emerald-400 font-semibold">Status: GST E-Invoice #INV-2026-991 Generated</span>
                  </div>
                </div>
              )}

              {activeTab === 'compliance' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                        Compliance Sentinel & Pre-Dispatch Lockout
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Automatic blocking of duty assignments when PUC, fitness, permit, or driver license expires.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      100% Fleet Compliant
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-white">Driver License & KYC Verification</h4>
                        <p className="text-xs text-zinc-400 mt-1">
                          Aadhaar KYC, heavy motor vehicle license endorsement, and medical clearance confirmed.
                        </p>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-white">National Permit & Fitness Certificate</h4>
                        <p className="text-xs text-zinc-400 mt-1">
                          Auto-monitored against RTO registries. Alerts sent 30, 15, and 3 days before renewal deadlines.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Sentinel rule active: Dispatch attempts on non-compliant units are automatically blocked and logged to the audit trail.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. TRUSTED LOGISTICS VERTICALS
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 border-y border-zinc-800/80 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Engineered for high-reliability freight sectors across the nation
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 text-center">
            <div className="p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition">
              Full Truckload (FTL)
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition">
              Part Truckload (LTL)
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition">
              Cold Chain Logistics
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition">
              Industrial Heavy Haul
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition">
              Intra-City Delivery
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition">
              Corporate Shuttle Fleets
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. CORE FEATURE PILLARS
      ───────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Comprehensive Platform Capabilities
          </h2>
          <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Built from first principles for operational rigor
          </p>
          <p className="mt-4 text-base text-zinc-400">
            Eliminate disconnected spreadsheets, phone calls, and manual invoice reconciliation with an integrated operating system.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 transition group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition">
              <Compass className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-emerald-300 transition">
              Intelligent Dispatch & Duties
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Match customer booking requests with optimal vehicles and verified drivers instantly based on weight capacity, route history, and availability.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span>Automated Duty Staging</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 transition group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/30 group-hover:scale-110 transition">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-teal-300 transition">
              Dynamic Rate Cards & GST Invoicing
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Define customer-specific pricing structures with variable kilometre slabs, waiting charges, toll adjustments, and automated tax calculations.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-teal-400">
              <span>One-Click E-Invoicing</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          {/* Feature 3 */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 transition group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-emerald-300 transition">
              Statutory Compliance Sentinel
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Never face road tax or fitness fines. Pre-dispatch validation guarantees that expiring documents block duty assignment automatically.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span>Continuous Audit Rules</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          {/* Feature 4 */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 transition group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/30 group-hover:scale-110 transition">
              <Fuel className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-teal-300 transition">
              Trip Expense & Advance Settlements
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Capture driver trip advances, diesel consumption receipts, toll logs, and maintenance costs with automated net payout calculations.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-teal-400">
              <span>FASTag & Cash Reconciliation</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          {/* Feature 5 */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 transition group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-emerald-300 transition">
              Multi-Branch Operating Units
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Model complex hub structures with regional depots, local operating units, and customized role permissions for dispatchers, accountants, and managers.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span>Granular Role RBAC</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          {/* Feature 6 */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-zinc-900/70 transition group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/30 group-hover:scale-110 transition">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-teal-300 transition">
              Real-Time P&L & Financial Closing
            </h3>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Instant profitability analysis for every vehicle, route, and customer duty. Close monthly periods with complete auditable reconciliation.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-teal-400">
              <span>Financial Ledger Reports</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. INTERACTIVE ROI & EFFICIENCY CALCULATOR
      ───────────────────────────────────────────────────────────── */}
      <section id="calculator" className="py-20 bg-zinc-900/40 border-y border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Financial Impact Simulator
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-white tracking-tight">
              Estimate Your Operational Cost Savings
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              Calculate projected fuel recovery, billing cycle acceleration, and administrative savings with Zolexora TMS.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-zinc-950 p-8 sm:p-10 rounded-3xl border border-zinc-800 shadow-xl">
            {/* Controls */}
            <div className="lg:col-span-7 space-y-8">
              {/* Slider 1: Fleet Size */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-2">
                  <span className="text-zinc-200">Total Fleet Vehicles</span>
                  <span className="text-emerald-400 font-mono text-base">{fleetSize} Vehicles</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="250"
                  step="5"
                  value={fleetSize}
                  onChange={(e) => setFleetSize(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
                  <span>5 Vehicles</span>
                  <span>100 Vehicles</span>
                  <span>250+ Vehicles</span>
                </div>
              </div>

              {/* Slider 2: Trips per Month */}
              <div>
                <div className="flex justify-between text-sm font-semibold mb-2">
                  <span className="text-zinc-200">Average Trips / Vehicle / Month</span>
                  <span className="text-emerald-400 font-mono text-base">{tripsPerMonth} Trips</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={tripsPerMonth}
                  onChange={(e) => setTripsPerMonth(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
                  <span>5 Trips</span>
                  <span>30 Trips</span>
                  <span>60 Trips</span>
                </div>
              </div>

              {/* Value propositions */}
              <div className="pt-4 border-t border-zinc-900 grid grid-cols-2 gap-4 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Eliminates unbilled idle detention</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Instant GST invoice delivery</span>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-zinc-900 border border-emerald-500/20 text-center space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                  Estimated Annual Savings
                </span>
                <div className="text-4xl sm:text-5xl font-black text-emerald-400 mt-2 font-mono">
                  ₹{annualSavingsInLakhs} L
                </div>
                <span className="text-xs text-zinc-400 mt-1 block">
                  Projected net bottom-line recovery
                </span>
              </div>

              <div className="pt-4 border-t border-zinc-800 space-y-3 text-left">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Monthly Fuel & Detention Recovery:</span>
                  <span className="font-mono text-white font-semibold">₹{estimatedFuelSavingsMonthly.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Admin Hours Saved per Month:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{hoursSavedMonthly} Hours</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Average Billing Turnaround:</span>
                  <span className="font-mono text-white font-semibold">18 Days → 2 Hours</span>
                </div>
              </div>

              <Link
                to="/onboarding"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 transition"
              >
                <span>Unlock Full Savings</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. SYSTEM ARCHITECTURE & RESILIENCE
      ───────────────────────────────────────────────────────────── */}
      <section id="architecture" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
              <Layers className="h-3.5 w-3.5" />
              <span>Engineered for 99.99% Availability</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Enterprise Invariants & Zero-Trust Data Architecture
            </h2>
            <p className="mt-4 text-base text-zinc-400 leading-relaxed">
              Zolexora TMS is engineered with strict database-level tenancy guarantees. Every query, mutation,
              and reporting job is bound by tenant composite foreign keys and validated via cryptographic JWT assertions.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Strict Tenant Isolation & Composite Keys</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Every operational record (bookings, vehicles, duties, and ledger lines) is anchored to the organization ID, preventing data bleed across organizations.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">High-Throughput Asyncpg & FastAPI Engine</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Non-blocking asynchronous connection pooling capable of orchestrating thousands of fleet telematics events concurrently.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Comprehensive Audit Telemetry</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Immutable event tracking records every duty status transition, invoice modification, and user permission grant.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Code Preview */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 font-mono text-xs shadow-2xl overflow-x-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 text-zinc-400">
              <span className="text-emerald-400 font-bold">system_invariants.json</span>
              <span className="text-[11px]">Strict Multi-Tenant Invariant Policy</span>
            </div>
            <pre className="mt-4 text-zinc-300 leading-relaxed">
{`{
  "system": "Zolexora TMS Enterprise",
  "version": "2.4.0",
  "database": {
    "engine": "PostgreSQL 16",
    "driver": "asyncpg",
    "schema_isolation": "tenant_composite_keys",
    "connection_pooling": {
      "min_size": 10,
      "max_size": 50,
      "timeout_sec": 30
    }
  },
  "security": {
    "authentication": "JWT_JWKS_VERIFICATION",
    "tenant_enforcement": "REQUIRED_HEADER_AND_JWT",
    "encryption": "AES_256_GCM_REST_AND_TRANSIT",
    "statutory_lockout": "ENABLED"
  },
  "endpoints": {
    "canonical_api": "https://api.tms.zolexora.onrender.com",
    "health_check": "http://127.0.0.1:4030/health",
    "status": "HEALTHY"
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. TRANSPARENT PRICING PLANS
      ───────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-zinc-900/30 border-y border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Transparent Production Pricing
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Scale Your Fleet With Predictable Costs
            </p>
            <p className="mt-4 text-base text-zinc-400">
              No hidden fees. All plans include full access to core operations, duty workflows, and customer onboarding.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="mt-8 inline-flex items-center gap-3 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  billingPeriod === 'monthly'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  billingPeriod === 'annual'
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] bg-zinc-900/40 text-zinc-900 px-1.5 py-0.2 rounded font-black">
                  SAVE 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Starter Fleet</h3>
                <p className="text-xs text-zinc-400 mt-2">
                  Ideal for regional hauliers and owner-operators stepping up to digital dispatch.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">
                    {billingPeriod === 'annual' ? '₹4,999' : '₹5,999'}
                  </span>
                  <span className="text-xs text-zinc-500">/ month</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Billed {billingPeriod}</div>

                <div className="mt-8 space-y-3 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Up to 15 Active Vehicles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Core Bookings & Duty Dispatch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Driver KYC & License Tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Standard GST Freight Invoicing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Single Hub Operating Unit</span>
                  </div>
                </div>
              </div>

              <Link
                to="/onboarding"
                className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition"
              >
                <span>Start Starter Trial</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Growth 3PL Plan (Highlighted) */}
            <div className="relative p-8 rounded-3xl border-2 border-emerald-500 bg-zinc-950 shadow-xl shadow-emerald-500/10 flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black uppercase tracking-wider">
                Most Popular
              </div>

              <div>
                <h3 className="text-xl font-bold text-white flex items-center justify-between">
                  <span>Growth 3PL</span>
                  <Award className="h-5 w-5 text-emerald-400" />
                </h3>
                <p className="text-xs text-zinc-400 mt-2">
                  Built for expanding freight operators requiring multi-hub management and dynamic financial slabs.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-emerald-400 font-mono">
                    {billingPeriod === 'annual' ? '₹14,999' : '₹18,499'}
                  </span>
                  <span className="text-xs text-zinc-500">/ month</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Billed {billingPeriod}</div>

                <div className="mt-8 space-y-3 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-white">Up to 75 Active Vehicles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Dynamic Multitier Rate Cards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Statutory Compliance Sentinel & Lockout</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Trip Advance & FASTag Reconciliation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Up to 5 Multi-Branch Operating Units</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Real-Time Vehicle P&L Analytics</span>
                  </div>
                </div>
              </div>

              <Link
                to="/onboarding"
                className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
              >
                <span>Start Growth Trial</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Enterprise Dedicated */}
            <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-950 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Enterprise Dedicated</h3>
                <p className="text-xs text-zinc-400 mt-2">
                  For large-scale industrial fleets, national logistics networks, and mission-critical SLAs.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">Custom</span>
                  <span className="text-xs text-zinc-500">/ tailored</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Annual SLA contract</div>

                <div className="mt-8 space-y-3 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-white">Unlimited Vehicles & Fleets</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Private VPC / On-Premise Deployment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Custom ERP & SAP API Connectors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Custom Role Builder & Granular RBAC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Dedicated Technical Account Commander</span>
                  </div>
                </div>
              </div>

              <Link
                to="/onboarding"
                className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition"
              >
                <span>Contact Enterprise Team</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. FREQUENTLY ASKED QUESTIONS
      ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Common Inquiries
          </h2>
          <p className="mt-3 text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </p>
          <p className="mt-3 text-sm text-zinc-400">
            Clear answers on migration, data security, statutory compliance, and integration.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: 'Can we import our existing fleet, driver, and customer databases?',
              a: 'Yes. Zolexora TMS provides native CSV import templates and programmatic REST APIs for instant batch upload of vehicle profiles, driver KYC documents, customer contracts, and historical rate cards without downtime.',
            },
            {
              q: 'How does the Pre-Dispatch Compliance Lockout work?',
              a: 'The Sentinel engine continuously checks expiry timestamps for PUC, insurance, fitness certificates, road tax, and driver licenses. If an assigned asset has an expired or impending document, dispatchers are immediately blocked from finalizing the duty until renewed.',
            },
            {
              q: 'Does Zolexora TMS support GST e-invoicing and e-way bill generation?',
              a: 'Absolutely. Rate cards calculate GST slabs, reverse charge mechanisms (RCM), and fuel surcharges automatically. Export standardized e-invoice payloads or integrate directly with GST portal endpoints.',
            },
            {
              q: 'How is data strictly separated across different organisations?',
              a: 'Every database transaction enforces strict multi-tenant composite foreign keys anchored to the organisation identity. One organization can never view, mutate, or query another tenant\'s operational records.',
            },
            {
              q: 'Can we configure custom operating units and regional hubs?',
              a: 'Yes. Organizations can model multi-tier organizational hierarchies with regional depots, hubs, and operating units. Dispatchers and accounting staff can be restricted to specific units or granted multi-branch oversight.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between p-6 text-left text-sm font-bold text-white hover:text-emerald-300 transition"
              >
                <span>{item.q}</span>
                {openFaq === idx ? (
                  <ChevronDown className="h-5 w-5 text-emerald-400 shrink-0 transform rotate-180 transition-transform" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-zinc-500 shrink-0 transition-transform" />
                )}
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-6 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. BOTTOM CALL TO ACTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 border-t border-zinc-800 bg-gradient-to-b from-zinc-950 to-emerald-950/30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to Streamline Your Transport Operations?
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-base text-zinc-400">
            Join hundreds of forward-thinking freight operators and enterprise fleets. Set up your organisation workspace in under 3 minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/onboarding"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-base font-bold text-zinc-950 hover:bg-emerald-400 transition shadow-xl shadow-emerald-500/25"
            >
              <span>Get Started Now</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-4 text-base font-semibold text-zinc-200 hover:bg-zinc-800 transition"
            >
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          12. ENTERPRISE FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-16 text-zinc-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand Column */}
            <div className="col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Truck className="h-5 w-5" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">
                  Zolexora <span className="text-emerald-400">TMS</span>
                </span>
              </div>
              <p className="mt-3 text-xs text-zinc-500 max-w-sm leading-relaxed">
                Mission-critical enterprise transport and fleet management platform engineered for modern logistics operators.
              </p>
              <div className="mt-6 flex items-center gap-2 text-emerald-400 font-mono text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>Production API Status: Operational (Port 4030)</span>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Product</h4>
              <ul className="mt-4 space-y-2.5">
                <li><a href="#features" className="hover:text-emerald-400 transition">Fleet Management</a></li>
                <li><a href="#operations" className="hover:text-emerald-400 transition">Duty Dispatch</a></li>
                <li><a href="#financials" className="hover:text-emerald-400 transition">Dynamic Rate Cards</a></li>
                <li><a href="#financials" className="hover:text-emerald-400 transition">Driver Settlements</a></li>
                <li><a href="#architecture" className="hover:text-emerald-400 transition">Compliance Sentinel</a></li>
              </ul>
            </div>

            {/* Architecture & Resources */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Resources</h4>
              <ul className="mt-4 space-y-2.5">
                <li><a href="http://localhost:4030/docs" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition">OpenAPI Swagger UI</a></li>
                <li><a href="http://localhost:4030/redoc" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition">ReDoc Reference</a></li>
                <li><a href="#architecture" className="hover:text-emerald-400 transition">Security Invariants</a></li>
                <li><Link to="/onboarding" className="hover:text-emerald-400 transition">Tenant Onboarding</Link></li>
                <li><Link to="/login" className="hover:text-emerald-400 transition">Operator Login</Link></li>
              </ul>
            </div>

            {/* Legal & Security */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Enterprise</h4>
              <ul className="mt-4 space-y-2.5">
                <li><a href="#pricing" className="hover:text-emerald-400 transition">Pricing Plans</a></li>
                <li><a href="#faq" className="hover:text-emerald-400 transition">Knowledge Base</a></li>
                <li><span className="text-zinc-600">Privacy Policy</span></li>
                <li><span className="text-zinc-600">Terms of Service</span></li>
                <li><span className="text-zinc-600">Security Invariants</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
            <div>
              © 2026 Zolexora Platform Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Next.js 16 Ready</span>
              <span>•</span>
              <span>FastAPI Backend</span>
              <span>•</span>
              <span>Tailwind CSS v4</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
