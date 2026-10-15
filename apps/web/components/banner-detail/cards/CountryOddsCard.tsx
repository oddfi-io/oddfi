"use client";

import type { BannerItemDetail } from "@/types/home-banner";
import CircleFlag from "@/components/icons/CircleFlag";
import BetPillButton from "../BetPillButton";
import RankBadge from "../RankBadge";

interface Props {
  /** 排名（按 implied_probability 降序，由父组件计算） */
  rank: number;
  /** 详情接口返回的 item */
  item: BannerItemDetail;
  /** Bet 按钮点击 — 父组件 add(selection) 到 betSlipStore */
  onBet: (item: BannerItemDetail, e: React.MouseEvent) => void;
  /**
   * H5 紧凑模式（343×59）
   * - true  → mobile layout：rank 20px / flag 24px / name 14px Bold / gap-3
   * - false → PC layout（默认，不变）
   *
   * Track A（BannerDetailView）在 H5 视口传 mobile={true}
   */
  mobile?: boolean;
}

/**
 * CountryOddsCard：B1 详情页国家赔率卡
 *
 * PC  Figma：[3550:73361] 80h — rank(18/26 bold) + flag(32) + name(16 bold) + odds + Bet
 * H5  Figma：[3646:135980] 59h — rank(20px) + flag(24) + name(14 bold) + odds + Bet
 *
 * Bet 按钮 onClick 由父组件接 betSlipStore.add（DD-085 §3.5 决策 #12）
 */
export default function CountryOddsCard({ rank, item, onBet, mobile = false }: Props) {
  if (mobile) {
    return (
      // H5: bg-secondary (#111114), rounded-[12px], px-3 py-4 gap-3
      // Figma 3646:135980: px-[12px] py-[16px] gap-[12px] rounded-[12px]
      <div
        className="flex items-center gap-3 rounded-[12px] bg-secondary px-3 py-4"
        data-figma-node="3646:135980"
      >
        {/* Left: rank + flag + name */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* H5 rank badge 20×20 */}
          <RankBadge rank={rank} size={20} />
          {/* H5 flag 24×24 circle */}
          {item.country_code && (
            <CircleFlag code={item.country_code} size={24} className="shrink-0" />
          )}
          {/* 14px Body Bold */}
          <span className="truncate text-[14px] font-bold leading-[19px] text-primary">
            {item.name}
          </span>
        </div>

        {/* Odds pill (teal half-transparent) — same token as PC */}
        <div
          className="flex shrink-0 items-center justify-center rounded-lg px-3 py-1 text-[14px] font-bold leading-[19px]"
          style={{
            // @figma-hardcoded: rgba(40,244,210,0.1) odds-pill-bg — pending design token (fill/tag/brand-transparent)
            backgroundColor: "rgba(40,244,210,0.1)",
            color: "#28f4d2",
          }}
        >
          {item.odds}x
        </div>

        {/* Bet pill — H5 紧凑（Figma 3646:135980 内 bet pill, padding-driven 11px） */}
        <BetPillButton
          onClick={(e) => onBet(item, e)}
          ariaLabel={`Bet on ${item.name}`}
          size="sm"
        />
      </div>
    );
  }

  // PC layout — unchanged
  return (
    <div
      className="flex items-center gap-8 rounded-2xl bg-secondary p-6"
      data-figma-node="3550:73361"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <RankBadge rank={rank} />
        {item.country_code && (
          <CircleFlag code={item.country_code} size={32} className="shrink-0" />
        )}
        <span className="truncate text-[16px] font-bold leading-[24px] text-primary">
          {item.name}
        </span>
      </div>

      {/* Odds pill (teal half-transparent) */}
      <div
        className="flex h-8 shrink-0 items-center justify-center rounded-lg px-4 text-[14px] font-bold leading-[19px]"
        style={{
          // @figma-hardcoded: rgba(40,244,210,0.1) odds-pill-bg — pending design token (fill/tag/brand-transparent)
          backgroundColor: "rgba(40,244,210,0.1)",
          color: "#28f4d2",
        }}
      >
        {item.odds}x
      </div>

      <BetPillButton onClick={(e) => onBet(item, e)} ariaLabel={`Bet on ${item.name}`} />
    </div>
  );
}
