"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { formatAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { formatMatchTimeLocal } from "@/lib/format/relative-time";
import { tagClasses } from "@/lib/bet-tag-classes";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { translateMarketType } from "@/lib/market-type-i18n"; // @mock-market-type
import { formatMatchTitle } from "@/lib/format/fixture";
import TransactionActivityCell, { isNonBetBusinessType } from "./TransactionActivityCell";
import StatusCell from "./StatusCell";
import { TeamVsAvatars } from "@/components/ui/TeamVsAvatars";
import PortfolioBannerCell from "@/components/portfolio/bets/PortfolioBannerCell";
import OnchainBadge from "@/components/portfolio/bets/OnchainBadge";
import { activityColor, activityI18nKey, cashColor } from "@/lib/portfolio/transaction-display";
import type { TransactionRecord } from "@/types/portfolio";

// ─── TransactionRow (PC) ────────────────────────────────────────────────────
// Figma P3 [2006:94205] row [1692:86329]
// Columns: Activity (w-140) | Market (w-400) | Cash (flex-1) | Time (flex-1) | Status (flex-1)
// Activity/Cash 颜色与 i18n key 派生 → lib/portfolio/transaction-display.ts（与 H5 Card 共用单一源）

interface TransactionRowProps {
  tx: TransactionRecord;
  isLast?: boolean;
}

function TransactionRow({ tx, isLast = false }: TransactionRowProps) {
  const t = useTranslations("portfolio");
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;
  const amountColor = cashColor(tx.type, tx.isPositive);
  const prefix = tx.isPositive ? "+" : "-";
  const displayTime = useRelativeTime(tx.time);

  return (
    <div className={`${isLast ? "" : "border-b border-secondary"} flex items-center h-[120px]`}>
      {/* Activity column — Figma: w-140 px-24, Orbitron Bold uppercase */}
      <div className="w-[160px] shrink-0 px-[24px] flex items-center">
        <span
          className={`text-[14px] font-bold uppercase leading-normal ${activityColor(tx.type)}`}
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {t(activityI18nKey(tx.type))}
        </span>
      </div>

      {/* Market column — Figma: w-400 px-16
          · banner_single → PortfolioBannerCell（avatar + 标题 + 选项/赔率 tag）
          · 下注类（single/parlay）→ 队伍头像 + 比赛信息
          · 其余（deposit/withdraw/stake/lp/...）→ TransactionActivityCell 图标+文字
          · 例外：比赛池 Add LP 带赛事信息 → 只展示赛事信息，不再叠加图标+文字 */}
      <div className="flex gap-[16px] items-center px-[16px] w-[400px] shrink-0">
        {isNonBetBusinessType(tx.businessType) && !(tx.homeTeam && tx.awayTeam) && (
          <TransactionActivityCell businessType={tx.businessType} />
        )}
        {tx.banner ? (
          <PortfolioBannerCell bet={tx} avatarSize={48} />
        ) : (
          tx.homeTeam &&
          tx.awayTeam && (
            <>
              {/* @figma-hardcoded: #04060c team-border — pending design token */}
              <TeamVsAvatars home={tx.homeTeam} away={tx.awayTeam} />

              <div className="flex flex-col gap-[4px]">
                <span className="text-[14px] font-semibold text-primary leading-[19px]">
                  {formatMatchTitle(tx.homeTeam.name, tx.awayTeam.name)}
                </span>
                <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                  {formatMatchTimeLocal(tx.matchTime)}
                </span>
                {/* Tags */}
                <div className="flex gap-[4px] items-center">
                  {tx.marketTag && (
                    <span
                      className={`${tagClasses("market")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
                    >
                      {translateMarketType(tx.marketTag, t)}
                    </span>
                  )}
                  {tx.selectionTag && (
                    <span
                      className={`${tagClasses("selection")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
                    >
                      {tx.selectionTag}
                    </span>
                  )}
                  {tx.odds && (
                    <span
                      className={`${tagClasses("odds")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
                    >
                      {tx.odds} x
                    </span>
                  )}
                  {tx.isOnchain && <OnchainBadge />}
                </div>
              </div>
            </>
          )
        )}
      </div>

      {/* Cash column — signed amount, colored */}
      <div className="flex-1 px-[16px]">
        <div className="flex flex-col">
          <span className={`text-[14px] font-semibold leading-[19px] ${amountColor}`}>
            {prefix}
            {showUsd ? `$${formatAmount(tx.amountUsd)} ` : `${formatAmount(tx.amount)} `}
            <span className="text-tertiary">{showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY}</span>
          </span>
          {hasRate && (
            <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
              ≈
              {showUsd
                ? ` ${formatAmount(tx.amount)} ${PLATFORM_TOKEN_DISPLAY}`
                : ` $${formatAmount(tx.amountUsd)}`}
            </span>
          )}
        </div>
      </div>

      {/* Time column */}
      <div className="flex-1 px-[16px]">
        <span className="text-[14px] font-medium text-tertiary leading-[19px]">{displayTime}</span>
      </div>

      {/* Status column — 左对齐：所有状态文本起始 X 一致，失败行的 icon/dropdown inline 跟随 */}
      <div className="flex-1 px-[16px] flex items-center">
        <StatusCell status={tx.status} businessType={tx.businessType} align="start" />
      </div>
    </div>
  );
}

export default memo(TransactionRow);
