import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#080C14]">
      <div className="flex items-center gap-3.5 mb-8">
        <Image
          src="/logo.png"
          alt="Zolexora AppSuite"
          width={40}
          height={40}
          className="w-10 h-10 rounded-xl object-contain shadow-md"
          priority
        />
        <div>
          <span className="font-bold text-lg text-white tracking-wide">
            DevTeam <span className="text-[#CBD5E1]">Console</span>
          </span>
          <p className="text-[10px] text-[#CBD5E1]/70 tracking-wider uppercase">
            Zolexora AppSuite
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
