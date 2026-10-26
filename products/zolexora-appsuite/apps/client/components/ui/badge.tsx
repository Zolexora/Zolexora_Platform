import { cn } from '@/lib/cn'
import type { RequestStatus, ContractStatus } from '@/lib/types'

export type BadgeColor =
  | 'gray'
  | 'navy'
  | 'silver'
  | 'white'
  | 'dark'
  | 'muted'
  | 'blue'
  | 'yellow'
  | 'purple'
  | 'green'
  | 'red'

const colorClasses: Record<BadgeColor, string> = {
  gray: 'bg-[#404040]/50 text-[#CBD5E1] border border-[#404040]',
  navy: 'bg-[#0B1F3A] text-white border border-[#CBD5E1]/30',
  silver: 'bg-[#CBD5E1]/15 text-white border border-[#CBD5E1]/40 font-semibold',
  white: 'bg-white/10 text-white border border-white/40 font-semibold',
  dark: 'bg-[#0A0A0A] text-[#CBD5E1]/80 border border-[#404040]',
  muted: 'bg-[#0A0A0A] text-[#CBD5E1]/60 border border-[#404040]/60',
  blue: 'bg-[#0B1F3A] text-white border border-[#CBD5E1]/30',
  yellow: 'bg-[#0B1F3A]/80 text-[#CBD5E1] border border-[#CBD5E1]/20',
  purple: 'bg-[#CBD5E1]/15 text-white border border-[#CBD5E1]/40',
  green: 'bg-white/10 text-white border border-white/40 font-semibold',
  red: 'bg-[#0A0A0A] text-[#CBD5E1]/80 border border-[#404040]',
}

export const requestStatusColor: Record<RequestStatus, BadgeColor> = {
  submitted: 'gray',
  in_review: 'navy',
  contracted: 'silver',
  in_development: 'navy',
  delivered: 'white',
}

export const contractStatusColor: Record<ContractStatus, BadgeColor> = {
  draft: 'gray',
  sent: 'navy',
  signed: 'white',
  declined: 'dark',
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
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide shadow-xs',
        colorClasses[color],
        className
      )}
    >
      {children}
    </span>
  )
}
