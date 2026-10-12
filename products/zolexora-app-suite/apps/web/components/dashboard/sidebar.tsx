'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  FolderOpen,
  FileText,
  LogOut,
  Layers,
  User,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { signOutAction } from '@/lib/actions/auth'
import type { ZolexoraUser } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/new-request', label: 'New Request', icon: PlusCircle },
  { href: '/dashboard/requests', label: 'My Requests', icon: FolderOpen },
  { href: '/dashboard/contracts', label: 'Contracts', icon: FileText },
]

interface SidebarProps {
  user: ZolexoraUser
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-60 min-h-screen border-r border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-7 h-7 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center">
          <Layers className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm text-[var(--color-text-primary)]">
          App Suite
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-[var(--color-border)] pt-4 mt-4 space-y-1">
        {/* User email */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-[var(--color-brand-primary)]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
              {user.email}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {user.emailVerifiedAt ? 'Verified' : 'Unverified'}
            </p>
          </div>
        </div>

        {/* Sign Out */}
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
