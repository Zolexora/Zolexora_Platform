import Link from 'next/link'
import { Layers } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-dark)]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-[var(--color-text-primary)]">
                Zolexora App Suite
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
              Custom software development, on demand. Powered by the Zolexora
              engineering team.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-8 text-sm">
            <div className="flex flex-col gap-2">
              <p className="font-medium text-[var(--color-text-primary)] mb-1">
                Platform
              </p>
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
                href="/dashboard/new-request"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Get Started
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium text-[var(--color-text-primary)] mb-1">
                Workspace
              </p>
              <Link
                href="/dashboard"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Overview
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
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-text-muted)]">
          <p>&copy; {new Date().getFullYear()} Zolexora. All rights reserved.</p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
