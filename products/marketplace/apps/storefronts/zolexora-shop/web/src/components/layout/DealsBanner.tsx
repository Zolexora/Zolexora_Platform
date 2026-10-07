import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function DealsBanner() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[
        { title: "Deal of the Day", sub: "Up to 40% off Electronics", href: "/store?category=Electronics&sort=price_asc", bg: "bg-slate-900", accent: "text-gold", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80" },
        { title: "Fresh Fashion", sub: "New arrivals every week", href: "/store?category=Fashion&sort=newest", bg: "bg-stone-800", accent: "text-amber-300", img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80" },
        { title: "Beauty Picks", sub: "Organic & cruelty-free", href: "/store?category=Beauty", bg: "bg-rose-900", accent: "text-rose-300", img: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&q=80" },
      ].map((b) => (
        <Link key={b.title} href={b.href}
          className={`relative overflow-hidden rounded-2xl ${b.bg} p-6 flex flex-col justify-between min-h-[140px] group`}>
          <div className="absolute right-0 top-0 bottom-0 w-36 overflow-hidden">
            <Image src={b.img} alt="" fill sizes="144px" className="object-cover opacity-30 group-hover:opacity-40 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-slate-900/80" />
          </div>
          <div className="relative z-10">
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${b.accent}`}>{b.title}</p>
            <p className="text-white font-semibold text-sm">{b.sub}</p>
          </div>
          <div className={`relative z-10 flex items-center gap-1 text-xs font-semibold ${b.accent}`}>
            Shop Now <ArrowRight size={12} />
          </div>
        </Link>
      ))}
    </div>
  );
}
