"use client";

/**
 * MoneylineTeaser — Moneyline panel 底部 AI 解读文字条。
 *
 * Figma 节点：5107:182733 / 5107:182734
 * 布局：左侧 AiInsightIcon 32px（含 coin + ✨ 徽章）+ 右侧 AI 解读文本（text-tertiary）。
 * 文案：i18n 模板，占位符 {teamCode} {userBetPct} {impliedPct} {odds}。
 */

import { useTranslations } from "next-intl";
import AiInsightIcon from "@/components/icons/AiInsightIcon";
import type { TeaserStats } from "@/types/moneyline";

interface Props {
  stats: TeaserStats;
}

export default function MoneylineTeaser({ stats }: Props) {
  const t = useTranslations("markets");

  return (
    <div className="flex items-center gap-[7px] w-full" data-figma-node="5107:182733">
      <div className="shrink-0">
        <AiInsightIcon size={32} />
      </div>

      <p className="text-[12px] leading-[18px] text-tertiary flex-1">
        {t("moneylineTeaser", {
          teamCode: stats.teamCode,
          userBetPct: stats.userBetPct,
          impliedPct: stats.impliedPct,
          odds: stats.odds,
        })}
      </p>
    </div>
  );
}
