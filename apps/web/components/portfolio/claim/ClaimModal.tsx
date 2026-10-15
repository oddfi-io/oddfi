"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { add, mul, div, formatDisplayAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import ClaimBetCard from "./ClaimBetCard";
import type { PortfolioBet } from "@/types/portfolio";

// ─── ClaimModal ──────────────────────────────────────────────────────────────
// Figma 2009:97462 — Claim Your Reward 弹窗（支持单注 Claim / 多注 Claim All）
// 行点击 claim → 传 [bet] 单注；Claim All 入口传整列表
// 点击按钮触发 onConfirm（由 useClaimFlow 接管 → 进入 signature 步骤），不直接调 API

const MODAL_CLASS = "!border-[#37393a] !backdrop-blur-none";
const MODAL_STYLE: React.CSSProperties = {
  background: "#111114",
  paddingBottom: "0",
};

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 待领奖的注单列表；null/[] 不渲染。单注传 `[bet]`，Claim All 传整列表 */
  bets: PortfolioBet[] | null;
  /** 点击 Claim/Claim All 按钮回调；由父级跳到 signature 步骤 */
  onConfirm?: () => void;
}

/**
 * DD-140 TB — 单注待领金额（税后净额）。
 * - void → 退款本金（无税）
 * - CLAIMED（已领）→ actual_payout 已在 claimAmount 中（adapter 优先取 actual_payout），直接用
 * - 待领取（WON/PUSH）→ 若有 payoutTaxBps，用 gross × (1 − bps/10000) 算税后净额；否则直接用 claimAmount
 * 禁止硬编码 5%，税率以 payoutTaxBps 字段为准，缺省兜底 500（5%）由 adapter 侧透传。
 */
function betDisplayAmount(bet: PortfolioBet): { token: string; usd: string } {
  const isVoid = bet.settlementStatus === "void";
  if (isVoid) {
    return { token: bet.betAmount, usd: bet.betAmountUsd };
  }
  const grossToken = bet.claimAmount ?? bet.potentialWin;
  const grossUsd = bet.claimAmountUsd ?? bet.potentialWinUsd;
  // 链上行且有税率时，gross 可能是税前 payout（actual_payout 未回填的 WON 行）；用 payoutTaxBps 算净额
  if (bet.isOnchain && bet.payoutTaxBps !== undefined) {
    const bps = bet.payoutTaxBps;
    const netToken = mul(grossToken, div(String(10000 - bps), "10000"));
    const netUsd = mul(grossUsd, div(String(10000 - bps), "10000"));
    return { token: netToken, usd: netUsd };
  }
  return { token: grossToken, usd: grossUsd };
}

function ClaimModal({ isOpen, onClose, bets, onConfirm }: ClaimModalProps) {
  const t = useTranslations("portfolio");
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;

  // 总待领金额（token / usd 各自累加，避免双重换算精度损失）
  // useMemo 必须在 early return 之前调用（Hook 规则）
  const { totalToken, totalUsd } = useMemo(
    () => ({
      totalToken: (bets ?? []).reduce((acc, b) => add(acc, betDisplayAmount(b).token), "0"),
      totalUsd: (bets ?? []).reduce((acc, b) => add(acc, betDisplayAmount(b).usd), "0"),
    }),
    [bets]
  );

  if (!bets || bets.length === 0) return null;

  const isMulti = bets.length > 1;
  const buttonLabel = isMulti ? t("claimAll") : t("claim");

  const handleConfirm = () => {
    onConfirm?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      className={MODAL_CLASS}
      containerStyle={MODAL_STYLE}
    >
      {/* 抵消 Modal 的 px-4/md:px-10 + pt-6，再叠 Figma 的 p-[40px] gap-32 */}
      <div className="-mx-4 md:-mx-10 -mt-6 p-[40px] flex flex-col gap-[32px]">
        {/* Title — Figma 2009:97463 */}
        <h2 className="text-[18px] font-semibold text-primary leading-[26px] text-center">
          {t("claimTitle")}
        </h2>

        {/* Congrats icon + amount summary — Figma 2009:97464 gap-16 */}
        <div className="flex flex-col items-center gap-[16px]">
          <Image
            src="/images/status/congrats.png"
            alt=""
            width={80}
            height={80}
            sizes="80px"
            className="object-contain"
          />
          {/* Figma: "You won " white + "X.XX ODD (≈$Y.YY)" green */}
          <p className="text-[18px] font-semibold leading-[26px] text-center">
            <span className="text-primary">{t("claimYouWon")} </span>
            <span className="text-fn-green">
              {showUsd
                ? `$${formatDisplayAmount(totalUsd)} USD`
                : `${formatDisplayAmount(totalToken)} ${PLATFORM_TOKEN_DISPLAY}`}
              {hasRate && (
                <>
                  {" (≈"}
                  {showUsd
                    ? `${formatDisplayAmount(totalToken)} ${PLATFORM_TOKEN_DISPLAY}`
                    : `$${formatDisplayAmount(totalUsd)}`}
                  {")"}
                </>
              )}
            </span>
          </p>
        </div>

        {/* Bet cards — Figma 2009:97467 gap-24 */}
        <div className="flex flex-col gap-[24px]">
          {bets.map((bet) => (
            <ClaimBetCard key={bet.id} bet={bet} />
          ))}
        </div>

        {/* Confirm button — Figma 2009:97474 */}
        <button
          onClick={handleConfirm}
          className="w-full h-[48px] rounded-12 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation"
        >
          {/* @figma-hardcoded: #04060c static-black — pending design token */}
          <span className="text-[14px] font-medium text-[#04060c]">{buttonLabel}</span>
        </button>
      </div>
    </Modal>
  );
}

export default memo(ClaimModal);
