"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { TeamVsAvatars } from "@/components/ui/TeamVsAvatars";
import { tagClasses } from "@/lib/bet-tag-classes";
import { translateMarketType } from "@/lib/market-type-i18n";
import { formatMatchTitle } from "@/lib/format/fixture";
import { formatDisplayAmount, mul, div } from "@/lib/decimal";
import { formatMatchTimeLocal } from "@/lib/format/relative-time";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import type { PortfolioBet } from "@/types/portfolio";

// ─── ClaimBetCard ────────────────────────────────────────────────────────────
// Figma 2009:97462 内嵌 frame 2003:93747 — claim modal 内的注单 row：
// 左：球队头像 + 比赛标题 + 时间 + market/selection/odds tag
// 右：状态 label（Win / Push / Void）+ payout 金额 + ≈$ 折算

function statusLabelKey(
  status: PortfolioBet["settlementStatus"]
): "resultWon" | "resultPush" | "resultVoid" {
  if (status === "void") return "resultVoid";
  if (status === "push") return "resultPush";
  return "resultWon";
}

interface ClaimBetCardProps {
  bet: PortfolioBet;
}

function ClaimBetCard({ bet }: ClaimBetCardProps) {
  const t = useTranslations("portfolio");
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;

  // void → 退款金额（无税）；won/push → 税后净额
  // DD-140 TB：链上行用 payoutTaxBps 算税后净额，缺省兜底 500（adapter 已透传）；链下行直接用 claimAmount
  const isVoid = bet.settlementStatus === "void";
  const grossToken = isVoid ? bet.betAmount : (bet.claimAmount ?? bet.potentialWin);
  const grossUsd = isVoid ? bet.betAmountUsd : (bet.claimAmountUsd ?? bet.potentialWinUsd);
  const { amount, amountUsd } = (() => {
    if (!isVoid && bet.isOnchain && bet.payoutTaxBps !== undefined) {
      const bps = bet.payoutTaxBps;
      return {
        amount: mul(grossToken, div(String(10000 - bps), "10000")),
        amountUsd: mul(grossUsd, div(String(10000 - bps), "10000")),
      };
    }
    return { amount: grossToken, amountUsd: grossUsd };
  })();

  return (
    <div className="border border-secondary rounded-16 px-[16px] py-[8px] flex items-center justify-between w-full">
      {/* 左：game info — Figma h-88 gap-16 */}
      <div className="flex gap-[16px] items-center min-w-0">
        <TeamVsAvatars home={bet.homeTeam} away={bet.awayTeam} />
        <div className="flex flex-col gap-[4px] min-w-0">
          <span className="text-[14px] font-semibold text-primary leading-[19px] truncate">
            {formatMatchTitle(bet.homeTeam.name, bet.awayTeam.name)}
          </span>
          <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
            {formatMatchTimeLocal(bet.matchTime)}
          </span>
          <div className="flex gap-[4px] items-center flex-wrap">
            <span
              className={`${tagClasses("market")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
            >
              {translateMarketType(bet.marketTag, t)}
            </span>
            <span
              className={`${tagClasses("selection")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
            >
              {bet.selectionTag}
            </span>
            <span
              className={`${tagClasses("odds")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
            >
              {bet.odds} x
            </span>
          </div>
        </div>
      </div>

      {/* 右：status + payout — Figma items-end gap-4 */}
      <div className="flex flex-col gap-[4px] items-end shrink-0">
        <span className="text-[14px] font-normal text-secondary leading-[19px]">
          {t(statusLabelKey(bet.settlementStatus))}
        </span>
        <span className="text-[14px] font-semibold text-fn-green leading-[19px]">
          {showUsd
            ? `$${formatDisplayAmount(amountUsd)} USD`
            : `${formatDisplayAmount(amount)} ${PLATFORM_TOKEN_DISPLAY}`}
        </span>
        {hasRate && (
          <span className="text-[12px] font-medium text-fn-green leading-[18px]">
            ≈{" "}
            {showUsd
              ? `${formatDisplayAmount(amount)} ${PLATFORM_TOKEN_DISPLAY}`
              : `$${formatDisplayAmount(amountUsd)}`}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(ClaimBetCard);
