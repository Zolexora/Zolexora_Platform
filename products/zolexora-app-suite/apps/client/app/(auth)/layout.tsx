import Link from 'next/link'
import { Layers } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-surface-dark)]">
      {/* Background orb */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(ellipse at center, oklch(0.62 0.25 280), transparent 70%)' }}
        />
      </div>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-10 relative">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-lg text-[var(--color-text-primary)]">
          Zolexora <span className="text-[var(--color-brand-primary)]">App Suite</span>
        </span>
      </Link>

      <div className="relative w-full flex justify-center">
        {children}
      </div>
    </div>
  )
}
