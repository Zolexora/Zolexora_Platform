import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

interface Plan {
  name: string;
  tagline: string;
  monthlyPrice: string;
  yearlyMonthlyPrice: string;
  yearlyTotalNote: string;
  badge?: string;
  highlighted?: boolean;
  ctaLabel: string;
  ctaLink: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: 'Fleet Core',
    tagline: 'For established regional transporters automating dispatch, compliance, and GST billing.',
    monthlyPrice: '₹80,000',
    yearlyMonthlyPrice: '₹72,000',
    yearlyTotalNote: '₹8,64,000 billed annually (save ₹96,000/yr)',
    ctaLabel: 'Start with Fleet Core',
    ctaLink: '/authentication',
    features: [
      'Up to 50 active vehicles & drivers',
      'Core booking & duty dispatch board',
      'Pre-dispatch document compliance lockout',
      'Standard customer rate cards & GST invoices',
      'Dedicated Service Provider workspace',
    ],
  },
  {
    name: 'Logistics Scale',
    tagline: 'For multi-branch 3PLs running dedicated Client Portals, vendor settlements, and dynamic billing.',
    monthlyPrice: '₹1,50,000',
    yearlyMonthlyPrice: '₹1,35,000',
    yearlyTotalNote: '₹16,20,000 billed annually (save ₹1,80,000/yr)',
    badge: 'Recommended',
    highlighted: true,
    ctaLabel: 'Start with Logistics Scale',
    ctaLink: '/authentication',
    features: [
      'Up to 200 active vehicles & unlimited clients',
      'Branded Client Portal workspaces (/client/*)',
      'Tiered rate cards, batta, waiting & FASTag tolls',
      'Driver advances & vendor settlement ledger',
      'Multi-branch operating units & custom RBAC',
    ],
  },
  {
    name: 'Enterprise',
    tagline: 'For national freight networks requiring full-scale orchestration, custom integrations, and priority SLA.',
    monthlyPrice: '₹2.5 L',
    yearlyMonthlyPrice: '₹2.25 L',
    yearlyTotalNote: '₹27,00,000 billed annually — 10% yearly discount (₹2,25,000/mo)',
    badge: '10% off yearly',
    ctaLabel: 'Talk to Enterprise Sales',
    ctaLink: '/contact',
    features: [
      'Unlimited vehicles, branches, and tenant workspaces',
      'Full dual Service Provider + Client Portal architecture',
      'Automated P&L, financial periods & receivables ageing',
      'Custom ERP / accounting webhooks & API access',
      'Dedicated solutions engineer & 99.95% SLA',
    ],
  },
];

/** Shared pricing grid used on both the Home preview and dedicated /pricing page. */
export function PricingGrid() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <div>
      {/* Billing period switch */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center p-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
              billing === 'monthly'
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Monthly billing
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
              billing === 'yearly'
                ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Yearly billing</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                billing === 'yearly'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'bg-[var(--accent-soft)] text-[var(--accent)]'
              }`}
            >
              Save 10%
            </span>
          </button>
        </div>
      </div>

      {/* Three tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-8 flex flex-col transition border ${
              plan.highlighted
                ? 'border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl ring-1 ring-[var(--border-subtle)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-page)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 min-h-[24px]">
              <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                {plan.name}
              </h3>
              {plan.badge && (
                <span className="inline-flex items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                  {plan.badge}
                </span>
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)] min-h-[36px]">
              {plan.tagline}
            </p>

            <div className="mt-7 pb-7 border-b border-[var(--border-subtle)]">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
                  {billing === 'yearly' ? plan.yearlyMonthlyPrice : plan.monthlyPrice}
                </span>
                <span className="text-xs text-[var(--text-muted)]">/ month</span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                {billing === 'yearly'
                  ? plan.yearlyTotalNote
                  : 'Billed monthly · Switch to yearly for 10% off'}
              </p>
            </div>

            <ul className="mt-7 space-y-3 text-xs text-[var(--text-secondary)] flex-1">
              {plan.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <Link
              to={plan.ctaLink}
              className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-semibold transition ${
                plan.highlighted
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:opacity-90'
                  : 'border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <span>{plan.ctaLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
