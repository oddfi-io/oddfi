"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { formatDisplayAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { tagClasses } from "@/lib/bet-tag-classes";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { formatMatchTimeLocal } from "@/lib/format/relative-time";
import { translateMarketType } from "@/lib/market-type-i18n"; // @mock-market-type
import { formatMatchTitle } from "@/lib/format/fixture";
import CashoutModal from "@/components/portfolio/cashout/CashoutModal";
import PlayerAvatar from "@/components/banner-detail/PlayerAvatar";
import OnchainBadge from "@/components/portfolio/bets/OnchainBadge";
import type { PortfolioBet } from "@/types/portfolio";

// ─── ActiveBetCard (H5) ─────────────────────────────────────────────────────
// Figma node 2116:117323 — game-card/h5, pixel-perfect H5 active bet card

interface ActiveBetCardProps {
  bet: PortfolioBet;
}

function ActiveBetCard({ bet }: ActiveBetCardProps) {
  const t = useTranslations("portfolio");
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;
  const betPrimary = showUsd
    ? `$${formatDisplayAmount(bet.betAmountUsd)} USD`
    : `${formatDisplayAmount(bet.betAmount)} ${PLATFORM_TOKEN_DISPLAY}`;
  const betSecondary = showUsd
    ? `${formatDisplayAmount(bet.betAmount)} ${PLATFORM_TOKEN_DISPLAY}`
    : `$${formatDisplayAmount(bet.betAmountUsd)}`;
  const winPrimary = showUsd
    ? `$${formatDisplayAmount(bet.potentialWinUsd)} USD`
    : `${formatDisplayAmount(bet.potentialWin)} ${PLATFORM_TOKEN_DISPLAY}`;
  const winSecondary = showUsd
    ? `${formatDisplayAmount(bet.potentialWin)} ${PLATFORM_TOKEN_DISPLAY}`
    : `$${formatDisplayAmount(bet.potentialWinUsd)}`;

  const isFailed = bet.settlementStatus === "failed";
  const relativeTime = useRelativeTime(bet.createdAt);

  // 比赛标题：Multi 展示 "N Leg Multi"，否则展示 "Home VS Away"
  const matchTitle =
    bet.isMulti && bet.legCount != null
      ? `${bet.legCount} Leg Multi`
      : formatMatchTitle(bet.homeTeam.name, bet.awayTeam.name);

  return (
    // @figma-hardcoded: #212124 card-border — pending design token
    <div className="border border-[#212124] rounded-16 p-[16px] flex flex-col gap-[16px] w-full">
      {/* ── Header: tags + match title + match time + right-side action ── */}
      <div className="flex items-start justify-between gap-[8px]">
        {bet.banner ? (
          // Banner 流水：左侧 avatar + 上下结构（banner 标题 + 选项/赔率 tag）
          <div className="flex items-center gap-[8px] min-w-0">
            <PlayerAvatar name={bet.selectionTag} size={32} fontSize={12} className="shrink-0" />
            <div className="flex flex-col gap-[4px] min-w-0">
              <span className="text-[14px] font-bold text-primary leading-[19px] truncate">
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
          // Left: match name → tags → match time (Figma order)
          <div className="flex flex-col gap-[4px] min-w-0">
            {/* Match name */}
            <span className="text-[14px] font-bold text-primary leading-[19px] truncate">
              {matchTitle}
            </span>

            {/* Tags */}
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

            {/* Match time */}
            <span className="text-[12px] font-medium text-secondary opacity-50 leading-[18px]">
              {formatMatchTimeLocal(bet.matchTime)}
            </span>
          </div>
        )}

        {/* Right: Cash out button / Failed state / View button */}
        {isFailed ? (
          // Failed 状态：红色文字 + WarningCircle 图标
          <div className="flex items-center gap-[4px] shrink-0">
            <span className="text-[14px] font-bold text-fn-red leading-[19px]">
              {t("statusFailed")}
            </span>
            <WarningCircleIcon size={16} className="text-fn-red" />
          </div>
        ) : bet.cashoutState === "cashing_out" ? (
          // ENH-038 · 正在取消（cash_out_state=cashing_out）：复用 Cancel 视觉，禁用 + 文案切换
          <button
            disabled
            className="flex items-center justify-center shrink-0 min-h-[44px] opacity-60 cursor-not-allowed"
          >
            {/* @figma-hardcoded: #04060c cancel-btn-text — pending design token */}
            <span className="flex items-center justify-center h-[32px] px-[12px] rounded-8 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
              <span className="text-[12px] font-medium text-[#04060c] leading-[18px]">
                {t("cancelling")}
              </span>
            </span>
          </button>
        ) : bet.cashoutAvailable ? (
          // 白色主按钮 Cancel — DD-087 §4.2
          <button
            onClick={() => setCashoutOpen(true)}
            className="flex items-center justify-center shrink-0 min-h-[44px] touch-manipulation"
          >
            {/* @figma-hardcoded: #04060c cancel-btn-text — pending design token */}
            <span className="flex items-center justify-center h-[32px] px-[12px] rounded-8 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
              <span className="text-[12px] font-medium text-[#04060c] leading-[18px]">
                {t("cancelBet")}
              </span>
            </span>
          </button>
        ) : bet.viewOnly ? (
          // 深色次按钮 View — Figma node 2116:117533
          <button className="flex items-center justify-center shrink-0 min-h-[44px] touch-manipulation">
            {/* @figma-hardcoded: #212124 view-btn-bg — pending design token */}
            <span className="flex items-center justify-center h-[32px] px-[12px] rounded-8 bg-[#212124] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
              <span className="text-[12px] font-medium text-primary leading-[18px]">
                {t("btnView")}
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {/* ── Stats row: Bet / Potential payout / Settle time ── */}
      <div className="flex items-start">
        {/* Bet — viewOnly 卡片显示 "—"（Figma node 2116:117560） */}
        <div className="flex-1 flex flex-col gap-[2px]">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colBet")}
          </span>
          <span className="text-[14px] font-bold text-primary leading-[19px]">
            {bet.viewOnly ? "—" : betPrimary}
          </span>
          {!bet.viewOnly && hasRate && (
            <span className="text-[12px] font-normal text-secondary opacity-50 leading-[18px]">
              ≈ {betSecondary}
            </span>
          )}
          {/* 链上部分成交退回（红灯撮合）：betAmount 已是真实成交本金，此处补退回量 */}
          {!bet.viewOnly && bet.refundAmount && (
            <span className="text-[12px] font-normal text-secondary leading-[18px]">
              {t("partialRefund", {
                amount: `${formatDisplayAmount(bet.refundAmount)} ${PLATFORM_TOKEN_DISPLAY}`,
              })}
            </span>
          )}
        </div>

        {/* Potential payout — viewOnly 卡片显示 "—" */}
        <div className="flex-1 flex flex-col gap-[2px]">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colPayout")}
          </span>
          <span className="text-[14px] font-bold text-primary leading-[19px]">
            {bet.viewOnly ? "—" : winPrimary}
          </span>
          {!bet.viewOnly && hasRate && (
            <span className="text-[12px] font-normal text-secondary opacity-50 leading-[18px]">
              ≈ {winSecondary}
            </span>
          )}
        </div>

        {/* Settle time — 右对齐，items-end */}
        <div className="flex-1 flex flex-col gap-[2px] items-end text-right">
          <span className="text-[12px] font-normal text-tertiary leading-[18px]">
            {t("colBetTime")}
          </span>
          <span className="text-[14px] font-normal text-primary leading-[19px]">
            {relativeTime || "—"}
          </span>
        </div>
      </div>

      {/* Cashout modal */}
      {bet.cashoutAvailable && (
        <CashoutModal isOpen={cashoutOpen} onClose={() => setCashoutOpen(false)} bet={bet} />
      )}
    </div>
  );
}

export default memo(ActiveBetCard);
