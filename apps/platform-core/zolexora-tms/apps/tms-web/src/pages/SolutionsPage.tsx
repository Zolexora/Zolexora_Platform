import { Link } from 'react-router-dom';
import { Layers, Shield, Snowflake, Factory, Package, Truck, ArrowRight } from 'lucide-react';

const VERTICALS = [
  {
    icon: Truck,
    title: 'Full Truckload (FTL) & 3PL',
    desc: 'Coordinate long-haul multi-axle routes, driver advances, and hub-to-hub turnarounds with zero billing leakage.',
  },
  {
    icon: Package,
    title: 'Part Truckload (LTL) & Distribution',
    desc: 'Consolidate shipments across branch operating units while preserving client-level visibility and GST statements.',
  },
  {
    icon: Snowflake,
    title: 'Cold Chain & Pharma Logistics',
    desc: 'Strict vehicle compliance lockouts and trip telemetry for high-sensitivity perishable cargo.',
  },
  {
    icon: Factory,
    title: 'Industrial & Manufacturing Inbound',
    desc: 'Empower plant logistics teams with a dedicated Client Portal to request transport and audit freight bills.',
  },
];

export function SolutionsPage() {
  return (
    <div>
      <section className="border-b border-[var(--border-subtle)] py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
            Solutions
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] max-w-3xl leading-[1.08]">
            Engineered for high-reliability transport verticals.
          </h1>
          <p className="mt-5 text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Strict tenant isolation, composite database keys, and role-based access control tailored for India&apos;s demanding logistics corridors.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--border-subtle)] py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {VERTICALS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 space-y-4"
            >
              <div className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] flex items-center justify-center text-[var(--accent)]">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture highlight */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
              Security &amp; Isolation
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              Enterprise-grade multi-tenant architecture
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Every API request binds directly to an authenticated organisation context and PostgreSQL Row-Level Security policies, guaranteeing strict separation between Service Providers, Clients, and competing tenants.
            </p>
            <div className="pt-2">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-5 py-2.5 text-xs font-medium hover:opacity-90 transition"
              >
                See Enterprise plans <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-3">
            {[
              { icon: Shield, label: 'PostgreSQL Row-Level Isolation', value: 'Active' },
              { icon: Layers, label: 'Composite Tenant Key Enforcement', value: '100% Schema Coverage' },
              { icon: Truck, label: 'Dual Portal Guard (/sp/* vs /client/*)', value: 'JWT + Role Verified' },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)]"
              >
                <span className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--text-primary)]">
                  <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {label}
                </span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
