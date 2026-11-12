import Link from 'next/link'
import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#080C14]">
      {/* Background orb */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse at center, #0B1F3A, transparent 70%)' }}
        />
      </div>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-10 relative group">
        <Image
          src="/logo.png"
          alt="Zolexora AppSuite Logo"
          width={38}
          height={38}
          className="w-9 h-9 rounded-xl object-contain shadow-lg shadow-black/40 transition-transform group-hover:scale-105"
          priority
        />
        <span className="font-semibold text-xl text-white">
          Zolexora <span className="text-[#CBD5E1]">AppSuite</span>
        </span>
      </Link>

      <div className="relative w-full flex justify-center">
        {children}
      </div>
    </div>
  )
}
