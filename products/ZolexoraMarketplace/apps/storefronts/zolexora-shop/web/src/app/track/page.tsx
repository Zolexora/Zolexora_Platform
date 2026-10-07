"use client";
import { Suspense } from "react";
import TrackPageClient from "./TrackPageClient";


function TrackPageFallback() {
  return <div className="max-w-2xl mx-auto px-4 py-8">Loading tracking...</div>;
}

export default function TrackPage() {
  return (
    <Suspense fallback={<TrackPageFallback />}>
      <TrackPageClient />
    </Suspense>
  );
}
