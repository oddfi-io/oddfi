"use client";

import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { add, formatDisplayAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import type { PortfolioBet } from "@/types/portfolio";

// ─── ClaimSignatureModal ────────────────────────────────────────────────────
// Figma 2009:98042 — Signature request 弹窗
// Mock 流程：展示签名信息但不真的调起 EOA 钱包；后端真签名接入后再适配
// 内容：title + ODDFi brand + Message 卡（合规文案 + Read more）+ 网络费 / 你将获得 + T&C + Confirm

const MODAL_CLASS = "!border-[#37393a] !backdrop-blur-none";
const MODAL_STYLE: React.CSSProperties = {
  background: "#111114",
  paddingBottom: "0",
};

interface ClaimSignatureModalProps {
  isOpen: boolean;
  bets: PortfolioBet[];
  onClose: () => void;
  onBack: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

/** 单注待领金额：void → betAmount，其他 → claimAmount ?? potentialWin */
function betDisplayAmount(bet: PortfolioBet): string {
  const isVoid = bet.settlementStatus === "void";
  return isVoid ? bet.betAmount : (bet.claimAmount ?? bet.potentialWin);
}

function ClaimSignatureModal({
  isOpen,
  bets,
  onClose,
  onBack,
  onConfirm,
  loading = false,
}: ClaimSignatureModalProps) {
  const t = useTranslations("portfolio");

  // 总待领金额（mock 流程仅用于展示）
  const totalToken = useMemo(
    () => bets.reduce((acc, b) => add(acc, betDisplayAmount(b)), "0"),
    [bets]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      hideHeader
      className={MODAL_CLASS}
      containerStyle={MODAL_STYLE}
    >
      {/* 抵消 Modal 的 px-4/md:px-10 + pt-6，再叠 Figma 的 p-[40px] gap-24 */}
      <div className="-mx-4 md:-mx-10 -mt-6 p-[40px] flex flex-col gap-[24px]">
        {/* Title — Figma 2009:98049 */}
        <h2 className="text-[18px] font-semibold text-primary leading-[26px] text-center">
          {t("signatureTitle")}
        </h2>

        {/* ODDFi brand row — Figma 2009:98050 gap-12 */}
        <div className="flex items-center gap-[12px]">
          <TokenIconWithChain
            tokenIconUrl={PLATFORM_TOKEN.iconUrl}
            tokenSymbol={PLATFORM_TOKEN_DISPLAY}
            size={32}
            hideChainBadge
          />
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold text-primary leading-[19px]">ODDFi</span>
            <span className="text-[12px] font-medium text-tertiary leading-[18px]">ODDFi.org</span>
          </div>
        </div>

        {/* Fee + payout summary — Figma 2009:98065 */}
        <div className="flex flex-col gap-[8px]">
          {/* Row 1: BSC network fee */}
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-tertiary leading-[19px]">{t("networkFee")}</span>
            <span className="text-[14px] text-primary leading-[19px]">
              Average · 0.002 {PLATFORM_TOKEN_DISPLAY} ($0.001)
            </span>
          </div>
          {/* Row 2: 你将获得 (right amount 16px bold) */}
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-tertiary leading-[19px] border-b border-dashed border-tertiary">
              {t("youWillReceive")}
            </span>
            <span className="text-[16px] font-bold text-primary leading-[24px]">
              {formatDisplayAmount(totalToken)} {PLATFORM_TOKEN_DISPLAY}
            </span>
          </div>
        </div>

        {/* T&C + Confirm */}
        <div className="flex flex-col items-center gap-[16px]">
          <p className="text-[12px] text-tertiary leading-[18px]">
            {t("termsAgree")} <span className="text-white">{t("termsOfUse")}</span>
          </p>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full h-[48px] rounded-12 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {/* @figma-hardcoded: #04060c static-black — pending design token */}
            <span className="text-[14px] font-medium text-[#04060c] leading-[19px]">
              {t("confirm")}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default memo(ClaimSignatureModal);
