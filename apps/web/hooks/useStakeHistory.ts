"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { getStakeHistory } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { accountKeys } from "@/lib/query-keys";
import { getPlanById } from "@/lib/staking-plans";
import { derivePositionStatus } from "@/lib/staking-state";
import type { StakeHistoryItem } from "@/types/onchain-stake";
import type { StakingPosition, HistoryRecord } from "@/components/staking/types";

/**
 * 纯映射：后端 stake/history 列表（持仓 + 历史合一）→ UI 的活跃持仓 + 历史记录。
 *
 * - status=active → 活跃区，UI 状态由 now vs end_time 派生（active / ready）；
 *   earned 读后端 pending_reward_wei（REQ-005）；后端读链失败省略该字段时兜底 "0"。
 * - status=withdrawn → 历史区；reward_wei 缺省（active / 提前解押）时不展示收益。
 */
export function mapStakeHistory(
  items: StakeHistoryItem[],
  nowSec: number
): { activePositions: StakingPosition[]; historyRecords: HistoryRecord[] } {
  const activePositions: StakingPosition[] = [];
  const historyRecords: HistoryRecord[] = [];

  for (const item of items) {
    // DD-149：统一由 plan_id 派生真实锁仓天数（合约真值），不再消费后端 stale lock_hours 字段
    const plan = getPlanById(item.plan_id);

    if (item.status === "withdrawn") {
      historyRecords.push({
        id: item.position_id,
        action: item.withdrawn_early ? "early_unstake" : "unstake",
        amount: item.amount_odd,
        lockDays: plan.lockDays,
        multiplier: plan.multiplier,
        date: new Date((item.withdrawn_time || item.end_time) * 1000).toISOString(),
        // 提前解押放弃收益 → reward_wei 缺省，不展示
        reward:
          !item.withdrawn_early && item.reward_wei && item.reward_wei !== ""
            ? formatUnits(BigInt(item.reward_wei), 18)
            : undefined,
      });
      continue;
    }

    const status = derivePositionStatus({ active: true, unlockAt: item.end_time }, nowSec);
    activePositions.push({
      id: item.position_id,
      amount: item.amount_odd,
      multiplier: plan.multiplier,
      lockDays: plan.lockDays,
      status,
      stakedAt: new Date(item.start_time * 1000).toISOString(),
      unlockAt: new Date(item.end_time * 1000).toISOString(),
      // REQ-005：后端 active 项待领收益；读链失败省略时兜底 "0"
      earned:
        item.pending_reward_wei && item.pending_reward_wei !== ""
          ? formatUnits(BigInt(item.pending_reward_wei), 18)
          : "0",
    });
  }

  return { activePositions, historyRecords };
}

export interface UseStakeHistoryResult {
  activePositions: StakingPosition[];
  historyRecords: HistoryRecord[];
  isLoading: boolean;
  refetch: () => void;
}

/**
 * 我的质押（后端 REST 驱动，REQ-005 后零合约调用）。
 *
 * - 持仓 + 历史 + 活跃仓位待领收益（pending_reward_wei）全部来自后端 stake/history。
 * - 写操作（stake/unstake）后调 refetch；事件索引异步回填有秒级延迟，故 8s 轮询兜底。
 */
export function useStakeHistory(): UseStakeHistoryResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { address } = useAccount();

  const { data, isLoading, refetch } = useQuery({
    queryKey: accountKeys.stakeHistory(address),
    queryFn: getStakeHistory,
    enabled: isAuthenticated && !!address,
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    retry: 2,
  });

  const mapped = useMemo(() => {
    const list = data?.list ?? [];
    return mapStakeHistory(list, Math.floor(Date.now() / 1000));
  }, [data]);

  return {
    activePositions: mapped.activePositions,
    historyRecords: mapped.historyRecords,
    isLoading,
    refetch,
  };
}
