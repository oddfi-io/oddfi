"use client";

import type { BannerItemDetail } from "@/types/home-banner";
import CircleFlag from "@/components/icons/CircleFlag";
import FireIcon from "@/components/icons/FireIcon";
import BetPillButton from "../BetPillButton";
import PlayerAvatar from "../PlayerAvatar";
import RankBadge from "../RankBadge";

interface Props {
  /** 排名（按 implied_probability 降序，由父组件计算） */
  rank: number;
  /** 详情接口返回的 item */
  item: BannerItemDetail;
  /** Bet 按钮点击 — 父组件 add(selection) 到 betSlipStore */
  onBet: (item: BannerItemDetail, e: React.MouseEvent) => void;
  /**
   * H5 紧凑模式（343×69）
   * - true  → mobile layout：rank 14px plain / avatar 36px / flag 12px / name 14px Medium / fire 12px
   * - false → PC layout（默认，不变）
   *
   * Track A（BannerDetailView）在 H5 视口传 mobile={true}
   */
  mobile?: boolean;
}

/**
 * PlayerOddsCard：B3/B4/B5 详情页球员赔率卡
 *
 * PC  Figma：[3606:13492] 112h — rank(RankBadge 32) + 64 黄圆头像 + 24 旗角标 + name(16 bold) + 5🔥(16) + odds + Bet
 * H5  Figma：[3647:139047] 69h  — rank(14 bold plain) + 36 黄圆头像 + 12 旗角标 + name(14 medium) + 5🔥(12) + odds + Bet
 *
 * 注：
 * - DD-085 §1 范围外：B4 进度条 / B5 saves 文案 — 设计稿未给，本卡不渲染
 * - 头像 fallback：黄底 + 球员名首字母（Phase 3 后端 image_url CDN 就绪后切）
 * - 5🔥 静态全亮（fixture 无 heat 字段，Phase 3 后端补 heat 后切；2026-04-27 由 ⭐ 改 🔥）
 */
const HEAT_LEVEL = 5;
const HEATS = [1, 2, 3, 4, 5] as const;

export default function PlayerOddsCard({ rank, item, onBet, mobile = false }: Props) {
  if (mobile) {
    return (
      // H5: bg-secondary (#111114), rounded-[12px], px-3 py-4 gap-3
      // Figma 3647:139047: px-[12px] py-[16px] gap-[12px] rounded-[12px]
      <div
        className="flex items-center gap-3 rounded-[12px] bg-secondary px-3 py-4"
        data-figma-node="3647:139047"
      >
        {/* Left: rank + avatar group + name/heat */}
        <div className="flex shrink-0 items-center gap-2">
          {/* H5 rank: plain 14px Bold（Figma 显示数字 "1"，无奖杯图标） */}
          <span
            className="flex shrink-0 items-center justify-center text-[14px] font-bold leading-[19px] text-white"
            style={{ width: 20, height: 20 }}
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </span>

          {/* H5 avatar group: 36×36 circle + 12×12 flag */}
          <div className="relative flex items-center gap-3">
            {/* 36×36 黄圆头像（PlayerAvatar fallback initials） */}
            <PlayerAvatar name={item.name} size={36} fontSize={14} />

            {/* 12×12 国旗角标（Figma left:24/top:24，absolute on avatar group） */}
            {item.country_code && (
              <div className="absolute" style={{ left: 24, top: 24 }}>
                <CircleFlag code={item.country_code} size={12} className="block" />
              </div>
            )}

            {/* name (14px Medium) + 5🔥 (12px) */}
            <div className="flex flex-col justify-center gap-[6px]">
              <span className="text-[14px] font-medium leading-[19px] text-white">{item.name}</span>
              <div className="flex gap-0.5" aria-label={`Heat ${HEAT_LEVEL}`}>
                {HEATS.map((i) => (
                  <FireIcon key={i} size={12} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Odds pill (teal half-transparent) */}
        <div className="flex flex-1 items-center justify-end">
          <div
            className="flex shrink-0 items-center justify-center rounded-lg px-3 py-1 text-[14px] font-bold leading-[19px]"
            style={{
              // @figma-hardcoded: rgba(40,244,210,0.1) odds-pill-bg — pending design token
              backgroundColor: "rgba(40,244,210,0.1)",
              color: "#28f4d2",
            }}
          >
            {item.odds}x
          </div>
        </div>

        {/* Bet pill — H5 紧凑 padding-driven 11px（Figma 3647:139047 内 bet pill） */}
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
      data-figma-node="3606:13492"
    >
      <div className="flex shrink-0 items-center gap-5">
        <RankBadge rank={rank} />

        <div className="relative flex items-center gap-[15px]">
          {/* 64 黄圆头像 + 球员名首字母 fallback */}
          <PlayerAvatar name={item.name} size={64} fontSize={24} />

          {/* 24 国旗角标（绝对定位在头像右下，Figma 节点 3638:13575 left:41/top:40，size 24 含 2px 外框 → 内径 20） */}
          {item.country_code && (
            <div className="absolute" style={{ left: 41, top: 40 }}>
              <CircleFlag code={item.country_code} size={20} className="block" />
            </div>
          )}

          {/* name + 5🔥 热度 */}
          <div className="flex flex-col justify-center gap-2">
            <span className="text-[16px] font-bold leading-[24px] text-white">{item.name}</span>
            <div className="flex gap-1" aria-label={`Heat ${HEAT_LEVEL}`}>
              {HEATS.map((i) => (
                <FireIcon key={i} size={16} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Odds pill (teal half-transparent) — 右对齐 */}
      <div className="flex flex-1 items-center justify-end">
        <div
          className="flex h-8 items-center justify-center rounded-lg px-4 text-[14px] font-bold leading-[19px]"
          style={{
            // @figma-hardcoded: rgba(40,244,210,0.1) odds-pill-bg — pending design token
            backgroundColor: "rgba(40,244,210,0.1)",
            color: "#28f4d2",
          }}
        >
          {item.odds}x
        </div>
      </div>

      <BetPillButton onClick={(e) => onBet(item, e)} ariaLabel={`Bet on ${item.name}`} />
    </div>
  );
}
