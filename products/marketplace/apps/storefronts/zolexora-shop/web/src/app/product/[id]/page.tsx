"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { productsApi, type Product } from "@/lib/api";
import { useCartStore, useAuthStore } from "@/store";
import { ShoppingCart, Zap, Star, Shield, Truck, RefreshCw, ChevronLeft, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    productsApi.get(id).then(setProduct).catch(() => router.push("/store")).finally(() => setLoading(false));
  }, [id, router]);

  const handleAddToCart = async () => {
    if (!user) { toast.error("Sign in to add to cart"); router.push("/auth"); return; }
    if (!product) return;
    setAdding(true);
    try {
      await addItem(product.id, qty);
      toast.success(`${qty} item${qty > 1 ? "s" : ""} added to cart`);
    } catch { toast.error("Failed to add to cart"); }
    finally { setAdding(false); }
  };

  const handleBuyNow = async () => {
    if (!user) { router.push("/auth"); return; }
    await handleAddToCart();
    router.push("/cart");
  };

  if (loading) return (
    <div className="max-w-[1200px] mx-auto px-4 py-10 grid md:grid-cols-2 gap-10">
      <div className="aspect-square shimmer rounded-2xl" />
      <div className="space-y-4 pt-4">{[200, 120, 80, 60, 100].map((w, i) => <div key={i} className={`h-5 shimmer rounded w-[${w}px]`} />)}</div>
    </div>
  );

  if (!product) return null;
  const discount = product.discount_percent ? Math.round(product.discount_percent) : null;
  const productImages = product.images || [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-ink mb-6 transition-colors">
        <ChevronLeft size={16} /> Back
      </button>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
        {/* Images */}
        <div className="flex gap-3">
          {productImages.length > 1 && (
            <div className="flex flex-col gap-2">
              {productImages.map((img: string, i: number) => (
                <button key={i} onClick={() => setActiveImg(i)} title={`View image ${i + 1}`}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${activeImg === i ? "border-gold" : "border-transparent"}`}>
                  <Image src={img} alt="" width={56} height={56} className="w-full h-full object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
          <motion.div key={activeImg} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="relative flex-1 aspect-square bg-white rounded-3xl overflow-hidden border border-gray-100">
            {productImages[activeImg] ? (
              <Image src={productImages[activeImg]} alt={product.title} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-contain p-4" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">📦</div>
            )}
          </motion.div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-xs font-semibold text-gold uppercase tracking-wider">{product.category || "Other"}</span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-1 leading-snug">{product.title}</h1>
            {product.seller_name && <p className="text-sm text-gray-500 mt-1">by {product.seller_name}</p>}
          </div>

          {(product.rating || 0) > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-lg">
                <Star size={13} className="fill-green-700" />
                <span className="text-sm font-bold">{product.rating?.toFixed(1)}</span>
              </div>
              <span className="text-sm text-gray-400">{product.reviews_count || 0} ratings</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 py-2 border-t border-b border-gray-100">
            <span className="font-display text-3xl font-bold text-ink">₹{(product.price.amount_minor / 100).toLocaleString("en-IN")}</span>
            {product.original_price && product.original_price.amount_minor > product.price.amount_minor && (
              <>
                <span className="text-lg text-gray-400 line-through">₹{(product.original_price.amount_minor / 100).toLocaleString("en-IN")}</span>
                <span className="bg-red-50 text-red-600 text-sm font-bold px-2.5 py-1 rounded-lg">{discount}% off</span>
              </>
            )}
          </div>

          <div className="space-y-4">
            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600">Quantity:</span>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setQty(Math.max(1, qty - 1))} title="Decrease quantity" className="w-9 h-9 flex items-center justify-center hover:bg-cream transition-colors">
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => setQty(Math.min(product.stock || 10, qty + 1))} title="Increase quantity" className="w-9 h-9 flex items-center justify-center hover:bg-cream transition-colors">
                  <Plus size={14} />
                </button>
              </div>
              <span className="text-xs text-gray-400">{product.stock} in stock</span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleAddToCart} disabled={adding}
                className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-ink rounded-xl font-bold text-sm text-ink hover:bg-ink hover:text-white transition-all disabled:opacity-50">
                <ShoppingCart size={17} /> Add to Cart
              </button>
              <button onClick={handleBuyNow}
                className="flex-1 h-12 flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark rounded-xl font-bold text-sm text-ink transition-all">
                <Zap size={17} /> Buy Now
              </button>
            </div>

            <div className="bg-[#fffdf7] border border-[#f5ead1] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">💰</span>
                <div>
                  <h4 className="font-bold text-ink text-sm">Zolexora Coins</h4>
                  <p className="text-sm text-gray-600 leading-snug">
                    Earn {Math.floor(product.price.amount_minor / 10000)} coins with this purchase.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Truck, text: "Free Delivery", sub: "Over ₹499" },
              { icon: Shield, text: "Buyer Protection", sub: "100% secured" },
              { icon: RefreshCw, text: "Easy Returns", sub: "7-day policy" },
            ].map(({ icon: Icon, text, sub }) => (
              <div key={text} className="flex flex-col items-center gap-1 p-3 bg-cream rounded-xl text-center">
                <Icon size={16} className="text-gold" />
                <span className="text-[11px] font-semibold text-ink">{text}</span>
                <span className="text-[10px] text-gray-400">{sub}</span>
              </div>
            ))}
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">Quantity:</span>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQty(Math.max(1, qty - 1))} title="Decrease quantity" className="w-9 h-9 flex items-center justify-center hover:bg-cream transition-colors">
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock || 10, qty + 1))} title="Increase quantity" className="w-9 h-9 flex items-center justify-center hover:bg-cream transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <span className="text-xs text-gray-400">{product.stock} in stock</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleAddToCart} disabled={adding}
              className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-ink rounded-xl font-bold text-sm text-ink hover:bg-ink hover:text-white transition-all disabled:opacity-50">
              <ShoppingCart size={17} /> Add to Cart
            </button>
            <button onClick={handleBuyNow}
              className="flex-1 h-12 flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark rounded-xl font-bold text-sm text-ink transition-all">
              <Zap size={17} /> Buy Now
            </button>
          </div>

          {user && (
            <p className="text-xs text-gray-400 text-center">
              💰 Earn {Math.floor((product.price.amount_minor / 100) / 100)} coins with this purchase
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
