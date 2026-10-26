import { cn } from '@/lib/cn'
import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export function Select({
  label,
  error,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          'w-full rounded-lg border border-[#404040] bg-[#0A0A0A] px-3 py-2.5 text-sm text-white outline-none transition-colors',
          'focus:border-[#CBD5E1] focus:ring-1 focus:ring-[#CBD5E1]',
          error && 'border-[#CBD5E1]',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="bg-[#0A0A0A] text-[#71717A]">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0A0A0A] text-white">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#CBD5E1] font-medium">{error}</p>}
    </div>
  )
}
