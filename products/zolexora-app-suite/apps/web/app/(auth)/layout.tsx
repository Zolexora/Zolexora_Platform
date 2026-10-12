import Link from 'next/link'
import { Layers } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-lg text-[var(--color-text-primary)]">
          Zolexora{' '}
          <span className="text-[var(--color-brand-primary)]">App Suite</span>
        </span>
      </Link>
      {children}
    </div>
  )
}
