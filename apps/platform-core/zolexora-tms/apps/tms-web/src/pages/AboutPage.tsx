import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const PRINCIPLES = [
  {
    num: '01',
    title: 'Operational truth over spreadsheet drift',
    body: 'Every trip, fuel chit, compliance document, and GST invoice traces back to a single immutable record shared safely between stakeholders.',
  },
  {
    num: '02',
    title: 'Two dedicated interfaces, zero clutter',
    body: 'Dispatchers should not fight client booking views, and clients should never wade through fleet maintenance screens. Each side gets a tailored portal.',
  },
  {
    num: '03',
    title: 'Compliance enforced before wheels roll',
    body: 'Software should stop preventable regulatory penalties before dispatch — not generate an audit report weeks later.',
  },
];

export function AboutPage() {
  return (
    <div>
      <section className="border-b border-[var(--border-subtle)] py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
            About Zolexora TMS
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] leading-[1.08]">
            Bringing engineering discipline to freight &amp; fleet logistics.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-[var(--text-secondary)]">
            Zolexora TMS is part of the Zolexora Platform ecosystem — designed to replace fragmented WhatsApp threads, disconnected billing sheets, and manual trip logs with deterministic, auditable transport software.
          </p>
        </div>
      </section>

      <section className="py-20 border-b border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 space-y-10">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Design principles
          </h2>
          <div className="space-y-6">
            {PRINCIPLES.map((p) => (
              <div
                key={p.num}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 flex flex-col sm:flex-row gap-5"
              >
                <span className="font-mono text-xs font-semibold text-[var(--accent)] pt-0.5 shrink-0">
                  {p.num}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 text-center">
        <div className="max-w-xl mx-auto px-6 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Want to see Zolexora TMS with your routes?
          </h2>
          <div className="flex justify-center gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-5 py-2.5 text-xs font-medium hover:opacity-90 transition"
            >
              Contact our team <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
