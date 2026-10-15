"use client";

import { memo, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { SpinnerIcon } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import { formatAmount } from "@/lib/decimal";
import { add } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { tagClasses } from "@/lib/bet-tag-classes";
import { translateMarketType } from "@/lib/market-type-i18n"; // @mock-market-type
import { formatMatchTitle } from "@/lib/format/fixture";
import { formatMatchTimeLocal } from "@/lib/format/relative-time";
import type { PortfolioBet } from "@/types/portfolio";

// ─── ClaimPendingModal (M3) ─────────────────────────────────────────────────
// Figma [2009:100096] — Same layout as ClaimModal but button shows "Claim Pending"
// Auto-transitions to success after mock delay (2s)

interface ClaimPendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  claimableBets: PortfolioBet[];
}

function ClaimPendingModal({ isOpen, onClose, onSuccess, claimableBets }: ClaimPendingModalProps) {
  const t = useTranslations("portfolio");
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;

  // Mock: auto-transition to success after 2s
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onSuccess, 2000);
    return () => clearTimeout(timer);
  }, [isOpen, onSuccess]);

  const { totalAmount, totalUsd } = useMemo(
    () => ({
      totalAmount: claimableBets.reduce(
        (sum, bet) => add(sum, bet.claimAmount ?? bet.potentialWin),
        "0"
      ),
      totalUsd: claimableBets.reduce(
        (sum, bet) => add(sum, bet.claimAmountUsd ?? bet.potentialWinUsd),
        "0"
      ),
    }),
    [claimableBets]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      className="!border-[var(--line-border-primary)]"
      containerStyle={{ background: "var(--fill-modal)" }}
    >
      <div className="flex flex-col items-center gap-[16px] pb-[8px]">
        {/* Trophy icon */}
        <div className="text-[48px]">🎉</div>

        {/* Title */}
        <h2 className="text-[18px] font-semibold text-primary leading-[26px]">
          {t("claimPendingTitle")}
        </h2>

        {/* Won amount */}
        <p className="text-[14px] text-secondary leading-[19px]">
          {t("claimYouWon")}{" "}
          <span className="font-bold text-fn-green">
            {showUsd
              ? `$${formatAmount(totalUsd)} USD`
              : `${formatAmount(totalAmount)} ${PLATFORM_TOKEN_DISPLAY}`}
          </span>
          {hasRate && (
            <span className="text-fn-green">
              {" "}
              (≈
              {showUsd
                ? `${formatAmount(totalAmount)} ${PLATFORM_TOKEN_DISPLAY}`
                : `$${formatAmount(totalUsd)}`}
              )
            </span>
          )}
        </p>

        {/* Claimable bet list */}
        <div className="flex flex-col gap-[8px] w-full max-h-[300px] overflow-y-auto">
          {claimableBets.map((bet) => (
            <div
              key={bet.id}
              className="flex items-center gap-[12px] p-[12px] rounded-12 bg-white/[0.04]"
            >
              <div className="relative w-[40px] h-[40px] shrink-0">
                <div className="absolute left-0 top-0 w-[30px] h-[30px] rounded-full bg-gradient-to-t from-[#f7fafc] to-[#d4dce3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bet.homeTeam.iconUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                {/* @figma-hardcoded: #04060c team-border — pending design token */}
                <div className="absolute bottom-0 right-0 w-[30px] h-[30px] rounded-full bg-gradient-to-t from-[#f7fafc] to-[#d4dce3] border-[2px] border-[#04060c] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bet.awayTeam.iconUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-primary leading-[18px] truncate">
                  {formatMatchTitle(bet.homeTeam.name, bet.awayTeam.name)}
                </p>
                <p className="text-[11px] text-secondary leading-[16px] opacity-50">
                  {formatMatchTimeLocal(bet.matchTime)}
                </p>
                <div className="flex gap-[4px] items-center mt-[2px]">
                  <span
                    className={`${tagClasses("market")} h-[20px] px-[6px] py-[1px] rounded-8 text-[10px] font-medium leading-[14px] flex items-center`}
                  >
                    {translateMarketType(bet.marketTag, t)}
                  </span>
                  <span
                    className={`${tagClasses("selection")} h-[20px] px-[6px] py-[1px] rounded-8 text-[10px] font-medium leading-[14px] flex items-center`}
                  >
                    {bet.selectionTag}
                  </span>
                  <span
                    className={`${tagClasses("odds")} h-[20px] px-[6px] py-[1px] rounded-8 text-[10px] font-medium leading-[14px] flex items-center`}
                  >
                    {bet.odds} x
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[11px] text-secondary leading-[16px]">{t("resultWon")}</span>
                <span className="text-[14px] font-bold text-fn-green leading-[19px]">
                  {showUsd
                    ? `$${formatAmount(bet.claimAmountUsd ?? bet.potentialWinUsd)} USD`
                    : `${formatAmount(bet.claimAmount ?? bet.potentialWin)} ${PLATFORM_TOKEN_DISPLAY}`}
                </span>
                {hasRate && (
                  <span className="text-[11px] text-secondary leading-[16px] opacity-50">
                    (≈
                    {showUsd
                      ? `${formatAmount(bet.claimAmount ?? bet.potentialWin)} ${PLATFORM_TOKEN_DISPLAY}`
                      : `$${formatAmount(bet.claimAmountUsd ?? bet.potentialWinUsd)}`}
                    )
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Claim Pending button (disabled) */}
        <button
          disabled
          className="w-full h-[48px] rounded-12 bg-white/20 text-[16px] font-semibold leading-[24px] flex items-center justify-center gap-[8px] cursor-not-allowed min-h-[44px]"
        >
          <span className="text-secondary">{t("claimPendingBtn")}</span>
          <SpinnerIcon size={16} className="text-secondary animate-spin" />
        </button>
      </div>
    </Modal>
  );
}

export default memo(ClaimPendingModal);
