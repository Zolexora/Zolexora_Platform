import { Suspense } from "react";
import HeroSection from "@/components/layout/HeroSection";
import CategoryGrid from "@/components/product/CategoryGrid";
import FeaturedProducts from "@/components/product/FeaturedProducts";
import DealsBanner from "@/components/layout/DealsBanner";

export default async function HomePage() {
  return (
    <div className="bg-cream min-h-screen">
      <HeroSection />
      <div className="max-w-[1400px] mx-auto px-4 py-10 space-y-14">
        <CategoryGrid />
        <DealsBanner />
        <Suspense fallback={<ProductSkeleton />}>
          <FeaturedProducts />
        </Suspense>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-white">
          <div className="aspect-square shimmer" />
          <div className="p-3 space-y-2">
            <div className="h-3 shimmer rounded w-3/4" />
            <div className="h-3 shimmer rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
