"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { formatAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { formatAbsoluteDateTime, formatMatchTimeLocal } from "@/lib/format/relative-time";
import { tagClasses } from "@/lib/bet-tag-classes";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { translateMarketType } from "@/lib/market-type-i18n"; // @mock-market-type
import { formatMatchTitle } from "@/lib/format/fixture";
import PlayerAvatar from "@/components/banner-detail/PlayerAvatar";
import OnchainBadge from "@/components/portfolio/bets/OnchainBadge";
import {
  statusColor,
  statusI18nKey,
  claimButtonKey,
  payoutDisplay,
} from "@/lib/portfolio/settle-display";
import type { PortfolioBet } from "@/types/portfolio";

// SettledBetCard (H5) — Figma H6 [2116:118162]
// 4 个状态派生 helper 在 PC / H5 共用，统一从 lib/portfolio/settle-display 导入。

interface SettledBetCardProps {
  bet: PortfolioBet;
  onClaim?: (bet: PortfolioBet) => void;
}

function SettledBetCard({ bet, onClaim }: SettledBetCardProps) {
  const t = useTranslations("portfolio");
  const color = statusColor(bet.settlementStatus);
  const payout = payoutDisplay(bet);
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;
  const settledTimeText = formatAbsoluteDateTime(bet.settledAt);
  const primaryVal = showUsd ? payout.usd : payout.amount;
  const primaryUnit = showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY;
  const primaryPrefixSign = showUsd ? "$" : "";
  const secondaryVal = showUsd ? payout.amount : payout.usd;
  const secondaryUnit = showUsd ? PLATFORM_TOKEN_DISPLAY : "USD";
  const secondaryPrefix = showUsd ? "" : "$";

  // 多单子行（viewOnly）只展示，不可 claim（DD-087 §3.2）
  const showClaimBtn = bet.claimable && !bet.viewOnly;

  return (
    <div className="border border-divider rounded-16 p-[16px] flex flex-col gap-[16px]">
      {/* Header: match name + tags + time (banner 流水换为 avatar + 标题 + 2 tag) */}
      {bet.banner ? (
        <div className="flex items-center gap-[8px] min-w-0">
          <PlayerAvatar name={bet.selectionTag} size={32} fontSize={12} className="shrink-0" />
          <div className="flex flex-col gap-[4px] min-w-0">
            <span className="text-[12px] font-bold text-primary leading-[18px] truncate">
              {bet.banner.title}
            </span>
            <div className="flex gap-[4px] items-center flex-wrap">
              <span
                className={`${tagClasses("selection")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
              >
                {bet.selectionTag}
              </span>
              <span
                className={`${tagClasses("odds")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
              >
                {bet.odds} x
              </span>
              {bet.isOnchain && <OnchainBadge />}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[4px]">
          <span className="text-[12px] font-bold text-primary leading-[18px]">
            {formatMatchTitle(bet.homeTeam.name, bet.awayTeam.name)}
          </span>
          {/* Tags — Figma H6: h-24 px-6 rounded-8 text-11 */}
          <div className="flex gap-[4px] items-center flex-wrap">
            <span
              className={`${tagClasses("market")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
            >
              {translateMarketType(bet.marketTag, t)}
            </span>
            <span
              className={`${tagClasses("selection")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
            >
              {bet.selectionTag}
            </span>
            <span
              className={`${tagClasses("odds")} h-[24px] px-[6px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
            >
              {bet.odds} x
            </span>
            {bet.isOnchain && <OnchainBadge />}
          </div>
          <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
            {formatMatchTimeLocal(bet.matchTime)}
          </span>
        </div>
      )}

      {/* Stats row: Result / Payout / Bet time */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-[2px]">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colResultH5")}
          </span>
          <span className={`text-[14px] font-bold leading-[19px] ${color}`}>
            {t(statusI18nKey(bet.settlementStatus))}
          </span>
        </div>
        <div className="flex flex-col gap-[2px]">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colPayoutSettled")}
          </span>
          <span className={`text-[14px] font-bold leading-[19px] ${color}`}>
            {payout.prefix}
            {primaryPrefixSign}
            {formatAmount(primaryVal)} {primaryUnit}
          </span>
          {hasRate && (
            <span className="text-[12px] font-normal text-secondary leading-[18px] opacity-50">
              ≈ {secondaryPrefix}
              {formatAmount(secondaryVal)} {secondaryUnit}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-[2px] items-end">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colSettledTime")}
          </span>
          <span className="text-[14px] font-normal text-primary leading-[19px]">
            {settledTimeText || "—"}
          </span>
        </div>
      </div>

      {/* Claim button：lost 隐藏，won/push → "Claim Winnings"，void → "Claim Refund"（DD-087 §3.2） */}
      {showClaimBtn && (
        <button
          onClick={() => onClaim?.(bet)}
          className="w-full flex items-center justify-center min-h-[44px] rounded-8 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] touch-manipulation"
        >
          {/* @figma-hardcoded: #04060c static-black — pending design token */}
          <span className="text-[14px] font-medium text-[#04060c] leading-[19px]">
            {t(claimButtonKey(bet.settlementStatus))}
          </span>
        </button>
      )}
    </div>
  );
}

export default memo(SettledBetCard);
