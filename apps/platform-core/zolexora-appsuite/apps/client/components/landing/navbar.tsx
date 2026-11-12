import Link from 'next/link'
import Image from 'next/image'
import { LinkButton } from '@/components/ui/link-button'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#404040] bg-[#080C14]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo.png"
            alt="Zolexora AppSuite Logo"
            width={34}
            height={34}
            className="w-8 h-8 rounded-lg object-contain transition-transform group-hover:scale-105"
            priority
          />
          <span className="font-semibold text-lg text-white">
            Zolexora{' '}
            <span className="text-[#CBD5E1]">AppSuite</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link
            href="/#how-it-works"
            className="text-[#CBD5E1]/80 hover:text-white transition-colors"
          >
            How it Works
          </Link>
          <Link
            href="/#services"
            className="text-[#CBD5E1]/80 hover:text-white transition-colors"
          >
            Services
          </Link>
          <Link
            href="/dashboard/requests"
            className="text-[#CBD5E1]/80 hover:text-white transition-colors"
          >
            My Requests
          </Link>
          <Link
            href="/dashboard/contracts"
            className="text-[#CBD5E1]/80 hover:text-white transition-colors"
          >
            Contracts
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LinkButton variant="ghost" size="sm" href="/dashboard">
            Sign In
          </LinkButton>
          <LinkButton size="sm" href="/dashboard/new-request">
            Get Started
          </LinkButton>
        </div>
      </div>
    </header>
  )
}
