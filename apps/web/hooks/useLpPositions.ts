"use client";

import { useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getLiquidityPositions } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { accountKeys } from "@/lib/query-keys";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import type { LpPositionState } from "@/lib/abi/liquidityPool";
import { formatKickoffLong } from "@/lib/match-utils";
import { truncateAddress } from "@/lib/proxy-wallet/utils";
import { useLpRefetchStore } from "@/stores/lpRefetchStore";
import type {
  LiquidityPositionItem,
  LpPoolType,
  LpPositionStatus,
} from "@/types/onchain-liquidity";

// DD-130：LP 持仓从 wagmi 扫链（getLogs + multicall）改为后端 REST。
// 保留 LpPositionData 形状（含 LpPositionState 枚举），PositionTable/WithdrawLpModal/featured-pools 零改动。

export interface LpPositionData {
  positionId: bigint;
  poolId: bigint; // 0=global pool；其他=match pool（uint256(matchId)）
  principal: bigint; // 1e18 ODD
  weight: bigint; // 后端不提供（前端未消费），置 0n
  unlockAt: bigint; // unix timestamp (use Number(unlockAt) * 1000 for ms)
  planId: number;
  state: LpPositionState; // 0=Active 1=Unbonding 2=Ready 3=Withdrawn 4=Liquidated 5=Withdrawable
  // ── 池子类型 + 赛事展示信息（fix/liquidity-positions-matchinfo）────────
  // ⚠️ 区分池子类型只看 poolType；fixtureName 等四件套在 spider 未同步时为
  // undefined，但 poolType 仍是 "match"（此时 fallback 展示 matchId 截断串）。
  poolType: LpPoolType;
  matchId?: string;
  fixtureName?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  /** 开赛时间（unix 秒） */
  matchStartTime?: number;
}

/** 持仓池子身份展示三态（PositionRow / PositionCard 共用，叶子组件只管布局） */
export interface LpPoolDisplay {
  /** true → 渲染队徽对（match 池）；false → 纯文本（global 池） */
  isMatch: boolean;
  /** match: 比赛名（spider 缺失时 fallback match_id 截断串）；global: 传入的 globalPoolLabel */
  title: string;
  /** 副行："#positionId" + match 池有开赛时间时拼 " · <kickoff>" */
  subline: string;
}

/**
 * 池子身份展示派生 — 分支只看 poolType（禁止用 fixtureName 是否为空推断池子类型）。
 * @param globalPoolLabel global 池标题，调用方传 t("allPoolsTitle")，与 Pools 页头文案一致
 *（"Global Pool — Plan #0" 对用户不可读，废弃）
 */
export function derivePoolDisplay(
  position: LpPositionData,
  globalPoolLabel: string
): LpPoolDisplay {
  const idTag = `#${String(position.positionId)}`;
  if (position.poolType === "match") {
    return {
      isMatch: true,
      title: position.fixtureName || truncateAddress(position.matchId ?? ""),
      subline: position.matchStartTime
        ? `${idTag} · ${formatKickoffLong(position.matchStartTime)}`
        : idTag,
    };
  }
  return {
    isMatch: false,
    title: globalPoolLabel,
    subline: idTag,
  };
}

export interface UseLpPositionsResult {
  positions: LpPositionData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** 后端 status 字符串 → 前端 LpPositionState 枚举（组件按枚举判分支） */
const STATUS_TO_STATE: Record<LpPositionStatus, LpPositionState> = {
  locked: LP_POSITION_STATE.Active,
  redeemable: LP_POSITION_STATE.Ready,
  unbonding: LP_POSITION_STATE.Unbonding,
  withdrawable: LP_POSITION_STATE.Withdrawable,
  withdrawn: LP_POSITION_STATE.Withdrawn,
  liquidated: LP_POSITION_STATE.Liquidated,
};

/** 纯映射：后端 LiquidityPositionItem → 前端 LpPositionData（导出供单测） */
export function mapLpPosition(item: LiquidityPositionItem): LpPositionData {
  return {
    positionId: BigInt(item.position_id),
    poolId: item.pool_type === "global" ? 0n : BigInt(item.match_id ?? "0"),
    principal: BigInt(item.amount_wei),
    weight: 0n,
    unlockAt: BigInt(item.unlock_at),
    // 后端 plan_id 为 omitempty：全局池 plan_id=0（零值）会被后端省略 → 前端收到 undefined。
    // 兜底回 0，避免下游拼出 "Plan undefined" / "Plan #"（空号）。
    planId: item.plan_id ?? 0,
    state: STATUS_TO_STATE[item.status] ?? LP_POSITION_STATE.Active,
    poolType: item.pool_type,
    matchId: item.match_id,
    fixtureName: item.fixture_name,
    homeTeamLogo: item.home_team_logo,
    awayTeamLogo: item.away_team_logo,
    matchStartTime: item.match_start_time,
  };
}

/**
 * 我的 LP 持仓（后端 REST 驱动，持仓 + 历史合一，含终态）。
 * `address` 入参仅用于 query key 隔离 + 兼容旧签名；实际由 token 鉴权决定归属。
 */
export function useLpPositions(address?: `0x${string}`): UseLpPositionsResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { address: connected } = useAccount();
  const owner = address ?? connected;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: accountKeys.lpPositions(owner),
    queryFn: getLiquidityPositions,
    enabled: isAuthenticated && !!owner,
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    retry: 2,
  });

  // deposit/unbond/withdraw 成功后 bump → 立即重拉（兼容写 hook 的刷新信号）
  const bumpKey = useLpRefetchStore((s) => s.bumpKey);
  useEffect(() => {
    if (bumpKey > 0) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpKey]);

  const positions = useMemo<LpPositionData[]>(() => (data?.list ?? []).map(mapLpPosition), [data]);

  return {
    positions,
    isLoading,
    error: error instanceof Error ? error : null,
    refetch,
  };
}
