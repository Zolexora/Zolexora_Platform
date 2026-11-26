import { PricingGrid } from '../components/PricingGrid';

const COMPARISON = [
  { feature: 'Active fleet capacity', core: 'Up to 50 vehicles', scale: 'Up to 200 vehicles', ent: 'Unlimited' },
  { feature: 'Service Provider Workspace (/sp/*)', core: 'Included', scale: 'Included', ent: 'Included' },
  { feature: 'Client Portal Workspaces (/client/*)', core: '—', scale: 'Unlimited clients', ent: 'Unlimited + White-label' },
  { feature: 'Pre-Dispatch Compliance Lockout', core: 'Included', scale: 'Included', ent: 'Custom rules' },
  { feature: 'Rate Cards & Automated GST Invoicing', core: 'Standard', scale: 'Dynamic + Slabs', ent: 'Custom ERP Sync' },
  { feature: 'Driver Settlements & FASTag Tolls', core: '—', scale: 'Included', ent: 'Included' },
  { feature: 'Yearly Billing Discount', core: '10% off (₹72k/mo)', scale: '10% off (₹1.35L/mo)', ent: '10% off (₹2.25L/mo)' },
];

export function PricingPage() {
  return (
    <div>
      <section className="border-b border-[var(--border-subtle)] py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
              Pricing &amp; Plans
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Transparent licensing built to scale with your fleet.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)]">
              Choose monthly flexibility or save 10% across every plan — including Enterprise (₹2.25 L/mo) — with yearly billing.
            </p>
          </div>

          <PricingGrid />
        </div>
      </section>

      {/* Comparison Matrix */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] mb-8">
            Plan comparison
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th className="py-3.5 px-5 font-medium">Capability</th>
                  <th className="py-3.5 px-5 font-medium">Fleet Core (₹80k)</th>
                  <th className="py-3.5 px-5 font-medium">Logistics Scale (₹1.5L)</th>
                  <th className="py-3.5 px-5 font-medium">Enterprise (₹2.5L)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="bg-[var(--bg-page)]">
                    <td className="py-3.5 px-5 font-medium text-[var(--text-primary)]">{row.feature}</td>
                    <td className="py-3.5 px-5 text-[var(--text-secondary)]">{row.core}</td>
                    <td className="py-3.5 px-5 text-[var(--text-secondary)]">{row.scale}</td>
                    <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">{row.ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
