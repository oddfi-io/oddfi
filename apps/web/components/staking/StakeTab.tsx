"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { SpinnerIcon } from "@phosphor-icons/react";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { useIsTxLockedByOther } from "@/stores/txLockStore";
import { isGt } from "@/lib/decimal";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { calcEstApy, calcEstimate, formatOfi } from "./calc";
import { NETWORK_STATS, MIN_STAKE } from "./mock-data";
import { STAKING_PLANS } from "@/lib/staking-plans";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import type { StakingTier, StakeEstimate, NetworkStats } from "./types";
import type { StakeTxPhase } from "@/hooks/useStakeTx";
import PeriodCard from "./PeriodCard";
import AmountInput from "./AmountInput";
import EstimateCard from "./EstimateCard";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";

interface StakeTabProps {
  balance: string;
  onStake: (amount: string, tier: StakingTier) => void;
  isConnected?: boolean;
  /** Real on-chain stats; falls back to mock when undefined */
  networkStats?: NetworkStats;
  /** Real on-chain totalStaked for display only; does not affect APY calculation */
  totalStakedOnChain?: string;
  /** Min stake amount from contract; falls back to mock MIN_STAKE */
  minStake?: string;
  /** Tx phase for button loading state */
  txPhase?: StakeTxPhase;
  /** False on mainnet where contracts are not yet deployed */
  isAvailable?: boolean;
}

export default function StakeTab({
  balance,
  onStake,
  isConnected = true,
  networkStats,
  totalStakedOnChain,
  minStake,
  txPhase = "idle",
  isAvailable = true,
}: StakeTabProps) {
  const t = useTranslations("staking");
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);
  const [selectedTier, setSelectedTier] = useState<StakingTier>(STAKING_PLANS[2]); // 60 天默认（planId 2）
  const [amount, setAmount] = useState("");

  const stats = networkStats ?? NETWORK_STATS;
  const effectiveMinStake = minStake ?? MIN_STAKE;

  // 预计算各档位 APR
  const tierApys = useMemo(
    () =>
      STAKING_PLANS.map((tier) => ({
        tier,
        apy: calcEstApy(stats, tier.multiplier),
      })),
    [stats]
  );

  // 预估收益（有金额才计算）
  const estimate: StakeEstimate | null = useMemo(() => {
    if (!amount || !isGt(amount, "0")) return null;
    return calcEstimate(stats, amount, selectedTier.multiplier, selectedTier.lockDays);
  }, [amount, selectedTier, stats]);

  const isTxPending = txPhase === "approving" || txPhase === "staking" || txPhase === "confirming";
  // 全局其他 tx（unstake / earlyUnstake）占用钱包时，本按钮也要禁用
  const isLockedByOther = useIsTxLockedByOther("stake");

  // 按钮状态逻辑
  const hasAmount = amount !== "" && isGt(amount, "0");
  const belowMin = hasAmount && !isGt(amount, effectiveMinStake) && amount !== effectiveMinStake;
  const insufficientBalance = hasAmount && isGt(amount, balance);

  let btnLabel = t("stakeOdd");
  let btnDisabled = false;

  if (!isConnected) {
    btnLabel = t("connectWalletToStake");
    btnDisabled = true;
  } else if (!isAvailable) {
    btnLabel = t("comingSoon");
    btnDisabled = true;
  } else if (isTxPending) {
    btnLabel =
      txPhase === "approving"
        ? t("approving")
        : txPhase === "staking"
          ? t("staking")
          : t("confirming");
    btnDisabled = true;
  } else if (isLockedByOther) {
    btnLabel = t("processing");
    btnDisabled = true;
  } else if (!hasAmount) {
    btnLabel = t("enterAmount");
    btnDisabled = true;
  } else if (belowMin) {
    btnLabel = t("minimum");
    btnDisabled = true;
  } else if (insufficientBalance) {
    btnLabel = t("insufficientBalance");
    btnDisabled = true;
  }

  return (
    <div className="flex flex-col gap-[28px]">
      {/* 卡片标题行：ODD 图标 + 标题 */}
      <div className="flex items-center gap-[8px]">
        <TokenIconWithChain
          tokenIconUrl={PLATFORM_TOKEN.iconUrl}
          tokenSymbol={PLATFORM_TOKEN_DISPLAY}
          size={20}
          hideChainBadge
        />
        {/* PC: "Odd Staking", H5: "ODD Staking" */}
        <h2 className="text-[20px] font-bold text-primary leading-[28px]">{t("cardTitle")}</h2>
      </div>

      {/* Stats 行：Total Staked + Reward Pool */}
      <div className="flex gap-[20px]">
        {/* Total Staked */}
        <div className="flex flex-col gap-[8px] flex-1 md:w-[238px] md:flex-none items-start">
          <span className="text-[12px] md:text-[14px] text-secondary leading-[18px] md:leading-[19px]">
            {t("totalStaked")}
          </span>
          <span className="text-[16px] md:text-[18px] font-bold text-primary whitespace-nowrap">
            {/* REQ-005：未登录/无后端数据 → stake/stats(JWT) 取不到 totalStaked，展示 — 不回落 mock */}
            {totalStakedOnChain
              ? `${formatOfi(totalStakedOnChain)} ${PLATFORM_TOKEN_DISPLAY}`
              : "—"}
          </span>
        </div>
        {/* Reward Pool */}
        <div className="flex flex-col gap-[8px] flex-1 md:w-[238px] md:flex-none items-end md:items-start">
          <span className="text-[12px] md:text-[14px] text-secondary leading-[18px] md:leading-[19px]">
            {t("rewardPool")}
          </span>
          <span className="text-[16px] md:text-[18px] font-bold text-primary whitespace-nowrap">
            {stats.rewardPool} {PLATFORM_TOKEN_DISPLAY}
          </span>
        </div>
      </div>

      {/* PeriodCard 选择区 */}
      <div className="bg-fill-input rounded-12 grid grid-cols-2 md:grid-cols-4 p-[4px] gap-[12px]">
        {tierApys.map(({ tier, apy }) => (
          <PeriodCard
            key={tier.lockDays}
            tier={tier}
            apy={apy}
            selected={selectedTier.lockDays === tier.lockDays}
            onSelect={() => setSelectedTier(tier)}
          />
        ))}
      </div>

      {/* 金额输入 */}
      <AmountInput
        value={amount}
        onChange={setAmount}
        balance={balance}
        onMax={() => setAmount(balance)}
      />

      {/* 预估收益（有金额时显示） */}
      {estimate && (
        <EstimateCard
          estimate={estimate}
          lockDays={selectedTier.lockDays}
          multiplier={selectedTier.multiplier}
        />
      )}

      {/* Stake 按钮 — DD-113 认购模式强制 disabled */}
      <button
        type="button"
        disabled={IS_SUBSCRIPTION_MODE || (isConnected && btnDisabled)}
        onClick={() =>
          IS_SUBSCRIPTION_MODE
            ? undefined
            : !isConnected
              ? triggerConnect()
              : onStake(amount, selectedTier)
        }
        style={{ touchAction: "manipulation" }}
        className={[
          "w-full h-[48px] rounded-12 text-[14px] font-bold min-h-[44px] transition-colors",
          "flex items-center justify-center gap-[8px]",
          IS_SUBSCRIPTION_MODE || btnDisabled
            ? "bg-btn-primary-white opacity-50 text-static-black cursor-not-allowed shadow-xs"
            : "bg-fn-brand text-static-black hover:opacity-90",
        ].join(" ")}
      >
        {(isTxPending || isLockedByOther) && (
          <SpinnerIcon size={16} weight="bold" className="animate-spin" />
        )}
        {btnLabel}
      </button>
    </div>
  );
}
