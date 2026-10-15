"use client";

import Image from "next/image";

interface Props {
  /** 名次（1-based）；1/2/3 渲染奖杯，其余渲染数字 */
  rank: number;
  /** 视觉尺寸（px），默认 32（与 Figma card 节点一致）；数字模式宽度按 24 留位以对齐 */
  size?: number;
}

const TROPHY_SRC: Record<number, string> = {
  1: "/banner/icons/rank-medal-1.svg",
  2: "/banner/icons/rank-medal-2.svg",
  3: "/banner/icons/rank-medal-3.svg",
};

const TROPHY_ALT: Record<number, string> = {
  1: "Gold trophy (rank 1)",
  2: "Silver trophy (rank 2)",
  3: "Bronze trophy (rank 3)",
};

/**
 * RankBadge：banner detail 排名徽章
 *
 * 规则（用户验收 2026-04-27）：
 *  - rank 1/2/3 → 奖杯 SVG（金 / 银 / 铜）+ 杯口内叠加 1/2/3 数字（白色 bold，~32% size）
 *  - rank ≥ 4  → 纯数字（白色 18/26 bold，与原 CountryOddsCard / PlayerOddsCard 视觉一致）
 *
 * 资源：public/banner/icons/rank-medal-{1,2,3}.svg（杯型只画到 viewBox y=4-15，数字由 React 叠加）
 * Figma 节点：[I3550:73361;3542:122822] (Component 2 / 32×32 rank badge)
 */
export default function RankBadge({ rank, size = 32 }: Props) {
  const src = TROPHY_SRC[rank];
  if (src) {
    return (
      <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        <Image
          src={src}
          alt={TROPHY_ALT[rank] ?? `Rank ${rank}`}
          width={size}
          height={size}
          sizes={`${size}px`}
          className="block"
        />
        {/* 数字叠加：参照 Figma 节点 3646:135980 数字 inset 43% 中心，字号按 size 比例缩放 */}
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-bold leading-none text-static-black"
          style={{ top: "43%", fontSize: size * 0.34 }}
          aria-hidden="true"
        >
          {rank}
        </span>
      </span>
    );
  }
  // rank 4+ → 数字（容器宽度与奖杯一致，避免名次列错位）
  return (
    <span
      className="flex shrink-0 items-center justify-center text-[18px] font-bold leading-[26px] text-white"
      style={{ width: size, height: size }}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}
