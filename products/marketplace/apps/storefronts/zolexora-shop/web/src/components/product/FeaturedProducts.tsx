import ProductCard from "./ProductCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/api";
import { STOREFRONT_HEADER } from "@zolexora/shared-api/storefront";
import { STOREFRONT_KEY } from "@/lib/api";

async function getProducts(): Promise<Product[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return [];

  try {
    const res = await fetch(`${apiUrl}/products?limit=20&sort=newest`, {
      headers: { [STOREFRONT_HEADER]: STOREFRONT_KEY },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}


export default async function FeaturedProducts() {
  const products = await getProducts();

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-xl font-bold text-ink">Featured Products</h2>
        <Link href="/store" className="text-sm font-semibold text-gold flex items-center gap-1 hover:gap-2 transition-all">
          View all <ArrowRight size={14} />
        </Link>
      </div>
      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No products yet</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </section>
  );
}
