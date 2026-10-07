"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { productsApi, type Product, type ProductListParams } from "@/lib/api";
import ProductCard from "@/components/product/ProductCard";
import { X, ChevronDown } from "lucide-react";

const CATEGORIES = ["All", "Electronics", "Fashion", "Home & Living", "Beauty", "Sports", "Food", "Other"];
const SORTS = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
];

export default function StorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get("category") || "All");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  const fetchProducts = useCallback(async (skip: number, reset = false) => {
    setLoading(true);
    try {
      const params: ProductListParams = { limit: LIMIT, skip, sort };
      if (category !== "All") params.category = category;
      if (search) params.search = search;
      const data = await productsApi.list(params);
      setProducts(reset ? data : (prev) => [...prev, ...data]);
      setHasMore(data.length === LIMIT);
      if (reset) setPage(0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [category, sort, search]);

  useEffect(() => { fetchProducts(0, true); }, [fetchProducts]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage * LIMIT, false);
  };

  const setFilter = (cat: string) => {
    setCategory(cat);
    router.push(`/store?category=${cat}`, { scroll: false });
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 pt-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {search ? `Results for "${search}"` : category === "All" ? "All Products" : category}
          </h1>
          {!loading && <p className="text-sm text-gray-400 mt-0.5">{products.length} products</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products"
              className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-gray-200 text-sm bg-white text-ink focus:outline-none focus:border-gold cursor-pointer">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`flex-shrink-0 h-8 px-4 rounded-full text-sm font-medium transition-all ${
              category === cat
                ? "bg-ink text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Active search */}
      {search && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Searching for:</span>
          <span className="flex items-center gap-1.5 bg-gold/10 text-gold-dark text-sm font-medium px-3 py-1 rounded-full">
            {search}
            <button onClick={() => { setSearch(""); router.push("/store"); }} aria-label="Clear search" title="Clear search">
              <X size={13} />
            </button>
          </span>
        </div>
      )}

      {/* Products */}
      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white">
              <div className="aspect-square shimmer" />
              <div className="p-3 space-y-2"><div className="h-3 shimmer rounded w-3/4" /><div className="h-4 shimmer rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <span className="text-5xl mb-4">🔍</span>
          <p className="font-semibold text-lg text-gray-500">No products found</p>
          <p className="text-sm mt-1">Try a different search or category</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((p, i) => <ProductCard key={p.id} product={p} index={i % LIMIT} />)}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-10">
              <button onClick={loadMore} disabled={loading}
                className="h-11 px-8 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-ink hover:border-gray-400 transition-colors disabled:opacity-50">
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
