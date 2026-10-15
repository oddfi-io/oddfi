"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { showToast } from "@/lib/toast";
import { useIsStakingAvailable, useStakingGlobalStats } from "@/hooks/useStakingData";
import { useStakeHistory } from "@/hooks/useStakeHistory";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useStakeTx } from "@/hooks/useStakeTx";
import { useUnstakeTx } from "@/hooks/useUnstakeTx";
import StakeTab from "./StakeTab";
import UnstakeTab from "./UnstakeTab";
import ActivityBanner from "@/components/activity-banner/ActivityBanner";
import type { StakingTier, StakingPosition } from "./types";
// EarlyUnstakeModal 入口暂时下线：Figma 未覆盖该场景。

type Tab = "stake" | "unstake";

export default function StakingPage() {
  const t = useTranslations("staking");
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("stake");
  const stakeAmountRef = useRef("");
  // DD-130 问题2：质押成功后链下索引器回填 stake/history 有 ~10s 延迟（实测 9–12s）。
  // 成功即跳 unstake tab 并进入"同步中"：baseline 记录质押前活跃仓位数，
  // 新仓位入库（数量增加）或 25s 兜底超时后退出同步态。
  const [syncing, setSyncing] = useState(false);
  const baselineActiveCountRef = useRef(0);

  const isAvailable = useIsStakingAvailable();
  // DD-130：可质押余额改用账户/代理钱包 available_balance（十进制 ODD 串），不再读钱包 balanceOf
  const { data: balanceData, isLoading: isBalanceLoading } = useAccountBalance();
  const balance = balanceData?.available_balance ?? "0";
  const { totalStaked, minStakeAmount, refetch: refetchStats } = useStakingGlobalStats();
  const {
    activePositions,
    historyRecords,
    isLoading: isPositionsLoading,
    refetch,
  } = useStakeHistory();

  // BUG-023：写操作成功后，仓位列表与全局 Total Staked 是两个独立 hook，刷新触发器要一起挂。
  // 仅 success 路径触发（useStakeTx/useUnstakeTx 的 onSuccess 在链上 receipt 确认后才调；
  // failed/revert 不刷新）。refetch / refetchStats 均为 react-query 稳定引用，不会引起 tx hook 重建。
  const refetchAll = useCallback(() => {
    refetch();
    refetchStats();
  }, [refetch, refetchStats]);

  const stakeTx = useStakeTx(refetchAll);
  const unstakeTx = useUnstakeTx(refetchAll);

  useEffect(() => {
    if (stakeTx.phase === "success") {
      showToast(
        `Staked ${stakeAmountRef.current} ${PLATFORM_TOKEN_DISPLAY} successfully`,
        "success"
      );
      // 自动切到 My Staking 并进入同步态，等新仓位入库
      setActiveTab("unstake");
      setSyncing(true);
      stakeTx.reset();
    } else if (stakeTx.phase === "failed") {
      // 错误 toast 已由 useStakeTx 统一弹出（toUserTxMessage），这里只复位
      stakeTx.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeTx.phase]);

  // 同步态：3s 提速轮询直到新仓位入库；25s 兜底超时退出（索引器异常时不无限轮询）
  useEffect(() => {
    if (!syncing) return;
    const poll = setInterval(() => refetch(), 3_000);
    const timeout = setTimeout(() => setSyncing(false), 25_000);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [syncing, refetch]);

  // 新仓位出现（活跃数超过质押前基线）→ 退出同步态
  useEffect(() => {
    if (syncing && activePositions.length > baselineActiveCountRef.current) {
      setSyncing(false);
    }
  }, [syncing, activePositions.length]);

  useEffect(() => {
    if (unstakeTx.phase === "success") {
      showToast("Unstaked successfully", "success");
      unstakeTx.reset();
    } else if (unstakeTx.phase === "failed") {
      // 错误 toast 已由 useUnstakeTx 统一弹出，这里只复位
      unstakeTx.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unstakeTx.phase]);

  const handleStake = (amount: string, tier: StakingTier) => {
    stakeAmountRef.current = amount;
    // 记录质押前活跃仓位数作为同步基线
    baselineActiveCountRef.current = activePositions.length;
    // DD-130：后端按 lock_hours 反查 plan_id。DD-149：发后端的是透传 key（lockHoursKey，
    // 非展示天数 lockDays）——命门，漏改即发天值 → INVALID_STAKE_PLAN 全员质押失败。
    stakeTx.execute(amount, tier.lockHoursKey);
  };

  const handleUnstake = (position: StakingPosition) => {
    unstakeTx.executeUnstake(BigInt(position.id));
  };

  return (
    <div className="bg-primary">
      <div className="mx-auto max-w-[1200px] flex flex-col items-center">
        <div className="w-full px-[16px] pt-[28px] md:px-0 md:pt-[32px]">
          <ActivityBanner tag={t("banner.tag")} lead={t("banner.lead")} body={t("banner.body")} />
        </div>
        <div className="w-full px-[16px] pt-[48px] md:px-0 md:pt-[60px] flex flex-col md:items-center gap-[16px]">
          <h1 className="font-orbitron font-bold text-white leading-tight">
            <span className="hidden md:block text-[32px] leading-[40px] tracking-[-0.32px]">
              {t("title")}
            </span>
            <span className="block md:hidden text-[28px] leading-[36px] tracking-[-0.28px]">
              {t("title")}
            </span>
          </h1>
          <p className="text-[14px] text-secondary leading-[19px]">
            <span className="hidden md:inline">{t("subtitle")}</span>
            <span className="inline md:hidden">{t("subtitleH5")}</span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-[20px] mt-[28px] w-full px-[16px] md:px-0 pb-[48px]">
          <div className="w-full h-[44px] md:w-[540px] md:h-[48px] bg-fill-input border border-secondary rounded-full p-[4px] flex">
            {(["stake", "unstake"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{ touchAction: "manipulation" }}
                className={[
                  "flex-1 rounded-full text-[14px] font-bold transition-colors min-h-[36px]",
                  activeTab === tab ? "bg-btn-primary-white text-static-black" : "text-secondary",
                ].join(" ")}
              >
                {tab === "stake" ? t("tabStake") : t("tabUnstake")}
              </button>
            ))}
          </div>

          <div className="w-full md:w-[540px] bg-fill-card1 rounded-16 px-[16px] py-[24px] md:p-[32px]">
            {activeTab === "stake" ? (
              <StakeTab
                balance={isBalanceLoading ? "0" : balance}
                onStake={handleStake}
                isConnected={isConnected}
                totalStakedOnChain={totalStaked}
                minStake={minStakeAmount}
                txPhase={stakeTx.phase}
                isAvailable={isAvailable}
              />
            ) : (
              <UnstakeTab
                positions={isPositionsLoading ? [] : activePositions}
                history={historyRecords}
                isConnected={isConnected}
                onUnstake={handleUnstake}
                pendingUnstakeId={unstakeTx.lastPositionId?.toString()}
                syncing={syncing}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
