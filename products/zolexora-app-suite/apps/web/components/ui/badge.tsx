import { cn } from '@/lib/cn'
import type { RequestStatus, ContractStatus } from '@/lib/types'

type BadgeColor = 'gray' | 'blue' | 'yellow' | 'purple' | 'green' | 'red'

const colorClasses: Record<BadgeColor, string> = {
  gray: 'bg-gray-800 text-gray-300',
  blue: 'bg-blue-900/50 text-blue-300',
  yellow: 'bg-yellow-900/50 text-yellow-300',
  purple: 'bg-purple-900/50 text-purple-300',
  green: 'bg-green-900/50 text-green-300',
  red: 'bg-red-900/50 text-red-300',
}

export const requestStatusColor: Record<RequestStatus, BadgeColor> = {
  submitted: 'gray',
  in_review: 'blue',
  contracted: 'purple',
  in_development: 'yellow',
  delivered: 'green',
}

export const contractStatusColor: Record<ContractStatus, BadgeColor> = {
  draft: 'gray',
  sent: 'blue',
  signed: 'green',
  declined: 'red',
}

export function Badge({
  children,
  color = 'gray',
}: {
  children: React.ReactNode
  color?: BadgeColor
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        colorClasses[color]
      )}
    >
      {children}
    </span>
  )
}
