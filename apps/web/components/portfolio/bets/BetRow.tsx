"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { CaretDownIcon, QuestionIcon } from "@phosphor-icons/react";
import { formatDisplayAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { tagClasses } from "@/lib/bet-tag-classes";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { formatMatchTimeLocal } from "@/lib/format/relative-time";
import { translateMarketType } from "@/lib/market-type-i18n"; // @mock-market-type
import { formatMatchTitle } from "@/lib/format/fixture";
import CashoutModal from "@/components/portfolio/cashout/CashoutModal";
import { TeamVsAvatars } from "@/components/ui/TeamVsAvatars";
import PortfolioBannerCell from "./PortfolioBannerCell";
import OnchainBadge from "./OnchainBadge";
import type { PortfolioBet } from "@/types/portfolio";

// ─── BetRow (PC) ─────────────────────────────────────────────────────────────
// Figma C5 [1689:80484]: border-b border-secondary, py-16
// Columns: Market (w-444) | Bet (flex-1) | Potential payout (flex-1) | Settle time (flex-1) | Actions (flex-1)

interface BetRowProps {
  bet: PortfolioBet;
  isLast?: boolean;
}

function BetRow({ bet, isLast }: BetRowProps) {
  const t = useTranslations("portfolio");
  const [expanded, setExpanded] = useState(false);
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const isFailed = bet.settlementStatus === "failed";
  const isMulti = bet.isMulti && bet.legs && bet.legs.length > 0;
  const isViewOnly = bet.viewOnly;
  // Failed and viewOnly rows show "--" for bet/payout
  const showDash = isFailed || isViewOnly;
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;
  const settleTime = useRelativeTime(bet.createdAt);

  return (
    <>
      {/* Main row — 最后一行（非多腿展开）不加下边框，避免与外框双线 */}
      <div
        className={`${isLast && !(isMulti && expanded) ? "" : "border-b border-secondary"} flex items-center h-[120px] py-[16px] ${isMulti ? "cursor-pointer" : ""}`}
        onClick={isMulti ? () => setExpanded(!expanded) : undefined}
      >
        {/* Market column — Figma: w-444 gap-20 */}
        <div className="flex gap-[20px] items-center px-[16px] w-[444px] shrink-0 h-full">
          {/* Chevron for multi-leg */}
          {isMulti ? (
            <div className="shrink-0 w-[24px] h-[24px] flex items-center justify-center">
              <CaretDownIcon
                size={24}
                weight="bold"
                className={`text-primary transition-transform ${expanded ? "-scale-y-100" : ""}`}
              />
            </div>
          ) : null}

          {bet.banner ? (
            // Figma 3471:72197 — banner 流水行 Market 列：avatar fallback + banner 标题 + 2 tag
            <PortfolioBannerCell bet={bet} avatarSize={48} />
          ) : (
            <>
              {/* @figma-hardcoded: #04060c team-border — pending design token */}
              <TeamVsAvatars home={bet.homeTeam} away={bet.awayTeam} />

              {/* Match info */}
              <div className="flex flex-col gap-[4px]">
                <span className="text-[14px] font-semibold text-primary leading-[19px]">
                  {isMulti
                    ? `${bet.legCount} Leg Multi`
                    : formatMatchTitle(bet.homeTeam.name, bet.awayTeam.name)}
                </span>
                {!isMulti && (
                  <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                    {formatMatchTimeLocal(bet.matchTime)}
                  </span>
                )}
                {/* Tags — multi-leg parent only shows odds */}
                <div className="flex gap-[8px] items-center">
                  {!isMulti && (
                    <>
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
                    </>
                  )}
                  <span
                    className={`${tagClasses("odds")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
                  >
                    {bet.odds} x
                  </span>
                  {bet.isOnchain && <OnchainBadge />}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bet column — Figma: flex-1 px-16 */}
        <div className="flex-1 px-[16px]">
          {showDash ? (
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-primary leading-[19px]">--</span>
              <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                --
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-primary leading-[19px]">
                {showUsd
                  ? `$${formatDisplayAmount(bet.betAmountUsd)}`
                  : formatDisplayAmount(bet.betAmount)}{" "}
                <span className="text-tertiary">{showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY}</span>
              </span>
              {hasRate && (
                <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                  ≈{" "}
                  {showUsd
                    ? `${formatDisplayAmount(bet.betAmount)} ${PLATFORM_TOKEN_DISPLAY}`
                    : `$${formatDisplayAmount(bet.betAmountUsd)}`}
                </span>
              )}
              {/* 链上部分成交退回（红灯撮合）：betAmount 已是真实成交本金，此处补退回量 */}
              {bet.refundAmount && (
                <span className="text-[12px] font-medium text-secondary leading-[18px] whitespace-nowrap">
                  {t("partialRefund", {
                    amount: `${formatDisplayAmount(bet.refundAmount)} ${PLATFORM_TOKEN_DISPLAY}`,
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Potential payout column — Figma: flex-1 px-16 */}
        <div className="flex-1 px-[16px]">
          {showDash ? (
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-primary leading-[19px]">--</span>
              <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                --
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-primary leading-[19px]">
                {showUsd
                  ? `$${formatDisplayAmount(bet.potentialWinUsd)}`
                  : formatDisplayAmount(bet.potentialWin)}{" "}
                <span className="text-tertiary">{showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY}</span>
              </span>
              {hasRate && (
                <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                  ≈{" "}
                  {showUsd
                    ? `${formatDisplayAmount(bet.potentialWin)} ${PLATFORM_TOKEN_DISPLAY}`
                    : `$${formatDisplayAmount(bet.potentialWinUsd)}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Settle time column — Figma: 14px medium text-tertiary */}
        <div className="flex-1 px-[16px]">
          <span className="text-[14px] font-medium text-tertiary leading-[19px]">
            {settleTime || "—"}
          </span>
        </div>

        {/* Actions column — Figma: flex-1 px-16, right-aligned */}
        <div className="flex-1 px-[16px] flex items-center justify-end gap-[16px]">
          {isFailed && (
            <div className="flex items-center gap-[4px]">
              <span className="text-[16px] font-normal text-fn-red leading-[24px]">Failed</span>
              <QuestionIcon size={20} weight="fill" className="text-fn-red" />
            </div>
          )}
          {isViewOnly && (
            <button className="flex items-center justify-center min-h-[44px] touch-manipulation">
              <span className="flex items-center justify-center h-[32px] px-[12px] rounded-8 bg-tertiary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                <span className="text-[12px] font-medium text-primary leading-[18px]">View</span>
              </span>
            </button>
          )}
          {bet.cashoutAvailable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCashoutOpen(true);
              }}
              className="flex items-center justify-center min-h-[44px] touch-manipulation"
            >
              <span className="flex items-center justify-center h-[32px] w-[80px] px-[12px] rounded-8 bg-tertiary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                <span className="text-[12px] font-medium text-primary leading-[18px]">
                  {t("cancelBet")}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-leg sub-rows — expanded */}
      {isMulti &&
        expanded &&
        bet.legs!.map((leg) => (
          <div
            key={leg.id}
            className="border-b border-secondary flex items-center h-[120px] py-[16px] bg-white/[0.02]"
          >
            {/* Market column — indented with 24px spacer for chevron alignment */}
            <div className="flex gap-[20px] items-center px-[16px] w-[444px] shrink-0 h-full">
              {/* Spacer matching chevron width */}
              <div className="shrink-0 w-[24px]" />

              {/* @figma-hardcoded: #04060c team-border — pending design token */}
              <TeamVsAvatars home={leg.homeTeam} away={leg.awayTeam} />

              {/* Match info */}
              <div className="flex flex-col gap-[4px]">
                <span className="text-[14px] font-semibold text-primary leading-[19px]">
                  {formatMatchTitle(leg.homeTeam.name, leg.awayTeam.name)}
                </span>
                <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                  {formatMatchTimeLocal(leg.matchTime)}
                </span>
                {/* Tags */}
                <div className="flex gap-[8px] items-center">
                  <span
                    className={`${tagClasses("market")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
                  >
                    {translateMarketType(leg.marketTag, t)}
                  </span>
                  <span
                    className={`${tagClasses("selection")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
                  >
                    {leg.selectionTag}
                  </span>
                  <span
                    className={`${tagClasses("odds")} h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center`}
                  >
                    {leg.odds} x
                  </span>
                  {leg.isOnchain && <OnchainBadge />}
                </div>
              </div>
            </div>

            {/* Bet column — sub-leg shows "--" */}
            <div className="flex-1 px-[16px]">
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-primary leading-[19px]">--</span>
                <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                  --
                </span>
              </div>
            </div>

            {/* Potential payout column — sub-leg shows "--" */}
            <div className="flex-1 px-[16px]">
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-primary leading-[19px]">--</span>
                <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
                  --
                </span>
              </div>
            </div>

            {/* Settle time column — parlay 整体共享一个下注时间，leg 沿用父级 */}
            <div className="flex-1 px-[16px]">
              <span className="text-[14px] font-medium text-tertiary leading-[19px]">
                {settleTime || "—"}
              </span>
            </div>

            {/* Actions column — View button */}
            <div className="flex-1 px-[16px] flex items-center justify-end">
              <button className="flex items-center justify-center min-h-[44px] touch-manipulation">
                <span className="flex items-center justify-center h-[32px] px-[12px] rounded-8 bg-tertiary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                  <span className="text-[12px] font-medium text-primary leading-[18px]">View</span>
                </span>
              </button>
            </div>
          </div>
        ))}

      {/* Cashout modal */}
      {bet.cashoutAvailable && (
        <CashoutModal isOpen={cashoutOpen} onClose={() => setCashoutOpen(false)} bet={bet} />
      )}
    </>
  );
}

export default memo(BetRow);
