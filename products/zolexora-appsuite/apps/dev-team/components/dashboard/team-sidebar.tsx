'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  GitPullRequest,
  FileCheck,
  Users,
  Terminal,
  LogOut,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { signOutTeamAction } from '@/lib/actions/team-actions'
import type { ZolexoraUser } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/requests', label: 'App Requests', icon: GitPullRequest },
  { href: '/contracts', label: 'Contracts & Legal', icon: FileCheck },
  { href: '/clients', label: 'Client Accounts', icon: Users },
]

export function TeamSidebar({ user }: { user: ZolexoraUser }) {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-5 select-none shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <Image
          src="/logo.png"
          alt="Zolexora App Suite"
          width={32}
          height={32}
          className="w-8 h-8 rounded-lg object-contain shadow-sm"
        />
        <div className="min-w-0">
          <p className="font-bold text-sm text-[var(--color-text-primary)] tracking-wide">
            DevTeam <span className="text-[var(--color-brand-primary)]">Ops</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] truncate">
            {user.email}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-3 mb-1">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/30'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
          <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-3 mb-1">
            External Links
          </div>
          <a
            href="http://localhost:3070"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <span className="flex items-center gap-2">Client Portal (:3070)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* Sign Out */}
      <form action={signOutTeamAction} className="pt-4 border-t border-[var(--color-border)]">
        <button
          type="submit"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors w-full cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out of Console
        </button>
      </form>
    </aside>
  )
}
