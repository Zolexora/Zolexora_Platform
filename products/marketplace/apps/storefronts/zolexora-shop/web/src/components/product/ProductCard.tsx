"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShoppingCart, Star } from "lucide-react";
import { useCartStore, useAuthStore } from "@/store";
import type { Product } from "@/lib/api";
import toast from "react-hot-toast";

export default function ProductCard({ product: p, index = 0 }: { product: Product; index?: number }) {
  const { user } = useAuthStore();
  const { addItem } = useCartStore();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to add items to cart"); return; }
    try {
      await addItem(p.id);
      toast.success("Added to cart");
    } catch {
      toast.error("Failed to add");
    }
  };

  const discount = p.discount_percent ? Math.round(p.discount_percent) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <Link href={`/product/${p.id}`}
        className="group flex flex-col bg-white rounded-2xl overflow-hidden hover:shadow-card-hover transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-100">

        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          {p.images?.[0] ? (
            <Image src={p.images[0]} alt={p.title} fill priority={index < 4} sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
          )}
          {discount && (
            <span className="absolute top-2.5 left-2.5 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              -{discount}%
            </span>
          )}
          <button onClick={handleAddToCart} title="Add to cart"
            className="absolute bottom-2.5 right-2.5 w-8 h-8 bg-white rounded-full shadow-card flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 hover:bg-gold">
            <ShoppingCart size={14} className="text-ink" />
          </button>
        </div>

        {/* Info */}
        <div className="p-3 flex-1 flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium">{p.category}</p>
          <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2">{p.title}</h3>

          {(p.rating || 0) > 0 && (
            <div className="flex items-center gap-1">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              <span className="text-[11px] text-gray-500">{p.rating?.toFixed(1)} ({p.reviews_count || 0})</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto pt-1">
            <span className="font-bold text-sm text-ink">₹{(p.price.amount_minor / 100).toLocaleString("en-IN")}</span>
            {p.original_price && p.original_price.amount_minor > p.price.amount_minor && (
              <span className="text-xs text-gray-400 line-through">₹{(p.original_price.amount_minor / 100).toLocaleString("en-IN")}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
