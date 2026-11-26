import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Building2,
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Compass,
  Receipt,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { PricingGrid } from '../components/PricingGrid';

type WorkspaceTab = 'sp' | 'client';

const PREVIEW_DATA: Record<
  WorkspaceTab,
  {
    badge: string;
    route: string;
    headline: string;
    metrics: { label: string; value: string }[];
    rows: { id: string; primary: string; secondary: string; status: string }[];
    footerLeft: string;
    footerRight: string;
  }
> = {
  sp: {
    badge: 'Service Provider Workspace',
    route: '/sp/dashboard',
    headline: 'Live Dispatch & Fleet Ledger',
    metrics: [
      { label: 'Active Duties', value: '42' },
      { label: 'Compliance Lock', value: '100% Verified' },
      { label: 'Billed MTD', value: '₹48,25,000' },
    ],
    rows: [
      { id: 'DT-9102', primary: 'MH-04-GP-8842 · Delhi Hub → Mumbai Depot', secondary: 'Driver: R. Sharma · 32T Multi-Axle', status: 'In Transit · 82 km/h' },
      { id: 'DT-9103', primary: 'KA-01-AX-4029 · Bengaluru → Chennai Port', secondary: "Driver: A. D'Souza · 20ft Reefer", status: 'Loading at Bay 4' },
      { id: 'DT-9104', primary: 'GJ-05-TR-1190 · Hazira → Pune Chakan', secondary: 'Driver: M. Patel · Flatbed Trailer', status: 'POD Uploaded · Ready to Bill' },
    ],
    footerLeft: 'Statutory Lockout Enforced: Licenses, PUC, Insurance',
    footerRight: 'Auto-Settlements Synced',
  },
  client: {
    badge: 'Client Portal Workspace',
    route: '/client/dashboard',
    headline: 'Transport Requests & Invoices',
    metrics: [
      { label: 'Open Requests', value: '14' },
      { label: 'Trips In Transit', value: '9' },
      { label: 'Pending Invoices', value: '₹6,40,000' },
    ],
    rows: [
      { id: 'REQ-408', primary: 'Pune Plant → Bengaluru Warehouse', secondary: 'Assigned: KA-01-AX-4029 · ETA Today 18:40', status: 'Live Tracking' },
      { id: 'REQ-409', primary: 'Chennai CFS → Hyderabad ICD', secondary: 'Container 40ft HC · Confirmed Dispatch', status: 'Dispatched' },
      { id: 'INV-2091', primary: 'Monthly Freight Statement — October', secondary: 'GST Compliant · 18 Duties Included', status: 'Ready to Review' },
    ],
    footerLeft: 'Isolated Client View · Only your bookings & invoices',
    footerRight: 'Instant GST PDF Export',
  },
};

const FAQS = [
  {
    q: 'How does Zolexora TMS separate Service Providers and Clients?',
    a: 'Every organisation onboards as either a Service Provider (/sp/*) or a Client (/client/*). Both share the same reliable core data model while rendering clean, role-specific interfaces enforced by route guards and database tenant isolation.',
  },
  {
    q: 'How does the Pre-Dispatch Compliance Lockout work?',
    a: 'Before a duty is confirmed, the engine checks driver licenses, fitness certificates, PUC, permits, and insurance expiry dates. Expired statutory documents block dispatch automatically.',
  },
  {
    q: 'Are yearly discounts applied to all plans including Enterprise?',
    a: 'Yes. Choosing yearly billing saves 10% across Fleet Core (₹72,000/mo), Logistics Scale (₹1,35,000/mo), and Enterprise (₹2,25,000/mo instead of ₹2.5 L/mo).',
  },
  {
    q: 'How fast can our fleet and staff sign in?',
    a: 'Owners create an organisation in under three minutes, and staff members sign in immediately via their ZX-ORG workspace identifier and land directly inside their assigned portal.',
  },
];

export function LandingPage() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('sp');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const preview = PREVIEW_DATA[activeTab];

  return (
    <div>
      {/* ── EDITORIAL HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        {/* Precision grid backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[280px] rounded-full blur-[120px] opacity-40"
          style={{ background: 'var(--accent-soft)' }}
        />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-1 text-xs font-medium text-[var(--text-secondary)] mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span>Transport Operating System · v2.0 Dual Workspace</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-[68px] font-semibold tracking-[-0.035em] leading-[1.04] text-[var(--text-primary)] max-w-4xl mx-auto">
            Precision software for modern freight &amp; fleet logistics.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed font-normal">
            Purpose-built interfaces for Service Providers managing fleets and Clients booking transport — unified by automated dispatch, compliance lockouts, and deterministic billing.
          </p>

          {/* ── INTERACTIVE SP VS CLIENT SWITCHER ── */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="inline-flex items-center p-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('sp')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'sp'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Service Provider</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('client')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'client'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Client Portal</span>
              </button>
            </div>

            {/* Linear-style App Window */}
            <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden text-left">
              {/* Window chrome */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                </div>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  app.zolexora.com{preview.route}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                  {preview.badge}
                </span>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                      {preview.headline}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Real-time tenant state synchronized across operations and accounting.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 sm:gap-6">
                    {preview.metrics.map((m) => (
                      <div key={m.label} className="text-left sm:text-right">
                        <div className="text-[11px] text-[var(--text-muted)]">{m.label}</div>
                        <div className="text-sm font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data rows */}
                <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)]">
                  {preview.rows.map((row) => (
                    <div
                      key={row.id}
                      className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shrink-0">
                          {row.id}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {row.primary}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate">
                            {row.secondary}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                    {preview.footerLeft}
                  </span>
                  <span className="font-mono">{preview.footerRight}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE CAPABILITIES (EDITORIAL 3-COLUMN) ────────────────────── */}
      <section className="py-24 border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
                Architecture
              </p>
              <h2 className="mt-2.5 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                Built for speed from dispatch to settlement.
              </h2>
            </div>
            <Link
              to="/our-services"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              View all platform services <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
            {[
              {
                icon: Compass,
                title: 'Deterministic Dispatch',
                body: 'Assign bookings to verified vehicles and drivers in seconds, backed by automated pre-dispatch statutory compliance lockouts.',
              },
              {
                icon: Receipt,
                title: 'Zero-Friction Billing',
                body: 'Rate cards handle tiered km slabs, detention, driver batta, and FASTag tolls — generating audit-ready GST invoices automatically.',
              },
              {
                icon: MapPin,
                title: 'Dedicated Client Portals',
                body: 'Clients onboard cleanly into /client/* to place transport requests, track active trips, and download invoices without clutter.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-[var(--bg-page)] p-8 sm:p-10 space-y-4">
                <div className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent)]">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
              Pricing
            </p>
            <h2 className="mt-2.5 text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
              Predictable enterprise licensing
            </h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Flat monthly workspace plans with 10% savings on annual billing across every tier.
            </p>
          </div>

          <PricingGrid />

          <div className="mt-8 text-center">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Compare full plan specifications <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="py-24 border-b border-[var(--border-subtle)]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">FAQ</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Common questions
            </h2>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {FAQS.map((item, idx) => (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full py-5 flex items-center justify-between text-left text-sm font-medium text-[var(--text-primary)]"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--text-muted)] shrink-0 ml-4 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-[var(--text-primary)]' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <p className="pb-5 text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-4 text-xs text-[var(--text-secondary)] mb-6">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[var(--accent)]" /> 3-minute onboarding
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" /> Strict tenant isolation
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            Ready to run logistics with zero friction?
          </h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
            Launch your Service Provider command center or Client booking portal today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/authentication"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-6 py-3 text-sm font-medium hover:opacity-90 transition"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
            >
              Schedule a demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
