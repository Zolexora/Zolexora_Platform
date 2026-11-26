import { useState, useEffect } from 'react';
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
  MapPin,
  Sun,
  Moon,
  Building2,
  CalendarCheck,
  FileText,
  Users,
} from 'lucide-react';

type Theme = 'dark' | 'lime';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('tms-theme') as Theme) ?? 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'lime' ? 'lime' : '');
    localStorage.setItem('tms-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'lime' : 'dark');
  return { theme, toggle };
}

// ── Shared style helpers (theme-token-based) ────────────────────────────────
const nav = 'sticky top-0 z-50 backdrop-blur-xl border-b transition-colors';
const sectionMax = 'max-w-6xl mx-auto px-6 lg:px-10';

export function LandingPage() {
  const { theme, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const dark = theme === 'dark';

  // Computed class helpers
  const page   = dark ? 'bg-[#080C14] text-slate-100' : 'bg-[#F7FEE7] text-[#1a2e05]';
  const surface = dark ? 'bg-[#111620] border-[#222B3A]' : 'bg-white border-[#BEF264]';
  const elevated = dark ? 'bg-[#0A0A0A] border-[#222B3A]' : 'bg-[#ECFCCB] border-[#BEF264]';
  const textSec  = dark ? 'text-slate-400' : 'text-[#3f6212]';
  const textMuted = dark ? 'text-slate-500' : 'text-[#65a30d]';
  const borderSoft = dark ? 'border-[#222B3A]' : 'border-[#BEF264]';
  const borderMid  = dark ? 'border-[#38455A]' : 'border-[#84CC16]';
  const accent    = dark ? 'bg-slate-200 text-[#080C14] hover:bg-white' : 'bg-[#4D7C0F] text-[#F7FEE7] hover:bg-[#3f6212]';
  const accentOut = dark ? 'border-[#38455A] text-slate-300 hover:border-slate-500 hover:text-white' : 'border-[#84CC16] text-[#3f6212] hover:border-[#65a30d]';
  const limeAccent = dark ? 'text-[#A3E635]' : 'text-[#65A30D]';
  const limeBg    = dark ? 'bg-[#1a2e05]/60 border-[#4d7c0f]/50' : 'bg-[#ECFCCB] border-[#84CC16]';

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${page}`}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <header className={`${nav} ${dark ? 'bg-[#080C14]/80 border-[#222B3A]' : 'bg-[#F7FEE7]/90 border-[#BEF264]'}`}>
        <div className={`${sectionMax} flex items-center justify-between h-18 py-4`}>
          <Link to="/" className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${dark ? 'bg-[#111620] border-[#38455A] text-slate-300' : 'bg-[#ECFCCB] border-[#84CC16] text-[#4D7C0F]'}`}>
              <Truck className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight">Zolexora</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${dark ? 'bg-[#111620] border-[#38455A] text-slate-400' : 'bg-[#ECFCCB] border-[#84CC16] text-[#4D7C0F]'}`}>TMS</span>
            </div>
          </Link>

          <nav className={`hidden md:flex items-center gap-7 text-sm font-medium ${textSec}`}>
            {['#overview','#features','#solutions','#pricing','#faq'].map((href, i) => (
              <a key={href} href={href} className={`hover:${dark ? 'text-white' : 'text-[#1a2e05]'} transition`}>
                {['Overview','Features','Solutions','Pricing','FAQ'][i]}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={dark ? 'Switch to Lime mode' : 'Switch to Dark mode'}
              className={`rounded-xl border p-2 transition ${dark ? 'border-[#38455A] bg-[#111620] text-[#A3E635] hover:border-[#A3E635]' : 'border-[#84CC16] bg-[#ECFCCB] text-[#4D7C0F] hover:border-[#4D7C0F]'}`}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <Link to="/authentication" className={`hidden sm:inline-flex text-sm font-medium px-3 py-2 transition rounded-lg ${textSec} ${dark ? 'hover:text-white' : 'hover:text-[#1a2e05]'}`}>
              Sign In
            </Link>
            <Link to="/authentication" className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm ${accent}`}>
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {/* Mobile menu */}
            <button className={`md:hidden p-2 rounded-lg ${textSec}`} onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className={`md:hidden border-t px-6 py-5 space-y-4 ${dark ? 'border-[#222B3A] bg-[#080C14]' : 'border-[#BEF264] bg-[#F7FEE7]'}`}>
            <nav className={`flex flex-col gap-3 text-sm font-medium ${textSec}`}>
              {['#overview','#features','#solutions','#pricing','#faq'].map((href, i) => (
                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                  {['Overview','Features','Solutions','Pricing','FAQ'][i]}
                </a>
              ))}
            </nav>
            <div className={`pt-4 border-t flex flex-col gap-2 ${borderSoft}`}>
              <Link to="/authentication" onClick={() => setMobileMenuOpen(false)} className={`text-center py-2.5 rounded-xl border text-sm font-medium ${accentOut}`}>Sign In</Link>
              <Link to="/authentication" onClick={() => setMobileMenuOpen(false)} className={`text-center py-2.5 rounded-xl text-sm font-semibold ${accent}`}>Get Started</Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section id="overview" className="relative pt-20 pb-24 md:pt-32 md:pb-36 overflow-hidden">
          {/* Ambient glow */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] blur-[160px] rounded-full pointer-events-none -z-10 ${dark ? 'bg-[#A3E635]/5' : 'bg-[#A3E635]/20'}`} />

          <div className="max-w-5xl mx-auto px-6 text-center">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold mb-8 backdrop-blur ${limeBg} ${limeAccent}`}>
              <Sparkles className="h-3 w-3" />
              Next-Gen Transport Management Platform
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] max-w-4xl mx-auto">
              One platform.{' '}
              <span className={`${limeAccent}`}>Two workspaces.</span>
            </h1>
            <p className={`mt-6 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${textSec}`}>
              Whether you run a fleet or book transport — Zolexora TMS gives every side of the transaction a dedicated, purpose-built workspace.
            </p>

            {/* ── DUAL CTA CARDS ── */}
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto text-left">

              {/* Service Provider Card */}
              <div className={`relative rounded-2xl border-2 p-7 flex flex-col gap-5 transition group ${dark ? 'border-[#38455A] bg-[#0A0A0A] hover:border-slate-500' : 'border-[#84CC16] bg-white hover:border-[#4D7C0F]'}`}>
                <div>
                  <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold mb-4 ${dark ? 'border-[#38455A] bg-[#111620] text-slate-300' : 'border-[#84CC16] bg-[#ECFCCB] text-[#4D7C0F]'}`}>
                    <Truck className="h-3.5 w-3.5" />
                    Service Provider
                  </div>
                  <h2 className="text-xl font-bold">Run your fleet operation</h2>
                  <p className={`mt-2 text-sm leading-relaxed ${textSec}`}>
                    Dispatch drivers, track duties in real-time, manage compliance documents, generate GST invoices and settle vendor payments.
                  </p>
                </div>
                <ul className={`space-y-1.5 text-xs ${textSec}`}>
                  {['Fleet & driver management','Duty dispatch & tracking','Dynamic rate cards + GST invoicing','Vendor payments & settlements','Compliance lockout'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${limeAccent}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/authentication" className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${accent}`}>
                  Open as Service Provider <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Client Card */}
              <div className={`relative rounded-2xl border-2 p-7 flex flex-col gap-5 transition group ${dark ? 'border-[#4d7c0f]/60 bg-[#1a2e05]/30 hover:border-[#A3E635]/60' : 'border-[#A3E635] bg-[#F7FEE7] hover:border-[#65A30D]'}`}>
                <div className={`absolute top-5 right-5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${limeBg} ${limeAccent}`}>
                  New
                </div>
                <div>
                  <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold mb-4 ${limeBg} ${limeAccent}`}>
                    <Building2 className="h-3.5 w-3.5" />
                    Client
                  </div>
                  <h2 className="text-xl font-bold">Book & track your transport</h2>
                  <p className={`mt-2 text-sm leading-relaxed ${textSec}`}>
                    Request trips, track vehicles in transit, review invoices, and manage your team — all from a clean client-only workspace.
                  </p>
                </div>
                <ul className={`space-y-1.5 text-xs ${textSec}`}>
                  {['Book transport requests','Live trip tracking','Invoice & payment history','Team & access management','No fleet admin complexity'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${limeAccent}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/authentication" className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-bold transition ${dark ? 'border-[#A3E635]/60 text-[#A3E635] hover:bg-[#A3E635]/10' : 'border-[#65A30D] text-[#4D7C0F] hover:bg-[#ECFCCB]'}`}>
                  Open as Client <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Trust note */}
            <p className={`mt-8 text-xs ${textMuted}`}>14-day free trial · No credit card · Instant setup · Your data stays yours</p>
          </div>
        </section>

        {/* ── VERTICALS STRIP ────────────────────────────────────────────── */}
        <section className={`py-10 border-y ${borderSoft} ${dark ? 'bg-[#0A0A0A]/60' : 'bg-[#ECFCCB]/60'}`}>
          <div className={`${sectionMax}`}>
            <p className={`text-center text-[11px] font-semibold uppercase tracking-widest mb-5 ${textMuted}`}>Built for high-reliability transport verticals</p>
            <div className={`flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-sm font-medium ${textSec}`}>
              {['Commercial FTL','Part Truckload (LTL)','Cold Chain Logistics','Industrial Haulage','Intra-City Delivery'].map(v => (
                <span key={v}>{v}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ───────────────────────────────────────────────────── */}
        <section id="features" className="py-28">
          <div className={`${sectionMax}`}>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${limeAccent}`}>Platform Features</span>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Everything your operation needs</h2>
              <p className={`mt-3 text-sm leading-relaxed ${textSec}`}>One unified platform for the SP and the Client — no data silos, no double-entry.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Compass, title: 'Intelligent Dispatch', body: 'Assign bookings in seconds. Auto-matches vehicle capacity, driver availability, and route constraints.' },
                { icon: DollarSign, title: 'Dynamic Rate Cards', body: 'Tiered KM slabs, waiting fees, batta. Instant fully-compliant GST freight invoices.' },
                { icon: ShieldCheck, title: 'Compliance Sentinel', body: 'Pre-dispatch lockout blocks expired licenses, PUC, fitness, and insurance automatically.' },
                { icon: MapPin, title: 'Live Trip Tracking', body: 'Clients see duty status in real time. Transparent end-to-end trip visibility.' },
                { icon: FileText, title: 'Automated Billing', body: 'From booking to invoice in one flow. Zero manual reconciliation across receivables and payables.' },
                { icon: Users, title: 'Role-Based Access', body: 'Fine-grained RBAC for dispatchers, accountants, drivers, and branch managers.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className={`rounded-2xl border p-7 transition hover:scale-[1.01] ${surface}`}>
                  <div className={`h-10 w-10 rounded-xl border flex items-center justify-center mb-5 ${limeBg} ${limeAccent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${textSec}`}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS (SP + Client side-by-side) ────────────────────── */}
        <section id="solutions" className={`py-24 border-t ${borderSoft} ${dark ? 'bg-[#0A0A0A]/30' : 'bg-[#ECFCCB]/40'}`}>
          <div className={`${sectionMax}`}>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${limeAccent}`}>How It Works</span>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Two sides of every trip</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* SP Side */}
              <div className={`rounded-2xl border p-7 space-y-5 ${surface}`}>
                <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl border ${dark ? 'border-[#38455A] bg-[#111620] text-slate-300' : 'border-[#84CC16] bg-[#ECFCCB] text-[#4D7C0F]'}`}>
                  <Truck className="h-3.5 w-3.5" />Service Provider
                </div>
                <div className="space-y-3">
                  {[
                    ['1', 'Create a booking', 'Set route, vehicle type, and rate card'],
                    ['2', 'Dispatch the duty', 'System assigns driver, checks compliance'],
                    ['3', 'Track in real time', 'Monitor duty status, location updates'],
                    ['4', 'Auto-bill on completion', 'GST invoice generated and sent to client'],
                  ].map(([n, t, d]) => (
                    <div key={n} className={`flex gap-4 p-4 rounded-xl border ${elevated}`}>
                      <span className={`text-lg font-black ${limeAccent}`}>{n}</span>
                      <div>
                        <p className="text-sm font-semibold">{t}</p>
                        <p className={`text-xs mt-0.5 ${textMuted}`}>{d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Client Side */}
              <div className={`rounded-2xl border-2 p-7 space-y-5 ${dark ? 'border-[#4d7c0f]/50 bg-[#1a2e05]/20' : 'border-[#A3E635] bg-[#F7FEE7]'}`}>
                <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl border ${limeBg} ${limeAccent}`}>
                  <Building2 className="h-3.5 w-3.5" />Client
                </div>
                <div className="space-y-3">
                  {[
                    ['1', 'Request transport', 'Submit booking with origin, destination, and load'],
                    ['2', 'Get confirmation', 'Assigned driver and vehicle details shared instantly'],
                    ['3', 'Track your trip', 'Live duty status visible in Client Portal'],
                    ['4', 'Review & pay', 'Download invoice, approve payment in one click'],
                  ].map(([n, t, d]) => (
                    <div key={n} className={`flex gap-4 p-4 rounded-xl border ${elevated}`}>
                      <span className={`text-lg font-black ${limeAccent}`}>{n}</span>
                      <div>
                        <p className="text-sm font-semibold">{t}</p>
                        <p className={`text-xs mt-0.5 ${textMuted}`}>{d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ────────────────────────────────────────────────────── */}
        <section id="pricing" className="py-28">
          <div className={`${sectionMax}`}>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${limeAccent}`}>Pricing</span>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Simple pricing for growing fleets</h2>
              <p className={`mt-3 text-sm ${textSec}`}>No per-duty commissions. Flat subscription, cancel anytime.</p>

              <div className={`mt-8 inline-flex items-center p-1 rounded-xl border text-xs font-medium ${dark ? 'border-[#222B3A] bg-[#0A0A0A]' : 'border-[#BEF264] bg-[#ECFCCB]'}`}>
                {(['monthly','annual'] as const).map(p => (
                  <button key={p} onClick={() => setBillingPeriod(p)}
                    className={`px-5 py-2 rounded-lg transition font-semibold capitalize ${billingPeriod === p ? (dark ? 'bg-[#A3E635] text-[#1a2e05]' : 'bg-[#4D7C0F] text-white') : textMuted}`}>
                    {p === 'annual' ? 'Annual (Save 20%)' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
              {[
                { name: 'Starter', desc: 'Independent fleets & hauliers', price: billingPeriod === 'annual' ? '₹4,999' : '₹5,999', features: ['Up to 15 vehicles','Core duty dispatch','Driver KYC management','Standard GST invoices'], popular: false },
                { name: 'Growth 3PL', desc: 'Expanding logistics operators', price: billingPeriod === 'annual' ? '₹14,999' : '₹18,499', features: ['Up to 75 vehicles','Dynamic rate cards','Compliance lockout','FASTag & settlements','Multi-branch units'], popular: true },
                { name: 'Enterprise', desc: 'National freight networks', price: 'Custom', features: ['Unlimited vehicles','Private VPC / On-Prem','Custom ERP connectors','Dedicated SLA support'], popular: false },
              ].map(plan => (
                <div key={plan.name} className={`rounded-2xl border-2 p-8 flex flex-col ${plan.popular
                  ? (dark ? 'border-[#A3E635] bg-[#1a2e05]/30 shadow-xl shadow-[#A3E635]/10' : 'border-[#4D7C0F] bg-[#ECFCCB] shadow-xl shadow-[#4D7C0F]/10')
                  : `${borderMid} ${dark ? 'bg-[#0A0A0A]' : 'bg-white'}`}`}>
                  {plan.popular && (
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${limeAccent}`}>Most Popular</div>
                  )}
                  <h3 className="text-base font-black">{plan.name}</h3>
                  <p className={`text-xs mt-1 ${textMuted}`}>{plan.desc}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-3xl font-black font-mono">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className={`text-xs ${textMuted}`}>/mo</span>}
                  </div>
                  <ul className={`mt-6 space-y-2.5 text-xs flex-1 ${textSec}`}>
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${limeAccent}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/authentication"
                    className={`mt-8 block text-center py-3 rounded-xl text-sm font-bold transition ${plan.popular ? accent : `border ${accentOut}`}`}>
                    {plan.price === 'Custom' ? 'Contact Sales' : `Choose ${plan.name.split(' ')[0]}`}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section id="faq" className={`py-24 border-t ${borderSoft}`}>
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${limeAccent}`}>FAQ</span>
              <h2 className="mt-3 text-2xl font-black tracking-tight">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {[
                { q: 'How fast can we onboard our existing fleet and drivers?', a: 'Import via CSV in minutes or use the REST API. Document validity is verified immediately on upload.' },
                { q: 'How does the Pre-Dispatch Compliance Lockout work?', a: 'The system validates licenses, PUC, road permits, and fitness certificates before every duty. Expired docs block assignment automatically.' },
                { q: 'Can a Service Provider and their Client both use Zolexora TMS?', a: 'Yes — this is exactly the design. The SP runs operations in /sp/* and each Client gets a clean /client/* portal showing only their bookings, trips, and invoices.' },
                { q: 'Is our data strictly isolated from other tenants?', a: 'Every query enforces composite tenant keys and JWT claims. Data between organisations is strictly compartmentalized at the database level.' },
                { q: 'Can we create custom roles for dispatchers and billing managers?', a: 'Yes. Fine-grained RBAC lets you assign specific permissions without exposing full admin controls.' },
              ].map((faq, idx) => (
                <div key={idx} className={`rounded-xl border overflow-hidden ${surface}`}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left text-sm font-semibold">
                    <span>{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 ${textMuted} transition-transform shrink-0 ml-3 ${openFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === idx && (
                    <div className={`px-5 pb-5 text-xs leading-relaxed border-t pt-3 ${borderSoft} ${textSec}`}>{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
        <section className={`py-24 border-t ${borderSoft}`}>
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold mb-6 ${limeBg} ${limeAccent}`}>
              <CalendarCheck className="h-3.5 w-3.5" />
              14-day free trial — no credit card
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Modernize your transport operations today.
            </h2>
            <p className={`mt-4 text-sm max-w-xl mx-auto ${textSec}`}>
              Whether you're a fleet operator or a client booking transport — your purpose-built workspace is ready in under 3 minutes.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/authentication" className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition shadow-lg ${accent}`}>
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/authentication" className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-3.5 text-sm font-medium transition ${accentOut}`}>
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className={`border-t py-12 text-xs ${borderSoft} ${textMuted}`}>
        <div className={`${sectionMax} flex flex-col sm:flex-row items-center justify-between gap-6`}>
          <div className="flex items-center gap-2">
            <Truck className={`h-4 w-4 ${limeAccent}`} />
            <span className="font-bold text-sm">Zolexora TMS</span>
            <span className={`${textMuted}`}>· Enterprise Transport Management</span>
          </div>
          <div className={`flex items-center gap-6 ${textSec}`}>
            <Link to="/authentication" className="hover:underline">Sign In</Link>
            <Link to="/authentication" className="hover:underline">Get Started</Link>
          </div>
          <div>© 2026 Zolexora Platform Inc.</div>
        </div>
      </footer>
    </div>
  );
}
