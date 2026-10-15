"use client";

import { useTierSaleState } from "../hooks/useTierSaleState";
import VaultInfoCard from "./VaultInfoCard";
import BuyCard from "./BuyCard";

/**
 * DD-146 BuySection — 购买区编排（Figma 8604:53585 PC 两栏 / 8754:96532 H5 单列）。
 *
 * 拥有 useTierSaleState（单一数据源，链上直读），把 saleState 同时下发给
 * VaultInfoCard（左栏金库信息）和 BuyCard（右栏信息面板），并负责 PC 两栏 / H5 纵向布局。
 * 非浅 wrapper：聚合 sale-state 单一真值 + 响应式布局协调（2 调用方），保留独立文件（DD §8.2 Deletion Test）。
 */
export default function BuySection() {
  const { saleState } = useTierSaleState();

  return (
    <section
      id="tiersale-buy"
      data-figma-pc="8604:53584"
      data-figma-h5="8754:96532"
      className="w-full rounded-b-[36px]"
      style={{
        // @figma-hardcoded: 第二屏 dark→mint 渐变（Figma 8604:53584，底部偏左 mint 辉光）— pending design token
        backgroundImage:
          "linear-gradient(156.418deg, #0d0d0f 64.539%, rgba(40,244,210,0.7) 101.71%, #28f4d2 155.89%)",
      }}
    >
      {/* 内层两栏内容（Figma 8604:53585）：max-w-1200 居中，渐变由外层全宽带承载 */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-10 px-4 py-12 md:flex-row md:gap-[100px] md:px-8 md:py-16">
        <VaultInfoCard saleState={saleState} />
        <BuyCard saleState={saleState} />
      </div>
    </section>
  );
}
