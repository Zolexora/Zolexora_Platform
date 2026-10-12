import { cn } from '@/lib/cn'

export function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 shadow-sm',
        className
      )}
    >
      {children}
    </div>
  )
}
