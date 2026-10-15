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
import OnchainBadge from "@/components/portfolio/bets/OnchainBadge";
import { activityColor, activityI18nKey, cashColor } from "@/lib/portfolio/transaction-display";
import type { TransactionRecord } from "@/types/portfolio";

// ─── TransactionCard (H5) ───────────────────────────────────────────────────
// Figma H7 [2116:118846] — mobile transaction card 343x210
// Border card style, 3 sections: header (match info) + row1 (activity/status) + row2 (cash/time)
// Activity/Cash 颜色与 i18n key 派生 → lib/portfolio/transaction-display.ts（与 PC Row 共用单一源）

interface TransactionCardProps {
  tx: TransactionRecord;
}

function TransactionCard({ tx }: TransactionCardProps) {
  const t = useTranslations("portfolio");
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;
  const amountColor = cashColor(tx.type, tx.isPositive);
  const prefix = tx.isPositive ? "+" : "-";
  const displayTime = useRelativeTime(tx.time);

  return (
    <div className="border border-secondary rounded-16 p-[16px] flex flex-col gap-[16px]">
      {/* Header: 非下注类 → ActivityCell；下注类 → 比赛信息 + tags
          例外：比赛池 Add LP 带赛事信息 → 只展示赛事信息，不再叠加图标+文字 */}
      {isNonBetBusinessType(tx.businessType) && !(tx.homeTeam && tx.awayTeam) && (
        <TransactionActivityCell businessType={tx.businessType} />
      )}
      {tx.homeTeam && tx.awayTeam && (
        <div className="flex flex-col gap-[4px]">
          <span className="text-[12px] font-bold text-primary leading-[18px]">
            {formatMatchTitle(tx.homeTeam.name, tx.awayTeam.name)}
          </span>
          <div className="flex gap-[4px] items-center flex-wrap">
            {tx.marketTag && (
              <span
                className={`${tagClasses("market")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
              >
                {translateMarketType(tx.marketTag, t)}
              </span>
            )}
            {tx.selectionTag && (
              <span
                className={`${tagClasses("selection")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
              >
                {tx.selectionTag}
              </span>
            )}
            {tx.odds && (
              <span
                className={`${tagClasses("odds")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
              >
                {tx.odds} x
              </span>
            )}
            {tx.isOnchain && <OnchainBadge />}
          </div>
          <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
            {formatMatchTimeLocal(tx.matchTime)}
          </span>
        </div>
      )}

      {/* Stats row 1: Activity / Status */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-[2px]">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colActivity")}
          </span>
          <span className={`text-[14px] font-bold leading-[19px] ${activityColor(tx.type)}`}>
            {t(activityI18nKey(tx.type))}
          </span>
        </div>
        <div className="flex flex-col gap-[2px] items-end">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colStatus")}
          </span>
          <StatusCell status={tx.status} businessType={tx.businessType} align="end" />
        </div>
      </div>

      {/* Stats row 2: Cash / Time */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-[2px]">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colCash")}
          </span>
          <div className="flex gap-[2px] items-start">
            <span className={`text-[14px] font-bold leading-[19px] ${amountColor}`}>
              {prefix}
              {showUsd ? `$${formatAmount(tx.amountUsd)} ` : `${formatAmount(tx.amount)} `}
              <span className="text-tertiary">{showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY}</span>
            </span>
            {hasRate && (
              <span className="text-[12px] font-normal text-secondary leading-[18px] opacity-50">
                ≈
                {showUsd
                  ? ` ${formatAmount(tx.amount)} ${PLATFORM_TOKEN_DISPLAY}`
                  : ` $${formatAmount(tx.amountUsd)}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-[2px] items-end">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colTime")}
          </span>
          <span className="text-[14px] font-normal text-primary leading-[19px]">{displayTime}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(TransactionCard);
