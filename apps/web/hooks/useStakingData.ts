"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWatchContractEvent,
} from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseAbiItem, zeroAddress } from "viem";
import type { Address } from "viem";
import { CORE_CHAIN } from "@/lib/wagmi.config";
import { getContracts } from "@/lib/contracts";
import { getStakeStats } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { accountKeys } from "@/lib/query-keys";
import { ODD_TOKEN_ABI } from "@/lib/abi/oddToken";
import { STAKING_POOL_ABI } from "@/lib/abi/stakingPool";
import { getPlanById } from "@/lib/staking-plans";
import { derivePositionStatus } from "@/lib/staking-state";
import type { StakingPosition, HistoryRecord } from "@/components/staking/types";

const ODD_WAD = 10n ** 18n;

const STAKE_CREATED_EVENT = parseAbiItem(
  "event StakeCreated(uint256 indexed positionId, address indexed user, uint256 principal, uint16 planId, uint8 sourceType, uint256 weight, uint64 unlockAt)"
);

const STAKE_WITHDRAWN_EVENT = parseAbiItem(
  "event StakeWithdrawn(uint256 indexed positionId, address indexed user, uint256 principal, uint256 reward, bool early)"
);

// DD-147：删 IS_TESTNET 业务闸（testnet/mainnet 链上统一）。门控收敛到「合约地址是否配置」——
// 地址 ZERO（未部署/未配置链）即不可用，契合 requireContract 设计哲学，扩链零改判定逻辑。
function resolveAddresses() {
  const c = getContracts(CORE_CHAIN.id);
  if (c.oddToken === zeroAddress || c.stakingPool === zeroAddress) return null;
  return { oddToken: c.oddToken, stakingPool: c.stakingPool };
}

/** True when staking contracts are configured for the current network mode */
export function useIsStakingAvailable(): boolean {
  return resolveAddresses() !== null;
}

/** User's ODD token balance as a formatted decimal string (18 decimals) */
export function useOddBalance(address?: Address): { balance: string; isLoading: boolean } {
  const addrs = resolveAddresses();
  const { data, isLoading } = useReadContract({
    address: addrs?.oddToken,
    abi: ODD_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!addrs && !!address },
  });

  return {
    balance: data !== undefined ? formatUnits(data, 18) : "0",
    isLoading,
  };
}

/**
 * Global pool stats（REQ-005）— 改读后端 GET /account/onchain/stake/stats（带 JWT），删链上 useReadContracts。
 *
 * - totalStaked = 后端 total_staked_wei（链上 accountedOddBalance）；无数据/未登录返回 undefined，
 *   由 StakeTab 展示「—」（不回落 mock，REQ-005 §2 决策）。
 * - minStakeAmount = 后端 min_stake_wei；缺省兜底 "100"。
 * - reward_pool 语义 + 每档 apy 口径待 PM 确认 → 本期不接 reward_pool 展示、APY 仍由 calc.ts 本地估算。
 */
export function useStakingGlobalStats(): {
  totalStaked: string | undefined;
  minStakeAmount: string;
  isLoading: boolean;
  refetch: () => void;
} {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { address } = useAccount();

  const { data, isLoading, refetch } = useQuery({
    queryKey: accountKeys.stakeStats(address),
    queryFn: getStakeStats,
    enabled: isAuthenticated && !!address,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 2,
  });

  return {
    totalStaked: data ? formatUnits(BigInt(data.total_staked_wei), 18) : undefined,
    minStakeAmount: data ? formatUnits(BigInt(data.min_stake_wei), 18) : "100",
    isLoading,
    // BUG-023：暴露 refetch，供写操作（stake/unstake）成功后主动刷新全局 Total Staked，
    // 不再只等 refetchInterval 的 30s 轮询。
    refetch,
  };
}

/**
 * User's active staking positions and withdrawal history.
 * Strategy: read StakeCreated + StakeWithdrawn events, then batch-read position structs.
 */
export function useUserStaking(address?: Address): {
  activePositions: StakingPosition[];
  historyRecords: HistoryRecord[];
  isLoading: boolean;
  refetch: () => void;
} {
  const addrs = resolveAddresses();
  const publicClient = usePublicClient({ chainId: CORE_CHAIN.id });

  // ── Step 1: fetch events ────────────────────────────────────────
  const {
    data: eventData,
    isLoading: isEventsLoading,
    refetch,
  } = useQuery({
    queryKey: ["staking-events", CORE_CHAIN.id, address],
    queryFn: async () => {
      if (!publicClient || !address || !addrs) return { created: [], withdrawn: [] };
      const [created, withdrawn] = await Promise.all([
        publicClient.getLogs({
          address: addrs.stakingPool,
          event: STAKE_CREATED_EVENT,
          args: { user: address },
          fromBlock: 0n,
        }),
        publicClient.getLogs({
          address: addrs.stakingPool,
          event: STAKE_WITHDRAWN_EVENT,
          args: { user: address },
          fromBlock: 0n,
        }),
      ]);
      // Fetch block timestamps for withdrawal history (usually few records)
      const withdrawnWithTs = await Promise.all(
        withdrawn.map(async (log) => {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
          return { log, blockTimestamp: Number(block.timestamp) };
        })
      );
      return { created, withdrawn: withdrawnWithTs };
    },
    enabled: !!publicClient && !!address && !!addrs,
    staleTime: 30_000,
  });

  const createdLogs = useMemo(() => eventData?.created ?? [], [eventData]);
  const withdrawnWithTs = useMemo(() => eventData?.withdrawn ?? [], [eventData]);

  // ── Step 2: positionIds 由事件驱动（initial scan 回填 + watcher push）─
  const [positionIds, setPositionIds] = useState<bigint[]>([]);

  // 钱包切换清空
  useEffect(() => {
    setPositionIds([]);
  }, [address]);

  // 初始扫描结果回填进 useState
  useEffect(() => {
    if (createdLogs.length === 0) return;
    setPositionIds((prev) => {
      const seen = new Set(prev.map(String));
      const merged = [...prev];
      let added = false;
      for (const log of createdLogs) {
        const id = log.args.positionId;
        if (id !== undefined && !seen.has(String(id))) {
          merged.push(id);
          seen.add(String(id));
          added = true;
        }
      }
      return added ? merged.sort((a, b) => (a < b ? -1 : 1)) : prev;
    });
  }, [createdLogs]);

  const {
    data: positionsData,
    isLoading: isPositionsLoading,
    refetch: refetchPositionStructs,
  } = useReadContracts({
    contracts: positionIds.map((id) => ({
      address: addrs!.stakingPool,
      abi: STAKING_POOL_ABI,
      functionName: "positions" as const,
      args: [id] as const,
    })),
    query: { enabled: positionIds.length > 0 && !!addrs },
  });

  // ── Step 3: read current accRewardPerShare for pending reward ───
  const { data: liveAccRewardPerShare, refetch: refetchAccReward } = useReadContract({
    address: addrs?.stakingPool,
    abi: STAKING_POOL_ABI,
    functionName: "accRewardPerShare",
    query: { enabled: positionIds.length > 0 && !!addrs },
  });
  const accRewardPerShare = liveAccRewardPerShare ?? 0n;

  // ── Step 3b: 事件订阅（StakeCreated / StakeWithdrawn / RewardNotified）─
  // onLogs 必须 useCallback 防止 wagmi 内部 unwatch+rewatch RPC 抖动
  // （wagmi 把 onLogs 放进内部 useEffect deps，inline 箭头每次新引用 → 频繁 re-subscribe）
  const handleCreatedLogs = useCallback(
    (logs: Array<{ args: { user?: `0x${string}`; positionId?: bigint } }>) => {
      const lower = address?.toLowerCase();
      if (!lower) return;
      const mine: bigint[] = [];
      for (const log of logs) {
        if (log.args.user?.toLowerCase() === lower && log.args.positionId !== undefined) {
          mine.push(log.args.positionId);
        }
      }
      if (mine.length === 0) return;
      setPositionIds((prev) => {
        const seen = new Set(prev.map(String));
        const toAdd = mine.filter((id) => !seen.has(String(id)));
        return toAdd.length > 0 ? [...prev, ...toAdd].sort((a, b) => (a < b ? -1 : 1)) : prev;
      });
      refetchPositionStructs();
    },
    [address, refetchPositionStructs]
  );

  // StakeWithdrawn — earlyUnstake 在 totalWeightedShares>0 时会同时 emit RewardNotified，
  // 双重刷新让 pending reward + position struct 同步
  const handleWithdrawnLogs = useCallback(
    (logs: Array<{ args: { user?: `0x${string}` } }>) => {
      const lower = address?.toLowerCase();
      if (!lower) return;
      const concernsUser = logs.some((l) => l.args.user?.toLowerCase() === lower);
      if (!concernsUser) return;
      refetchPositionStructs();
      refetchAccReward();
      // 历史区也需要刷新
      refetch();
    },
    [address, refetchPositionStructs, refetchAccReward, refetch]
  );

  // RewardNotified — 全员事件（不带 user），刷 accRewardPerShare 让 pending 跳变
  const handleRewardLogs = useCallback(() => {
    refetchAccReward();
  }, [refetchAccReward]);

  useWatchContractEvent({
    address: addrs?.stakingPool,
    abi: STAKING_POOL_ABI,
    eventName: "StakeCreated",
    onLogs: handleCreatedLogs,
    enabled: !!addrs && !!address,
  });

  useWatchContractEvent({
    address: addrs?.stakingPool,
    abi: STAKING_POOL_ABI,
    eventName: "StakeWithdrawn",
    onLogs: handleWithdrawnLogs,
    enabled: !!addrs && !!address,
  });

  useWatchContractEvent({
    address: addrs?.stakingPool,
    abi: STAKING_POOL_ABI,
    eventName: "RewardNotified",
    onLogs: handleRewardLogs,
    enabled: !!addrs,
  });

  // ── Step 4: derive active positions ────────────────────────────
  const activePositions = useMemo<StakingPosition[]>(() => {
    if (!positionsData) return [];
    const nowSec = Math.floor(Date.now() / 1000);

    return positionsData
      .map((res, idx): StakingPosition | null => {
        if (res.status !== "success") return null;
        const positionId = positionIds[idx];
        // Defensive: positionsData may briefly carry stale entries when positionIds shrinks
        if (positionId === undefined) return null;
        const pos = res.result;

        const plan = getPlanById(pos.planId);
        const unlockAtSec = Number(pos.unlockAt);
        // DD-149：反推质押开始时间用真实天数（lockDays × 86400），不再用错的小时口径
        const stakedAtSec = unlockAtSec - plan.lockDays * 86400;
        const status = derivePositionStatus({ active: pos.active, unlockAt: unlockAtSec }, nowSec);

        // Withdrawn positions live in history list only — exclude from active list
        if (status === "withdrawn") return null;

        // pendingReward = weight * (accRewardPerShare - rewardDebt) / 1e18
        const pendingReward =
          accRewardPerShare >= pos.rewardDebt
            ? (pos.weight * (accRewardPerShare - pos.rewardDebt)) / ODD_WAD
            : 0n;

        return {
          id: positionId.toString(),
          amount: formatUnits(pos.principal, 18),
          multiplier: plan.multiplier,
          lockDays: plan.lockDays,
          status,
          stakedAt: new Date(stakedAtSec * 1000).toISOString(),
          unlockAt: new Date(unlockAtSec * 1000).toISOString(),
          earned: formatUnits(pendingReward, 18),
        };
      })
      .filter((p): p is StakingPosition => p !== null);
  }, [positionsData, accRewardPerShare, positionIds]);

  // ── Step 5: derive history from StakeWithdrawn events ──────────
  const historyRecords = useMemo<HistoryRecord[]>(() => {
    const planIdByPosition = new Map<string, number>(
      createdLogs.map((log) => [log.args.positionId!.toString(), log.args.planId ?? 0])
    );

    return withdrawnWithTs.map(({ log, blockTimestamp }) => {
      const posId = log.args.positionId!.toString();
      const planId = planIdByPosition.get(posId) ?? 0;
      const plan = getPlanById(planId);

      return {
        id: posId,
        action: (log.args.early ? "early_unstake" : "unstake") as HistoryRecord["action"],
        amount: formatUnits(log.args.principal!, 18),
        lockDays: plan.lockDays,
        multiplier: plan.multiplier,
        date: new Date(blockTimestamp * 1000).toISOString(),
        // early=true 时合约 reward 字段是计算值但用户未收到（被重分配/归库），
        // 数据层与 UI 隐藏行为对齐：早退不带 reward
        reward:
          !log.args.early && log.args.reward && log.args.reward > 0n
            ? formatUnits(log.args.reward, 18)
            : undefined,
      } satisfies HistoryRecord;
    });
  }, [withdrawnWithTs, createdLogs]);

  return {
    activePositions,
    historyRecords,
    isLoading: isEventsLoading || isPositionsLoading,
    refetch,
  };
}
