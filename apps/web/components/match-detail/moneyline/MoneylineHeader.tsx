"use client";

/**
 * MoneylineHeader — Moneyline panel 顶部标题行 + 三方胜负平 legend。
 *
 * Figma 节点：5107:182711
 * 布局：左侧 "Moneyline" 标题，右侧三个 legend 项。
 * Home / Away 用 SportIcon 渲染队徽；Draw 用 #212124 圆形占位 + 内嵌符号。
 */

import { useTranslations } from "next-intl";
import SportIcon from "@/components/ui/SportIcon";

interface Props {
  homeShortCode: string;
  awayShortCode: string;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  homePct: number;
  drawPct: number;
  awayPct: number;
  homeColor: string;
  drawColor: string;
  awayColor: string;
}

function DrawDot() {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: 20,
        height: 20,
        // @figma-hardcoded: #212124 draw-legend-bg — pending design token
        backgroundColor: "#212124",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6h8" stroke="#8b8d93" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LegendItem({
  shortCode,
  pct,
  color,
  logo,
  name,
  variant,
}: {
  shortCode: string;
  pct: number;
  color: string;
  logo?: string;
  name?: string;
  variant: "team" | "draw";
}) {
  return (
    <div className="flex items-center gap-[4px]">
      {variant === "draw" ? (
        <DrawDot />
      ) : logo ? (
        <SportIcon src={logo} alt={name ?? shortCode} size={20} withBg />
      ) : (
        // 兜底：无 logo 时降级为色块
        <span
          className="inline-block size-[20px] rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      <span className="text-[12px] leading-[18px] text-secondary whitespace-nowrap">
        {shortCode}
      </span>
      <span
        className="text-[12px] leading-[18px] font-semibold whitespace-nowrap"
        style={{ color }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default function MoneylineHeader({
  homeShortCode,
  awayShortCode,
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  homePct,
  drawPct,
  awayPct,
  homeColor,
  drawColor,
  awayColor,
}: Props) {
  const t = useTranslations("markets");

  return (
    <div className="flex items-center justify-between w-full" data-figma-node="5107:182711">
      <span className="text-[14px] leading-[18px] font-semibold text-primary whitespace-nowrap">
        {t("moneylineTitle")}
      </span>

      <div className="flex items-center gap-[12px]">
        <LegendItem
          variant="team"
          shortCode={homeShortCode}
          pct={homePct}
          color={homeColor}
          logo={homeLogo}
          name={homeName}
        />
        <LegendItem
          variant="team"
          shortCode={awayShortCode}
          pct={awayPct}
          color={awayColor}
          logo={awayLogo}
          name={awayName}
        />
        <LegendItem variant="draw" shortCode={t("moneylineDraw")} pct={drawPct} color={drawColor} />
      </div>
    </div>
  );
}
