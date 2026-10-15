"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import SwapCard from "@/components/swap/SwapCard";
import SlippageModal from "@/components/swap/SlippageModal";

// Dynamic imports with ssr:false — lightweight-charts requires browser Canvas API
const TokenChartCard = dynamic(() => import("@/components/swap/TokenChartCard"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-[24px] rounded-16 bg-fill-card1 p-[16px] lg:gap-[40px] lg:p-[32px] overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-[16px]">
        <div className="flex flex-col gap-[8px]">
          <div className="flex items-center gap-[12px]">
            <div className="size-[24px] lg:size-[32px] rounded-full bg-secondary animate-pulse" />
            <div className="h-[28px] w-[48px] rounded bg-secondary animate-pulse" />
          </div>
          <div className="flex items-center gap-[8px]">
            <div className="h-[28px] w-[120px] rounded bg-secondary animate-pulse" />
            <div className="h-[18px] w-[64px] rounded bg-secondary animate-pulse" />
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-[16px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-[6px] items-center">
              <div className="h-[18px] w-[64px] rounded bg-secondary animate-pulse" />
              <div className="h-[18px] w-[56px] rounded bg-secondary animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      {/* H5 stats grid skeleton */}
      <div className="lg:hidden flex flex-col gap-[16px]">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center justify-between">
            {[0, 1].map((col) => (
              <div key={col} className="flex flex-col gap-[4px]">
                <div className="h-[18px] w-[80px] rounded bg-secondary animate-pulse" />
                <div className="h-[18px] w-[64px] rounded bg-secondary animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Chart area skeleton */}
      <div className="flex flex-col">
        <div className="hidden lg:flex items-center gap-[12px] h-[36px] mb-0">
          <div className="h-[36px] w-[152px] rounded-full bg-secondary animate-pulse" />
          <div className="h-[36px] w-[48px] rounded-full bg-secondary animate-pulse" />
        </div>
        <div className="w-full h-[300px] rounded-8 bg-secondary animate-pulse" />
      </div>
      {/* Mobile interval tabs skeleton */}
      <div className="flex lg:hidden justify-center">
        <div className="h-[36px] w-[160px] rounded-full bg-secondary animate-pulse" />
      </div>
    </div>
  ),
});

export default function SwapPage() {
  const [slippageOpen, setSlippageOpen] = useState(false);
  const [slippage, setSlippage] = useState(0.5);

  return (
    <div className="min-h-screen bg-primary px-4 py-6 pb-[env(safe-area-inset-bottom)] lg:px-6 lg:pt-[64px] lg:pb-8">
      {/*
       * Figma 5891:17204 (PC) / 5893:17622 (H5)
       * PC：左 656 / gap 40 / 右 504 (1200 max-w)；TopNav 与 Swap 区间距 80px
       *     (layout pt-[80px] 已留 16px，本页 pt-[64px] 补足 80px)
       * H5：纵向，Swap 在前(order-1)，Chart 在后(order-2)，gap 16
       */}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[16px] lg:grid lg:grid-cols-[minmax(0,1fr)_504px] lg:items-stretch lg:gap-[40px]">
        {/* ── Left column: Chart (含 stats，已合并 Overview) ─────────────────── */}
        <div className="order-2 lg:order-1">
          <TokenChartCard />
        </div>

        {/* ── Right column: Swap ──────────────────────────────────────────────── */}
        <div className="order-1 lg:order-2 lg:flex">
          <SwapCard slippage={slippage} onOpenSlippage={() => setSlippageOpen(true)} />
        </div>
      </div>

      <SlippageModal
        isOpen={slippageOpen}
        onClose={() => setSlippageOpen(false)}
        value={slippage}
        onChange={setSlippage}
      />
    </div>
  );
}
