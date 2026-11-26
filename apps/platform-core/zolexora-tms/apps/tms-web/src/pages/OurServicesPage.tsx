import { Link } from 'react-router-dom';
import {
  Truck,
  Building2,
  Compass,
  ShieldCheck,
  Receipt,
  CreditCard,
  Users,
  BarChart3,
  CalendarCheck,
  MapPin,
  FileText,
  ArrowRight,
} from 'lucide-react';

const SP_SERVICES = [
  {
    icon: Compass,
    title: 'Dispatch & Duty Orchestration',
    desc: 'Convert customer bookings into assigned duties in seconds with live vehicle and driver availability state.',
  },
  {
    icon: ShieldCheck,
    title: 'Pre-Dispatch Compliance Sentinel',
    desc: 'Automated lockouts prevent dispatching vehicles or drivers with expired licenses, PUC, permits, fitness, or insurance.',
  },
  {
    icon: Receipt,
    title: 'Dynamic Rate Cards & GST Billing',
    desc: 'Configure multi-slab distance pricing, detention charges, and batta to issue compliant GST invoices with one click.',
  },
  {
    icon: CreditCard,
    title: 'Driver Advances & Vendor Settlements',
    desc: 'Track trip cash advances, fuel chits, FASTag tolls, payables, and net balance payouts in a single audit trail.',
  },
  {
    icon: BarChart3,
    title: 'Financial Periods & P&L Reporting',
    desc: 'Track receivables ageing, close monthly financial periods cleanly, and inspect trip-level profitability.',
  },
  {
    icon: Users,
    title: 'Multi-Branch Operating Units & RBAC',
    desc: 'Separate branch managers, dispatchers, drivers, and accountants with scoped permissions and ZX-ORG staff login.',
  },
];

const CLIENT_SERVICES = [
  {
    icon: CalendarCheck,
    title: 'Structured Transport Requests',
    desc: 'Submit shipment requests with origin, destination, vehicle requirements, and load notes directly inside /client/bookings.',
  },
  {
    icon: MapPin,
    title: 'Live Trip Visibility',
    desc: 'Monitor active duty progression from bay loading to en-route transit and proof-of-delivery completion.',
  },
  {
    icon: FileText,
    title: 'Invoice & Payment Ledger',
    desc: 'Access itemized GST freight invoices, payment receipts, and monthly spend summaries without chasing spreadsheets.',
  },
  {
    icon: Users,
    title: 'Client Team Management',
    desc: 'Invite procurement, logistics, and finance stakeholders under your own Client organisation with ZX-ORG staff access.',
  },
];

export function OurServicesPage() {
  return (
    <div>
      {/* Header */}
      <section className="border-b border-[var(--border-subtle)] py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
            Our Services
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] max-w-3xl leading-[1.08]">
            Every operational service, engineered for both sides of freight.
          </h1>
          <p className="mt-5 text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Zolexora TMS delivers distinct modules for Service Providers operating fleets and Clients procuring transport.
          </p>
        </div>
      </section>

      {/* Service Provider Suite */}
      <section className="border-b border-[var(--border-subtle)] py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 mb-12">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] flex items-center justify-center">
                <Truck className="h-4 w-4 text-[var(--text-primary)]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  Service Provider Suite
                </h2>
                <p className="text-xs text-[var(--text-muted)]">Available inside /sp/* workspaces</p>
              </div>
            </div>
            <Link
              to="/authentication"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] border border-[var(--border-strong)] rounded-lg px-3.5 py-2 hover:bg-[var(--bg-surface)] transition"
            >
              Launch SP Workspace <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SP_SERVICES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 space-y-3"
              >
                <div className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] flex items-center justify-center text-[var(--accent)]">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client Portal Suite */}
      <section className="border-b border-[var(--border-subtle)] py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 mb-12">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] flex items-center justify-center">
                <Building2 className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  Client Portal Suite
                </h2>
                <p className="text-xs text-[var(--text-muted)]">Available inside /client/* workspaces</p>
              </div>
            </div>
            <Link
              to="/authentication"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] rounded-lg px-3.5 py-2 hover:opacity-90 transition"
            >
              Open Client Portal <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CLIENT_SERVICES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 space-y-3"
              >
                <div className="h-9 w-9 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
