import { cn } from '@/lib/cn'
import type { RequestStatus, ContractStatus } from '@/lib/types'

type BadgeColor = 'gray' | 'blue' | 'yellow' | 'purple' | 'green' | 'red' | 'emerald' | 'cyan'

const colorClasses: Record<BadgeColor, string> = {
  gray: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
  blue: 'bg-blue-950/60 text-blue-300 border border-blue-800/60',
  yellow: 'bg-amber-950/60 text-amber-300 border border-amber-800/60',
  purple: 'bg-purple-950/60 text-purple-300 border border-purple-800/60',
  green: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60',
  emerald: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60',
  cyan: 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60',
  red: 'bg-rose-950/60 text-rose-300 border border-rose-800/60',
}

export const requestStatusColor: Record<RequestStatus, BadgeColor> = {
  submitted: 'yellow',
  in_review: 'blue',
  contracted: 'purple',
  in_development: 'cyan',
  delivered: 'emerald',
}

export const contractStatusColor: Record<ContractStatus, BadgeColor> = {
  draft: 'gray',
  sent: 'yellow',
  signed: 'emerald',
  declined: 'red',
}

export function Badge({
  children,
  color = 'gray',
  className,
}: {
  children: React.ReactNode
  color?: BadgeColor
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide',
        colorClasses[color],
        className
      )}
    >
      {children}
    </span>
  )
}
