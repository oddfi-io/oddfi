"use client";

import { memo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { XCircleIcon } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { formatAmount } from "@/lib/decimal";
import type { WithdrawApplyRes } from "@/types/auth";
import type { WithdrawErrorKey } from "@/hooks/useWithdrawTx";

// ─── WithdrawResultModal (DD-080) ─────────────────────────────────────────────
// Figma [3371:62396] success / [3371:46840] failed — 提现最终态
// 卡片：border-secondary 无填充；info 行 14px；Receive Address 行前置 BSC 链图标

const GAS_ICON = "/icons/gas.svg";
// V1 仅支持 BSC；DEFAULT_CHAIN_META 改动时同步替换
const CHAIN_ICON = "/images/chains/bsc.svg";

// fee/real_amount 来自 /withdraw/apply 响应；priceImpact/maxSlippage 非接口字段
const WITHDRAW_QUOTE_STATIC = {
  priceImpact: "0.48%",
  maxSlippage: "Auto · 0.78%",
} as const;

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "--";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface WithdrawResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToHistory: () => void;
  variant: "success" | "failed";
  result: WithdrawApplyRes | undefined;
  errorKey: WithdrawErrorKey | undefined;
}

function WithdrawResultModal({
  isOpen,
  onClose,
  onGoToHistory,
  variant,
  result,
  errorKey,
}: WithdrawResultModalProps) {
  const t = useTranslations("portfolio");

  // DD-123: 409 nonce 重放 = 后端已成功落库，第二次请求被 DB 唯一索引拒。
  // 视觉上视同成功路径（success 图标 + Go to History 主按钮），仅文案点明"已提交"语义。
  const isNonceReplay = variant === "failed" && errorKey === "wdErrNonceUsed";
  const showSuccessLayout = variant === "success" || isNonceReplay;

  const amountDisplay = result ? formatAmount(result.real_amount) : "--";
  const addressDisplay = result ? shortenAddress(result.withdraw_address) : "--";
  const feeDisplay = result ? formatAmount(result.fee) : "--";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      className="!border-[var(--line-border-primary)]"
      containerStyle={{ background: "var(--fill-modal)" }}
    >
      <div className="flex flex-col items-center gap-[24px] py-[24px]">
        {showSuccessLayout ? (
          <Image src="/images/status/success.png" alt="" width={80} height={80} sizes="80px" />
        ) : (
          <XCircleIcon size={80} weight="fill" className="text-fn-red" />
        )}

        <div className="flex flex-col items-center gap-[12px] text-center">
          <h2 className="text-[18px] font-semibold text-primary leading-[26px]">
            {/* W-1 (REV-v3): nonce 重放走专属"已受理"标题，避免"提现成功 vs 已提交"语义错位 */}
            {isNonceReplay
              ? t("wdNonceReplayedTitle")
              : showSuccessLayout
                ? t("wdSuccessTitle")
                : t("wdFailedTitle")}
          </h2>
          <p className="text-[14px] text-tertiary leading-[19px]">
            {variant === "success" ? t("wdSuccessDesc") : t(errorKey ?? "wdErrFailedDesc")}
          </p>
        </div>

        {!isNonceReplay && (
          <div className="w-full rounded-12 border border-secondary p-[16px] flex flex-col gap-[12px]">
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-tertiary">{t("youWillReceive")}</span>
              <div className="flex items-center gap-[8px]">
                <TokenIconWithChain
                  tokenIconUrl={PLATFORM_TOKEN.iconUrl}
                  tokenSymbol={PLATFORM_TOKEN_DISPLAY}
                  size={20}
                  hideChainBadge
                />
                <span className="text-[14px] font-semibold text-primary">
                  {amountDisplay} {PLATFORM_TOKEN_DISPLAY}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-tertiary">{t("wdReceiveAddress")}</span>
              <div className="flex items-center gap-[8px]">
                <Image
                  src={CHAIN_ICON}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-full"
                  sizes="20px"
                />
                <span className="text-[14px] text-primary">{addressDisplay}</span>
              </div>
            </div>

            <div className="border-t border-divider" />

            <div className="flex justify-between items-center">
              <span className="text-[14px] text-tertiary border-b border-dashed border-tertiary">
                {t("wdNetworkCost")}
              </span>
              <span className="text-[14px] text-primary flex items-center gap-[6px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={GAS_ICON} alt="" className="w-[16px] h-[16px] opacity-60" />
                {feeDisplay} {PLATFORM_TOKEN_DISPLAY}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-tertiary border-b border-dashed border-tertiary">
                {t("wdPriceImpact")}
              </span>
              <span className="text-[14px] text-primary">{WITHDRAW_QUOTE_STATIC.priceImpact}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-tertiary border-b border-dashed border-tertiary">
                {t("wdMaxSlippage")}
              </span>
              <span className="text-[14px] text-primary">{WITHDRAW_QUOTE_STATIC.maxSlippage}</span>
            </div>
          </div>
        )}

        {showSuccessLayout ? (
          <div className="w-full flex flex-col gap-[8px]">
            <button
              onClick={onGoToHistory}
              className="w-full h-[48px] rounded-12 bg-white text-[16px] font-semibold leading-[24px] min-h-[44px] touch-manipulation shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
            >
              {/* @figma-hardcoded: #04060c static-black — pending design token */}
              <span className="text-[#04060c]">{t("wdGoToHistory")}</span>
            </button>
            <button
              onClick={onClose}
              className="w-full h-[48px] rounded-12 text-[16px] font-semibold leading-[24px] text-primary min-h-[44px] touch-manipulation"
            >
              {t("wdGotIt")}
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="w-full h-[48px] rounded-12 bg-white text-[16px] font-semibold leading-[24px] min-h-[44px] touch-manipulation shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
          >
            {/* @figma-hardcoded: #04060c static-black — pending design token */}
            <span className="text-[#04060c]">{t("wdGotIt")}</span>
          </button>
        )}
      </div>
    </Modal>
  );
}

export default memo(WithdrawResultModal);
