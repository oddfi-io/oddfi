"use client";

import dynamic from "next/dynamic";
import { PortfolioSkeleton } from "./loading";

const PortfolioPageClient = dynamic(() => import("./PortfolioPageClient"), {
  ssr: false,
  loading: PortfolioSkeleton,
});

export default function PortfolioWrapper() {
  return <PortfolioPageClient />;
}
