'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  FolderOpen,
  FileText,
  LogOut,
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
    <aside className="flex flex-col w-60 min-h-screen border-r border-[#404040] bg-[#080C14] px-4 py-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-2 mb-8 group">
        <Image
          src="/logo.png"
          alt="Zolexora AppSuite Logo"
          width={30}
          height={30}
          className="w-7 h-7 rounded-lg object-contain transition-transform group-hover:scale-105"
        />
        <span className="font-semibold text-sm text-white tracking-wide">
          App<span className="text-[#CBD5E1]">Suite</span>
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
                  ? 'bg-[#0B1F3A] text-white border border-[#CBD5E1]/30 font-semibold shadow-xs'
                  : 'text-[#CBD5E1]/80 hover:text-white hover:bg-[#121824]'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-[#404040] pt-4 mt-4 space-y-1">
        {/* User email */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#404040]/50">
          <div className="w-7 h-7 rounded-full bg-[#0B1F3A] border border-[#CBD5E1]/30 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-[#CBD5E1]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user.email}
            </p>
            <p className="text-[10px] text-[#CBD5E1]/70">
              {user.emailVerifiedAt ? 'Verified' : 'Unverified'}
            </p>
          </div>
        </div>

        {/* Sign Out */}
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#CBD5E1]/70 hover:text-white hover:bg-[#404040]/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
