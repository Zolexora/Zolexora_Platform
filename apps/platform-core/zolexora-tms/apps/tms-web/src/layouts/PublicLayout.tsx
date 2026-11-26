import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Truck, ArrowRight, Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Our Services', to: '/our-services' },
  { label: 'Solutions', to: '/solutions' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

/**
 * Shared editorial navigation & footer shell for all public Zolexora TMS pages.
 * Uses CSS variables from index.css so Dark and Light themes stay consistent across routes.
 */
export function PublicLayout() {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)] font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg-glass)] border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition group-hover:border-[var(--accent)]">
              <Truck className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Zolexora</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
              TMS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `transition ${
                    isActive
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle color theme"
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            <Link
              to="/authentication"
              className="hidden sm:inline-flex px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Sign in
            </Link>

            <Link
              to="/authentication"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:opacity-90 transition"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-page)] px-6 py-5 space-y-4">
            <nav className="flex flex-col gap-3 text-sm font-medium">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-2">
              <Link
                to="/authentication"
                className="text-center py-2.5 rounded-lg border border-[var(--border-strong)] text-sm font-medium"
              >
                Sign in
              </Link>
              <Link
                to="/authentication"
                className="text-center py-2.5 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-sm font-medium"
              >
                Get started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-page)]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-[var(--border-subtle)]">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)]">
                  <Truck className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold tracking-tight">Zolexora TMS</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)] max-w-xs">
                Transport management architecture uniting fleet operators and enterprise clients on a single deterministic ledger.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-3">Platform</h4>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                <li><Link to="/our-services" className="hover:text-[var(--text-primary)] transition">Our Services</Link></li>
                <li><Link to="/solutions" className="hover:text-[var(--text-primary)] transition">Solutions</Link></li>
                <li><Link to="/pricing" className="hover:text-[var(--text-primary)] transition">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-3">Company</h4>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                <li><Link to="/about" className="hover:text-[var(--text-primary)] transition">About</Link></li>
                <li><Link to="/contact" className="hover:text-[var(--text-primary)] transition">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-3">Access</h4>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                <li><Link to="/authentication" className="hover:text-[var(--text-primary)] transition">Service Provider Portal</Link></li>
                <li><Link to="/authentication" className="hover:text-[var(--text-primary)] transition">Client Portal</Link></li>
                <li><Link to="/authentication" className="hover:text-[var(--text-primary)] transition">Staff ZX-ORG Sign In</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
            <span>© 2026 Zolexora Platform Inc. All rights reserved.</span>
            <span>Built for Indian commercial freight & enterprise transport.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
