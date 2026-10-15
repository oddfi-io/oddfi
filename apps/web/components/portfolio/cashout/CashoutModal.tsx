"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { CaretDownIcon } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { convertOdd, formatDisplayAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useCancelBet } from "@/hooks/usePortfolioBets";
import { useOnchainCashout } from "@/hooks/useOnchainCashout";
import { toastError, toastInfo } from "@/lib/toast";
import type { PortfolioBet } from "@/types/portfolio";

// ─── CashoutModal（内部已改为 Cancel 语义）────────────────────────────────────
// 文件名保留 CashoutModal。两条提交路径（DD-137）：
//   - 链下单：useCancelBet → POST /account/bet_cancel（DD-087 原路径）
//   - 链上单：useOnchainCashout → POST /account/onchain/cash_out（报价预估 + 30s TTL 取鲜提交）
// Figma single [2009:99614] | multi [2267:112926] | success [2009:99685]
// Two-step flow: confirm → success
// Modal override: solid bg #111114, border #37393a, no blur, p-40

type Step = "confirm" | "success";

interface CashoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bet: PortfolioBet;
  onSuccess?: (bet: PortfolioBet) => void;
}

// Figma: fill/fill/modal #111114, border-primary #37393a, no blur, p-40
const MODAL_CLASS = "!border-[#37393a] !backdrop-blur-none";
const MODAL_STYLE: React.CSSProperties = {
  background: "#111114",
  paddingBottom: "0",
};

function CashoutModal({ isOpen, onClose, bet, onSuccess }: CashoutModalProps) {
  const t = useTranslations("portfolio");
  const tBet = useTranslations("betSlip");
  const { canConvert, hasRate, isUsd, rate } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;
  const [step, setStep] = useState<Step>("confirm");
  const cancelBet = useCancelBet();

  // ── DD-137 链上单分支：modal 打开时拉报价预估，Confirm 走 cash_out ──────────
  const isOnchain = Boolean(bet.isOnchain);
  const { quote, cashout } = useOnchainCashout({ bet, enabled: isOpen && isOnchain });

  // 报价不可用 → toast 告知（按钮仅 disabled 不足以解释；JSX 结构不动，走 toast 通道）。
  // 职责边界（REV-v1-A M-2）：本 effect 只管 modal 打开时 quote 自动查询的失败；
  // Confirm 提交时的取鲜报价失败由 useOnchainCashout.onError 处理（mutation 错误不会写入 quote.error，不双触发）。
  // 方案 B 报价失败统一为「盘口暂不可用」（market-not-found / no-live-quote）。
  useEffect(() => {
    if (!isOnchain || !isOpen || !quote.error) return;
    toastError("Quote temporarily unavailable, please try again later");
  }, [isOnchain, isOpen, quote.error]);

  // 预估额低于合约硬下限 10 ODD → 提交必 revert，禁用 Confirm 并告知。
  // 仅依赖 belowMin 翻转触发（REV-v1-A M-3）：gcTime=0 下 modal 关闭即清报价 → belowMin 回 false，
  // 重开后新报价仍低于下限才会再次提示，不因 isOpen 翻转重复弹 toast
  const belowMin = isOnchain && quote.data?.estimate.belowContractMin === true;
  useEffect(() => {
    if (belowMin) {
      toastInfo("Cash out value is below the 10 ODD contract minimum");
    }
  }, [belowMin]);

  const handleConfirm = async () => {
    if (isOnchain) {
      try {
        await cashout.mutateAsync();
        setStep("success");
        onSuccess?.(bet);
      } catch {
        // 错误已在 useOnchainCashout.onError 中分类 toast，这里仅防止未捕获 rejection
      }
      return;
    }
    // bet.id 是 React key（拼接字符串）；调 API 必须用 bet.betId（ref_id parseInt）
    if (bet.betId === undefined) {
      toastError("Cannot cancel: bet identifier missing");
      return;
    }
    try {
      await cancelBet.mutateAsync(bet.betId);
      setStep("success");
      onSuccess?.(bet);
    } catch {
      // 错误已在 useCancelBet.onError 中处理并 toast，这里仅防止未捕获 rejection
    }
  };

  // ── 金额展示源（DD-137）：链上单 = 实时报价预估；链下单 = 后端预计算字段 ────
  // 链上报价加载中显示 "—"，避免闪 potentialWin 误导（预估额通常远小于潜在赢额）
  const amountOdd = isOnchain
    ? (quote.data?.estimate.estimateOdd ?? null)
    : bet.cashoutAmount || bet.potentialWin;
  const amountUsd = isOnchain
    ? amountOdd !== null
      ? convertOdd(amountOdd, rate)
      : null
    : bet.cashoutAmountUsd || bet.potentialWinUsd;
  const isPending = isOnchain ? cashout.isPending : cancelBet.isPending;
  const confirmDisabled = isPending || (isOnchain && (quote.isLoading || !quote.data || belowMin));

  const handleClose = () => {
    setStep("confirm");
    onClose();
  };

  // ── Success step ──────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        hideHeader
        className={MODAL_CLASS}
        containerStyle={MODAL_STYLE}
      >
        {/* 抵消 Modal 的 px-4/md:px-10 + pt-6，再叠 Figma 的 p-[40px] */}
        <div className="-mx-4 md:-mx-10 -mt-6 p-[40px] flex flex-col items-center gap-[24px]">
          {/* Success icon — Figma: 80×80 */}
          <Image src="/images/deposit/success.png" alt="" width={80} height={80} sizes="80px" />

          {/* Title — DD-087 §4.2 */}
          <h2 className="text-[18px] font-semibold text-primary leading-[26px] text-center">
            {t("cancelSuccess")}
          </h2>

          {/* OK button */}
          <button
            onClick={handleClose}
            className="w-full h-[48px] rounded-12 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation"
          >
            {/* @figma-hardcoded: #04060c static-black — pending design token */}
            <span className="text-[14px] font-medium text-[#04060c]">OK</span>
          </button>
        </div>
      </Modal>
    );
  }

  // ── Confirm step ──────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      onBack={handleClose}
      hideHeader
      className={MODAL_CLASS}
      containerStyle={MODAL_STYLE}
    >
      {/* 抵消 Modal 的 px-4/md:px-10 + pt-6，再叠 Figma 的 p-[40px] */}
      <div className="-mx-4 md:-mx-10 -mt-6 p-[40px] flex flex-col gap-[24px]">
        {/* Title — DD-087 §4.2 */}
        <h2 className="text-[18px] font-semibold text-primary leading-[26px] text-center">
          {t("cancelTitle")}
        </h2>

        {/* Multi-leg: game card — Figma [2267:112933] */}
        {bet.isMulti && (
          <div className="border border-secondary rounded-16 p-[16px] flex items-center">
            <div className="flex gap-[16px] items-center">
              {/* Team avatar overlay — 48px */}
              {/* @stash: team images hardcoded — replace with API data when backend ready */}
              <div className="relative w-[48px] h-[48px] shrink-0">
                <div className="absolute left-0 top-0 w-[36px] h-[36px] rounded-full bg-gradient-to-t from-[#f7fafc] to-[#d4dce3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mocks/teams/home.png"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* @figma-hardcoded: #04060c team-border — pending design token */}
                <div className="absolute bottom-0 right-0 w-[36px] h-[36px] rounded-full bg-gradient-to-t from-[#f7fafc] to-[#d4dce3] border-[2.25px] border-[#04060c] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mocks/teams/away.png"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-[4px]">
                <span className="text-[14px] font-semibold text-primary leading-[19px]">
                  {bet.legCount} Leg Multi
                </span>
                {/* @figma-hardcoded: rgba(237,116,66,0.2) odds-tag-bg — pending design token */}
                <span className="bg-[rgba(237,116,66,0.2)] text-[#ed7442] h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] inline-flex items-center w-fit">
                  {bet.odds} x
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Amount row — Figma: gap-8, items-center */}
        <div className="flex gap-[8px] items-center">
          <TokenIconWithChain
            tokenIconUrl={PLATFORM_TOKEN.iconUrl}
            tokenSymbol={PLATFORM_TOKEN_DISPLAY}
            size={32}
            hideChainBadge
          />
          <div className="flex gap-[4px] items-baseline">
            <span className="text-[20px] font-semibold text-primary leading-[28px]">
              {/* DD-137：链上单报价加载中显示 "—"，不闪 potentialWin 误导 */}
              {amountOdd === null
                ? "—"
                : showUsd
                  ? `$${formatDisplayAmount(amountUsd ?? "0")}`
                  : formatDisplayAmount(amountOdd)}
            </span>
            <span className="text-[14px] text-tertiary leading-[19px]">
              {showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY}
            </span>
            {hasRate && amountOdd !== null && (
              <span className="text-[14px] text-tertiary leading-[19px]">
                ≈
                {showUsd
                  ? `${formatDisplayAmount(amountOdd)} ${PLATFORM_TOKEN_DISPLAY}`
                  : `$${formatDisplayAmount(amountUsd ?? "0")}`}
              </span>
            )}
          </div>
        </div>

        {/* Info card — Figma: border-secondary, rounded-16, p-16, gap-12 */}
        <div className="border border-secondary rounded-16 p-[16px] flex flex-col gap-[12px]">
          {/* Destination */}
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-tertiary leading-[19px]">
              {t("cancelDestination")}
            </span>
            <div className="flex items-center gap-[8px]">
              <TokenIconWithChain
                tokenIconUrl={PLATFORM_TOKEN.iconUrl}
                tokenSymbol={PLATFORM_TOKEN_DISPLAY}
                size={20}
                hideChainBadge
              />
              <span className="text-[14px] text-primary leading-[19px]">ODD Wallet (...ojdsj)</span>
            </div>
          </div>
          {/* Source */}
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-tertiary leading-[19px]">{t("cancelSource")}</span>
            <div className="flex items-center gap-[8px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/chains/bsc.svg" alt="" className="w-[20px] h-[20px] rounded-full" />
              <span className="text-[14px] text-primary leading-[19px]">BNB Smart Chain</span>
            </div>
          </div>
          {/* Data toggle */}
          <div className="flex items-center gap-[4px]">
            <span className="text-[14px] text-tertiary leading-[19px]">{t("cancelData")}</span>
            <CaretDownIcon size={20} className="text-tertiary" />
          </div>
        </div>

        {/* T&C + Confirm button */}
        <div className="flex flex-col gap-[16px] items-center">
          <p className="text-[12px] text-tertiary leading-[18px]">
            {t("termsAgree")} <span className="text-white">{t("termsOfUse")}</span>
          </p>
          <button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="w-full h-[48px] rounded-12 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation disabled:opacity-50"
          >
            {/* @figma-hardcoded: #04060c static-black — pending design token */}
            <span className="text-[14px] font-medium text-[#04060c]">
              {isPending ? tBet("confirming") : t("cancelConfirm")}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default memo(CashoutModal);
