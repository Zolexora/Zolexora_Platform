"use client";
import { Suspense } from "react";
import StorePageClient from "./StorePageClient";

function StorePageFallback() {
  return <div className="max-w-[1400px] mx-auto px-4 pt-6 pb-16">Loading store...</div>;
}

export default function StorePage() {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <StorePageClient />
    </Suspense>
  );
}
