import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Mail, Building2 } from 'lucide-react';

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [roleType, setRoleType] = useState<'SERVICE_PROVIDER' | 'CLIENT'>('SERVICE_PROVIDER');
  const [notes, setNotes] = useState('');

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
        <div className="space-y-6">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
            Contact &amp; Enterprise Sales
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] leading-[1.08]">
            Let&apos;s tailor Zolexora TMS to your network.
          </h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Whether you are evaluating Fleet Core (₹80k/mo), Logistics Scale (₹1.5L/mo), or Enterprise (₹2.5L/mo with 10% yearly savings), our deployment team can walk through a live Service Provider and Client setup.
          </p>

          <div className="pt-4 space-y-4 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent)]">
                <Mail className="h-3.5 w-3.5" />
              </div>
              <span>enterprise@zolexora.com</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--accent)]">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <span>Dual SP &amp; Client onboarding typically live within 48 hours</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8">
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto h-11 w-11 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Request received</h2>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                Thanks, {name}. You can also launch a workspace immediately from authentication while our team prepares your walkthrough.
              </p>
              <Link
                to="/authentication"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-5 py-2.5 text-xs font-medium hover:opacity-90 transition"
              >
                Open Workspace Setup <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Full name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Work email
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@company.com"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Organisation
                </label>
                <input
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Logistics Pvt Ltd"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Primary workspace
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      ['SERVICE_PROVIDER', 'Service Provider'],
                      ['CLIENT', 'Client'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRoleType(val)}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition ${
                        roleType === val
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Fleet size or requirements
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell us about your branches, fleet count, or ERP integration needs..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] py-3 text-sm font-medium hover:opacity-90 transition"
              >
                Request walkthrough <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
