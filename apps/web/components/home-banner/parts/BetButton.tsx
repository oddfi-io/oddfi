"use client";

import type { BannerItem, TemplateId } from "@/types/home-banner";

interface BetButtonProps {
  /** banner item — 保留 props 以兼容 OddsRow 调用方 */
  item: BannerItem;
  /** template_id — 保留 props 以兼容 OddsRow 调用方 */
  templateId: TemplateId;
  /** banner_id 短 ID — 保留 props 以兼容 OddsRow 调用方 */
  bannerId: string;
  label?: string;
  /** 渐变 background 字符串。默认 夺冠盘 黄绿渐变 */
  gradient?: string;
  /** 文字色。默认深色（匹配黄绿底） */
  textColor?: string;
}

/**
 * 赔率行 Bet 按钮（Figma 3108:44140）
 *
 * 68×30 rounded-full，渐变可定制
 * Figma 默认（夺冠盘）：黄绿渐变 rgb(255,227,48) → rgb(203,226,0)，深色文字 #060724
 * 金球 可覆盖为橙渐变 rgb(255,124,43) → rgb(255,192,34)
 * 金靴 / 金手套 此按钮不渲染（banner 内部控制）
 *
 * 体验调整：卡片上的 Bet 按钮不再触发 addSelection。
 * 点击事件自然冒泡到 ScaledBannerCard，触发跳转到 banner 详情页，
 * 让用户在详情页内完成下注。
 */
export default function BetButton({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  item: _item,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  templateId: _templateId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bannerId: _bannerId,
  label = "Bet",
  // @figma-hardcoded: rgb(255,227,48) → rgb(203,226,0) bet-btn-b1-gradient — pending design token
  gradient = "linear-gradient(106.898deg, rgb(255, 227, 48) 6.8116%, rgb(203, 226, 0) 94.857%)",
  // @figma-hardcoded: #060724 bet-btn-text — pending design token
  textColor = "#060724",
}: BetButtonProps) {
  return (
    <button
      type="button"
      className="font-noto-sc flex flex-shrink-0 items-center justify-center rounded-full px-6 py-1 font-bold"
      style={{
        fontSize: 12,
        color: textColor,
        background: gradient,
      }}
    >
      {label}
    </button>
  );
}
