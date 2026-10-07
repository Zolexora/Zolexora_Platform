"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const CATEGORIES = [
  { name: "Electronics", emoji: "⚡", color: "bg-blue-50", text: "text-blue-700", href: "/store?category=Electronics" },
  { name: "Fashion", emoji: "👗", color: "bg-pink-50", text: "text-pink-700", href: "/store?category=Fashion" },
  { name: "Home & Living", emoji: "🏡", color: "bg-green-50", text: "text-green-700", href: "/store?category=Home+%26+Living" },
  { name: "Beauty", emoji: "✨", color: "bg-purple-50", text: "text-purple-700", href: "/store?category=Beauty" },
  { name: "Sports", emoji: "🏃", color: "bg-orange-50", text: "text-orange-700", href: "/store?category=Sports" },
  { name: "Food", emoji: "☕", color: "bg-amber-50", text: "text-amber-700", href: "/store?category=Food" },
  { name: "Other", emoji: "📦", color: "bg-gray-50", text: "text-gray-700", href: "/store?category=Other" },
  { name: "All Products", emoji: "🛍️", color: "bg-gold/10", text: "text-amber-800", href: "/store" },
];

export default function CategoryGrid() {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-ink mb-5">Shop by Category</h2>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {CATEGORIES.map((cat, i) => (
          <motion.div key={cat.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.4 }}>
            <Link href={cat.href}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl ${cat.color} hover:scale-105 transition-transform cursor-pointer group`}>
              <span className="text-2xl">{cat.emoji}</span>
              <span className={`text-[11px] font-semibold text-center ${cat.text} leading-tight`}>{cat.name}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
