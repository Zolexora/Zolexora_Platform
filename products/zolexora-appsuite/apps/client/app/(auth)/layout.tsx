import Link from 'next/link'
import Image from 'next/image'

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
      <Link href="/" className="flex items-center gap-3 mb-10 relative group">
        <Image
          src="/logo.png"
          alt="Zolexora App Suite Logo"
          width={38}
          height={38}
          className="w-9 h-9 rounded-xl object-contain shadow-lg shadow-brand-primary/20 transition-transform group-hover:scale-105"
          priority
        />
        <span className="font-semibold text-xl text-[var(--color-text-primary)]">
          Zolexora <span className="text-[var(--color-brand-primary)]">App Suite</span>
        </span>
      </Link>

      <div className="relative w-full flex justify-center">
        {children}
      </div>
    </div>
  )
}
