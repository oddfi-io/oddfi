"use client";

import { useState } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { formatUnits, parseUnits } from "viem";
import Modal from "@/components/ui/Modal";
import { formatDisplayAmount, formatAmount } from "@/lib/decimal";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useLiquidityPoolStats } from "@/hooks/useLiquidityPoolStats";
import { useDepositGlobalTx } from "@/hooks/useDepositGlobalTx";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { toastWarning } from "@/lib/toast";
import { LP_PLAN_OPTIONS, getLpPlan } from "@/lib/lp-plans";

interface PoolDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Default to longest lock (highest weight) — UX matches Figma which highlighted 90d
const DEFAULT_PLAN_ID = LP_PLAN_OPTIONS[LP_PLAN_OPTIONS.length - 1].planId;

export default function PoolDepositModal({ isOpen, onClose }: PoolDepositModalProps) {
  const t = useTranslations("pools");
  const [planId, setPlanId] = useState<number>(DEFAULT_PLAN_ID);
  const [amount, setAmount] = useState("");

  const { minDeposit, isPaused } = useLiquidityPoolStats();
  const deposit = useDepositGlobalTx(onClose);

  // DD-130：可加流动性余额改用账户/代理钱包 available_balance（十进制 ODD 串），不再读钱包 balanceOf
  const { data: balanceInfo } = useAccountBalance();
  const availableBalance = balanceInfo?.available_balance ?? "0";
  const balanceRaw = (() => {
    try {
      return parseUnits(availableBalance, 18);
    } catch {
      return 0n;
    }
  })();

  const minDepositDisplay = minDeposit === 0n ? "—" : formatAmount(formatUnits(minDeposit, 18));

  const selectedOption = getLpPlan(planId) ?? LP_PLAN_OPTIONS[0];

  const handleMax = () => setAmount(availableBalance);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const handleClose = () => {
    deposit.reset();
    setAmount("");
    onClose();
  };

  const isProcessing = deposit.phase !== "idle" && deposit.phase !== "failed";

  const handleConfirm = () => {
    // DD-113: 认购模式短路兜底
    if (IS_SUBSCRIPTION_MODE) return;
    if (!amount || isProcessing) return;
    const amountBigInt = parseUnits(amount, 18);
    if (minDeposit > 0n && amountBigInt < minDeposit) {
      toastWarning(
        t("minimumDepositDynamic", { amount: minDepositDisplay, symbol: PLATFORM_TOKEN_DISPLAY })
      );
      return;
    }
    deposit.execute(amount, selectedOption.planId, isPaused, minDeposit, balanceRaw);
  };

  const ctaLabel = (() => {
    switch (deposit.phase) {
      case "checking_allowance":
      case "approving":
        return t("approvingCta");
      case "confirming_approve":
        return t("confirmingApproveCta");
      case "depositing":
        return t("depositingCta");
      case "confirming_deposit":
        return t("confirmingCta");
      default:
        return t("confirmDeposit");
    }
  })();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("addLiquidity")}>
      <div className="flex flex-col gap-[24px]">
        {/* Lock Period Selector */}
        <div className="flex flex-col gap-[12px]">
          <p className="text-secondary text-[14px]">{t("lockPeriod")}</p>
          <div className="flex gap-[8px]">
            {LP_PLAN_OPTIONS.map((opt) => {
              const isActive = planId === opt.planId;
              return (
                <button
                  key={opt.planId}
                  onClick={() => setPlanId(opt.planId)}
                  style={{ touchAction: "manipulation" }}
                  className={`flex-1 flex flex-col items-center justify-center h-[62px] rounded-8 gap-[4px] px-[8px] py-[8px] transition-colors ${
                    isActive
                      ? "bg-tag-brand border border-dt-hover"
                      : "bg-fill-card2 border border-transparent hover:border-secondary"
                  }`}
                >
                  <span className="text-[16px] font-medium text-primary">
                    {opt.lockDays}
                    {t("daysShort")}
                  </span>
                  <span className="text-[12px] text-fn-green">{opt.apyBoost}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount Input */}
        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-secondary text-[14px]">{t("amount")}</span>
            <span className="text-[12px] text-secondary">
              {t("availableWithAmount", {
                amount: formatDisplayAmount(availableBalance),
                symbol: PLATFORM_TOKEN_DISPLAY,
              })}
            </span>
          </div>
          <div className="bg-fill-input-modal rounded-8 h-[48px] px-[12px] flex items-center justify-between">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              style={{ touchAction: "manipulation" }}
              className="flex-1 bg-transparent text-primary text-[14px] font-medium outline-none placeholder:text-tertiary min-w-0"
            />
            <div className="flex items-center gap-[8px] shrink-0">
              <span className="text-primary text-[14px]">{PLATFORM_TOKEN_DISPLAY}</span>
              <button
                onClick={handleMax}
                style={{ touchAction: "manipulation" }}
                className="text-brand-default text-[14px] cursor-pointer"
              >
                {t("maxBtn")}
              </button>
            </div>
          </div>
        </div>

        {/* Lock Period Info — 2x2 grid */}
        <div className="flex flex-col gap-[12px]">
          <p className="text-secondary text-[14px]">{t("lockPeriod")}</p>
          <div className="flex flex-col gap-[12px]">
            <div className="flex gap-[12px]">
              <div className="flex-1 border border-divider-light rounded-8 h-[64px] px-[16px] py-[8px] flex flex-col justify-center gap-[4px]">
                <p className="text-secondary text-[12px]">{t("estDaily")}</p>
                <p className="text-primary text-[16px] font-bold">0.00 {PLATFORM_TOKEN_DISPLAY}</p>
              </div>
              <div className="flex-1 border border-divider-light rounded-8 h-[64px] px-[16px] py-[8px] flex flex-col justify-center gap-[4px]">
                <p className="text-secondary text-[12px]">{t("estMonthly")}</p>
                <p className="text-primary text-[16px] font-bold">0.24 {PLATFORM_TOKEN_DISPLAY}</p>
              </div>
            </div>
            <div className="flex gap-[12px]">
              <div className="flex-1 border border-divider-light rounded-8 h-[64px] px-[16px] py-[8px] flex flex-col justify-center gap-[4px]">
                <p className="text-secondary text-[12px]">{t("apy")}</p>
                <p className="text-primary text-[16px] font-bold">{selectedOption.apy}%</p>
              </div>
              <div className="flex-1 border border-divider-light rounded-8 h-[64px] px-[16px] py-[8px] flex flex-col justify-center gap-[4px]">
                <p className="text-secondary text-[12px]">{t("lockBonus")}</p>
                <p className="text-fn-green text-[16px] font-bold">{selectedOption.apyBoost}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Notice */}
        <div className="bg-tag-yellow rounded-8 p-[12px] flex gap-[8px]">
          <WarningCircleIcon size={20} className="text-fn-yellow shrink-0" />
          <p className="text-fn-yellow text-[12px] leading-[18px]">{t("riskNotice")}</p>
        </div>

        {/* Error message */}
        {deposit.phase === "failed" && deposit.errorMessage && (
          <div className="flex items-center gap-[8px]">
            <WarningCircleIcon size={16} className="text-fn-red shrink-0" />
            <p className="text-fn-red text-[12px]">{deposit.errorMessage}</p>
          </div>
        )}

        {/* CTA */}
        {/* DD-113: 认购模式强制 disabled */}
        <button
          onClick={handleConfirm}
          disabled={!amount || isProcessing || IS_SUBSCRIPTION_MODE}
          style={{ touchAction: "manipulation" }}
          className="bg-btn-primary-white text-static-black rounded-12 h-[48px] w-full text-[14px] font-medium shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] disabled:opacity-40 transition-opacity"
        >
          {ctaLabel}
        </button>
      </div>
    </Modal>
  );
}
