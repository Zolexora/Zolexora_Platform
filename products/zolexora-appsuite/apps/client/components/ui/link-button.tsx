import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { ComponentProps } from 'react'

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: LinkButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBD5E1]'

  const variants = {
    primary:
      'bg-[#0B1F3A] text-white hover:bg-[#142E54] border border-[#CBD5E1]/30 hover:border-[#CBD5E1]/60 shadow-sm active:scale-[0.98]',
    ghost:
      'text-[#CBD5E1] hover:text-white hover:bg-[#121824]',
    outline:
      'border border-[#404040] text-[#CBD5E1] hover:text-white hover:border-[#CBD5E1]/50 hover:bg-[#0B1F3A]/40',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <Link
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  )
}
