import Link from 'next/link'
import { Layers } from 'lucide-react'
import { LinkButton } from '@/components/ui/link-button'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface-dark)]/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg text-[var(--color-text-primary)]">
            Zolexora{' '}
            <span className="text-[var(--color-brand-primary)]">App Suite</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link
            href="/#how-it-works"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            How it Works
          </Link>
          <Link
            href="/#services"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Services
          </Link>
          <Link
            href="/dashboard/requests"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            My Requests
          </Link>
          <Link
            href="/dashboard/contracts"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Contracts
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LinkButton variant="ghost" size="sm" href="/dashboard">
            Sign In
          </LinkButton>
          <LinkButton size="sm" href="/dashboard/new-request">
            Get Started
          </LinkButton>
        </div>
      </div>
    </header>
  )
}
