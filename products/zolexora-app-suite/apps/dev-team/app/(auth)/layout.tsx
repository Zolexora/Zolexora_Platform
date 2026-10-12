import { Terminal } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-surface-dark)]">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-primary)]/20 border border-[var(--color-brand-primary)]/40 flex items-center justify-center">
          <Terminal className="w-5 h-5 text-[var(--color-brand-primary)]" />
        </div>
        <div>
          <span className="font-bold text-lg text-[var(--color-text-primary)] tracking-wide">
            DevTeam <span className="text-[var(--color-brand-primary)]">Console</span>
          </span>
          <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">
            Zolexora App Suite
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
