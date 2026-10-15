"use client";

import dynamic from "next/dynamic";

const MarketsPageClient = dynamic(() => import("./MarketsPageClient"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-primary animate-pulse" />,
});

export default function MarketsPageWrapper() {
  return <MarketsPageClient />;
}
