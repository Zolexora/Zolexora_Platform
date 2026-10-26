import { cn } from '@/lib/cn'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-lg border border-[#404040] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder:text-[#71717A] outline-none transition-colors',
          'focus:border-[#CBD5E1] focus:ring-1 focus:ring-[#CBD5E1]',
          error && 'border-[#CBD5E1] focus:border-[#CBD5E1] focus:ring-[#CBD5E1]',
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-[#CBD5E1]/70">{hint}</p>}
      {error && <p className="text-xs text-[#CBD5E1] font-medium">{error}</p>}
    </div>
  )
}
