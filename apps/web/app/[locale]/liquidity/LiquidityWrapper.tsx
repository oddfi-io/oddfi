"use client";

import dynamic from "next/dynamic";
import { LiquiditySkeleton } from "./loading";

const PoolsPage = dynamic(() => import("@/components/pools/PoolsPage"), {
  ssr: false,
  loading: LiquiditySkeleton,
});

export default function LiquidityWrapper() {
  return <PoolsPage />;
}
