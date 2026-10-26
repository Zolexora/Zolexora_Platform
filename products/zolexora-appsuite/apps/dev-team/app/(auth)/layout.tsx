import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-surface-dark)]">
      <div className="flex items-center gap-3.5 mb-8">
        <Image
          src="/logo.png"
          alt="Zolexora App Suite"
          width={40}
          height={40}
          className="w-10 h-10 rounded-xl object-contain shadow-md"
          priority
        />
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
