"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Truck } from "lucide-react";


const SLIDES = [
  { tag: "New Arrivals", title: "Electronics\nReimagined", sub: "Headphones, Watches & More — up to 40% off", cta: "Shop Electronics", href: "/store?category=Electronics", bg: "from-slate-900 to-slate-800", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80" },
  { tag: "Summer Edit", title: "Fashion\nForward", sub: "Curated looks for every occasion", cta: "Explore Fashion", href: "/store?category=Fashion", bg: "from-amber-900 to-stone-900", img: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80" },
  { tag: "Wellness", title: "Feel Good\nEvery Day", sub: "Beauty, Sports & Organic picks", cta: "Shop Wellness", href: "/store?category=Beauty", bg: "from-emerald-900 to-teal-900", img: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=600&q=80" },
];

export default function HeroSection() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* Main hero — static first slide for SSR, could be a slider */}
      <div className={`bg-gradient-to-br ${SLIDES[0].bg} relative overflow-hidden min-h-[440px] sm:min-h-[500px]`}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5 hero-pattern" />

        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-16 md:py-20 flex items-center gap-12 relative z-10">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 max-w-xl">
            <span className="inline-flex items-center gap-1.5 bg-gold/20 text-gold text-xs font-semibold px-3 py-1 rounded-full mb-5">
              <Sparkles size={12} /> {SLIDES[0].tag}
            </span>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] mb-5 whitespace-pre-line">
              {SLIDES[0].title}
            </h1>
            <p className="text-white/70 text-base sm:text-lg mb-8">{SLIDES[0].sub}</p>
            <Link href={SLIDES[0].href}
              className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-bold px-7 py-3.5 rounded-xl transition-all hover:scale-105 text-sm">
              {SLIDES[0].cta} <ArrowRight size={16} />
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block flex-shrink-0">
            <div className="relative">
              <div className="w-[320px] h-[320px] rounded-3xl overflow-hidden ring-1 ring-white/10">
                <Image src={SLIDES[0].img} alt="Featured Deal" width={320} height={320} className="w-full h-full object-cover" priority />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl px-4 py-3 shadow-modal flex items-center gap-3">
                <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center text-lg">🎧</div>
                <div>
                  <p className="text-xs text-gray-500">Today&apos;s Deal</p>
                  <p className="text-sm font-bold text-ink">Up to 40% off</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-center gap-8 flex-wrap">
          {[
            { icon: Truck, text: "Free delivery over ₹499" },
            { icon: ShieldCheck, text: "Buyer protection on all orders" },
            { icon: Sparkles, text: "Earn coins on every purchase" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-gray-600">
              <Icon size={14} className="text-gold" /> {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
