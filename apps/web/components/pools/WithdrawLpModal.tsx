"use client";

import { useEffect } from "react";
import { formatUnits } from "viem";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import { getLpPlan } from "@/lib/lp-plans";
import { toastSuccess } from "@/lib/toast";
import { useUnbondLpTx } from "@/hooks/useUnbondLpTx";
import { useWithdrawLpTx } from "@/hooks/useWithdrawLpTx";
import { useLiquidityPoolStats } from "@/hooks/useLiquidityPoolStats";
import type { LpPositionData } from "@/hooks/useLpPositions";

interface WithdrawLpModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: LpPositionData | null;
}

export default function WithdrawLpModal({ isOpen, onClose, position }: WithdrawLpModalProps) {
  const t = useTranslations("pools");
  const { isPaused } = useLiquidityPoolStats();

  const unbond = useUnbondLpTx(() => {
    toastSuccess("Unbond requested successfully");
    onClose();
  });
  const withdraw = useWithdrawLpTx(() => {
    toastSuccess("Withdrawal completed");
    onClose();
  });

  // Reset tx state when modal closes
  useEffect(() => {
    if (!isOpen) {
      unbond.reset();
      withdraw.reset();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!position) return null;

  // 合约 effective state 决定可执行的下一步操作：
  //   Active     — 已 deposit，仍在锁定期内（不能 unbond）
  //   Ready      — 已到 unlockAt，可调 requestUnbond
  //   Unbonding  — 已请求 unbond，等待 epoch 满足
  //   Withdrawable — Unbonding+epoch 满足，可调 withdraw
  //   Withdrawn / Liquidated — 已结束
  const isReady = position.state === LP_POSITION_STATE.Ready;
  const isWithdrawable = position.state === LP_POSITION_STATE.Withdrawable;
  const isActive = position.state === LP_POSITION_STATE.Active;
  const isUnbonding = position.state === LP_POSITION_STATE.Unbonding;
  // 不可操作：除 Ready / Withdrawable 之外的状态
  const cantAct = !isReady && !isWithdrawable;

  // DD-149：lp-plans 删 label 字段，金库周期统一由 lockDays 渲染（真实天）
  const lpPlan = getLpPlan(position.planId);
  const planLabel = lpPlan ? `${lpPlan.lockDays}${t("daysShort")}` : `Plan ${position.planId}`;

  const principalDisplay =
    formatAmount(formatUnits(position.principal, 18)) + " " + PLATFORM_TOKEN_DISPLAY;

  const unlockDate = new Date(Number(position.unlockAt) * 1000).toLocaleDateString();

  const activePhase = isWithdrawable ? withdraw.phase : unbond.phase;
  const activeError = isWithdrawable ? withdraw.errorMessage : unbond.errorMessage;
  const isProcessing = activePhase === "executing" || activePhase === "confirming";

  const title = isWithdrawable ? t("withdraw") : "Manage Position";

  const handleConfirm = () => {
    if (isWithdrawable) {
      withdraw.execute(position.positionId, position.state, isPaused);
    } else {
      unbond.execute(position.positionId, position.state, isPaused);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-[24px]">
        {/* Position Info */}
        <div className="flex flex-col gap-[12px]">
          <div className="flex gap-[12px]">
            <div className="flex-1 border border-divider-light rounded-8 px-[16px] py-[12px] flex flex-col gap-[4px]">
              <p className="text-secondary text-[12px]">{t("deposited")}</p>
              <p className="text-primary text-[16px] font-bold">{principalDisplay}</p>
            </div>
            <div className="flex-1 border border-divider-light rounded-8 px-[16px] py-[12px] flex flex-col gap-[4px]">
              <p className="text-secondary text-[12px]">Plan</p>
              <p className="text-primary text-[16px] font-bold">{planLabel}</p>
            </div>
          </div>
          <div className="border border-divider-light rounded-8 px-[16px] py-[12px] flex flex-col gap-[4px]">
            <p className="text-secondary text-[12px]">{t("unlock")}</p>
            <p className="text-primary text-[16px] font-bold">{unlockDate}</p>
          </div>
        </div>

        {/* Locked notice — Active（锁定中）/ Unbonding（解绑中等 epoch） */}
        {(isActive || isUnbonding) && (
          <div className="bg-fill-card1 rounded-8 px-[16px] py-[12px]">
            <p className="text-secondary text-[13px] leading-[20px]">
              {isUnbonding
                ? `Unbond requested. Withdrawable after the unbonding epoch completes.`
                : `Position locked until ${unlockDate}. You can request unbond once the lock period ends.`}
            </p>
          </div>
        )}

        {/* Error */}
        {activeError && <p className="text-fn-red text-[13px] leading-[20px]">{activeError}</p>}

        {/* CTA */}
        {/* DD-113: 认购模式强制 disabled */}
        <button
          onClick={handleConfirm}
          disabled={cantAct || isProcessing || IS_SUBSCRIPTION_MODE}
          style={{ touchAction: "manipulation" }}
          className="bg-btn-primary-white text-static-black rounded-12 h-[48px] w-full text-[14px] font-medium shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] disabled:opacity-40 transition-opacity"
        >
          {isProcessing ? "Processing..." : isWithdrawable ? t("withdraw") : "Unbond"}
        </button>
      </div>
    </Modal>
  );
}
