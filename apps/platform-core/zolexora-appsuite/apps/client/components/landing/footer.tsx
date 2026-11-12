import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-[#404040] bg-[#080C14]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Image
                src="/logo.png"
                alt="Zolexora AppSuite Logo"
                width={28}
                height={28}
                className="w-7 h-7 rounded-lg object-contain"
              />
              <span className="font-semibold text-white">
                Zolexora AppSuite
              </span>
            </div>
            <p className="text-sm text-[#CBD5E1]/70 max-w-xs">
              Custom software development, on demand. Powered by the Zolexora
              engineering team.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-8 text-sm">
            <div className="flex flex-col gap-2">
              <p className="font-medium text-white mb-1">
                Platform
              </p>
              <Link
                href="/#how-it-works"
                className="text-[#CBD5E1]/70 hover:text-white transition-colors"
              >
                How it Works
              </Link>
              <Link
                href="/#services"
                className="text-[#CBD5E1]/70 hover:text-white transition-colors"
              >
                Services
              </Link>
              <Link
                href="/dashboard/new-request"
                className="text-[#CBD5E1]/70 hover:text-white transition-colors"
              >
                Get Started
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium text-white mb-1">
                Workspace
              </p>
              <Link
                href="/dashboard"
                className="text-[#CBD5E1]/70 hover:text-white transition-colors"
              >
                Overview
              </Link>
              <Link
                href="/dashboard/requests"
                className="text-[#CBD5E1]/70 hover:text-white transition-colors"
              >
                My Requests
              </Link>
              <Link
                href="/dashboard/contracts"
                className="text-[#CBD5E1]/70 hover:text-white transition-colors"
              >
                Contracts
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#404040]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#CBD5E1]/60">
          <p>&copy; {new Date().getFullYear()} Zolexora. All rights reserved.</p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
