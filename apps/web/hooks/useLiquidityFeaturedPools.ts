/**
 * useLiquidityFeaturedPools — DD-130 / REQ-004：比赛池列表后端驱动（零合约调用）
 *
 * 池列表 + 总存入量 + 总下注量全部来自后端 GET /liquidity/match/pools：
 *   - totalDeposited ← total_deposited_wei（后端读权威 LiquidityPool 聚合，REQ-004）
 *   - totalBet(总下注量) ← total_bet_wei（后端按 match_id 聚合全盘口有效 stake，REQ-004）
 * myBalance 由后端持仓（useLpPositions，REST）按 poolId 累加。
 *
 * REQ-004 前：totalDeposited 走链上 useReadContracts(pools) 只读补、总下注量列恒 null。
 * 后端字段就绪后已删除该链上直读，本 hook 不再依赖前端维护合约地址。
 */
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import { getLiquidityMatchPools } from "@/lib/api";
import { formatKickoffLong } from "@/lib/match-utils";
import { liquidityKeys } from "@/lib/query-keys";
import { useLpPositions, type LpPositionData } from "./useLpPositions";
import type { LiquidityMatchPool } from "@/types/onchain-liquidity";
import type { SportCategory } from "@/components/pools/types";

/** 单个 match pool 的合并数据（字段契约不变，PoolMarketTable/Row + PoolMatchDepositModal 消费） */
export interface LpMatchPoolData {
  match: string;
  matchDate: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  sport: SportCategory;
  hot: boolean;
  matchId: `0x${string}`;
  poolId: bigint;
  totalDeposited: bigint;
  depositOpen: boolean;
  depositCloseAt: bigint;
  unlockAt: bigint;
  canDeposit: boolean;
  myBalance: bigint;
  /** 总下注量（wei）= 后端 total_bet_wei。后端无数据返回 "0"，故恒为 bigint（无 null/"—"语义） */
  totalBet: bigint;
  estApy: string;
}

interface UseLiquidityFeaturedPoolsOpts {
  search?: string;
  userAddress?: Address;
}

export interface UseLiquidityFeaturedPoolsResult {
  pools: LpMatchPoolData[];
  isLoading: boolean;
  isBalanceFetching: boolean;
  refetch: () => void;
}

/**
 * 装配 LpMatchPoolData[] — 纯函数，导出供单测。
 *
 * @param backendPools 后端 /liquidity/match/pools 列表（已按 deposit_close_at 升序，含 total_deposited_wei / total_bet_wei）
 * @param positions 用户 LP 仓位（按 poolId 累加 myBalance）
 * @param nowSec 装配时刻（秒）
 */
export function assemblePoolsData(
  backendPools: LiquidityMatchPool[],
  positions: LpPositionData[],
  nowSec: bigint
): LpMatchPoolData[] {
  return backendPools.map((p, i) => {
    const poolId = BigInt(p.pool_id);
    const matchId = p.match_id as `0x${string}`;
    const depositCloseAt = BigInt(p.deposit_close_at ?? 0);
    const canDeposit = depositCloseAt > 0n && nowSec < depositCloseAt;

    const myBalance = positions
      .filter(
        (pos) =>
          poolId !== 0n &&
          pos.poolId === poolId &&
          pos.state !== LP_POSITION_STATE.Withdrawn &&
          pos.state !== LP_POSITION_STATE.Liquidated
      )
      .reduce((sum, pos) => sum + pos.principal, 0n);

    return {
      match: p.fixture_name || matchId,
      matchDate: p.match_start_time ? formatKickoffLong(p.match_start_time) : "",
      homeTeamLogo: p.home_team_logo ?? "",
      awayTeamLogo: p.away_team_logo ?? "",
      sport: "football" as const,
      hot: i < 3,
      matchId,
      poolId,
      // 后端权威值（缺省/旧缓存兜底 "0"，避免 BigInt(undefined) 抛错）
      totalDeposited: BigInt(p.total_deposited_wei ?? "0"),
      depositOpen: canDeposit,
      depositCloseAt,
      unlockAt: BigInt(p.match_end_time ?? 0),
      canDeposit,
      myBalance,
      totalBet: BigInt(p.total_bet_wei ?? "0"),
      estApy: "—",
    };
  });
}

export function useLiquidityFeaturedPools(
  opts: UseLiquidityFeaturedPoolsOpts = {}
): UseLiquidityFeaturedPoolsResult {
  const { search, userAddress } = opts;

  // 公开列表（免鉴权），15s 轮询兜底（后端 5s 缓存）
  const {
    data: matchPoolsRes,
    isLoading: poolsLoading,
    refetch,
  } = useQuery({
    queryKey: liquidityKeys.matchPools(),
    queryFn: getLiquidityMatchPools,
    staleTime: 5_000,
    // 15s 轮询：deposit_close_at 临界时 canDeposit 状态及时刷新（REV-v1 M3）
    refetchInterval: 15_000,
    retry: 2,
  });

  const { positions, isLoading: positionsLoading } = useLpPositions(userAddress);

  // 搜索：客户端按比赛名过滤（后端列表为全量 open pools）
  const backendPools = useMemo<LiquidityMatchPool[]>(() => {
    const list = matchPoolsRes?.list ?? [];
    if (!search?.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((p) => (p.fixture_name ?? "").toLowerCase().includes(q));
  }, [matchPoolsRes, search]);

  const pools = useMemo<LpMatchPoolData[]>(() => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    return assemblePoolsData(backendPools, positions, nowSec);
  }, [backendPools, positions]);

  return {
    pools,
    isLoading: poolsLoading,
    isBalanceFetching: positionsLoading,
    refetch,
  };
}
