"use client";

/**
 * DD-104: Match Detail Overview hook。
 *
 * 后端契约：GET /api/v1/match-detail/overview/{fixtureId}
 *           (oddfi-backend commit 873beed)
 *
 * 轮询联动：stateId 由父组件从 useMoneylineHistory 透传，
 *   复用 isLiveMoneylineState 判定赛中频率（30s）vs 赛前（60s）。
 *
 * settledOnce 防骨架闪烁：照搬 useMoneylineHistory 套路，
 *   首次 settled 后即使 refetch 期间也不再触发 skeleton。
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMatchDetailOverview } from "@/lib/api";
import { isLiveMoneylineState } from "@/hooks/useMoneylineHistory";
import { toMatchOverviewDomain } from "@/lib/match-detail-adapter";
import type { MatchOverviewDomain } from "@/types/match-detail-domain";

const POLL_LIVE_MS = 30_000;
const POLL_PREMATCH_MS = 60_000;
const STALE_MS = 15_000;
const GC_MS = 120_000;

export interface UseMatchDetailOverviewResult {
  data: MatchOverviewDomain | null;
  isLoading: boolean;
  isError: boolean;
}

export function useMatchDetailOverview(
  fixtureId: number,
  stateId?: number
): UseMatchDetailOverviewResult {
  const query = useQuery({
    queryKey: ["match-detail-overview", fixtureId] as const,
    queryFn: () => getMatchDetailOverview(fixtureId),
    enabled: fixtureId > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    refetchInterval: () => (isLiveMoneylineState(stateId) ? POLL_LIVE_MS : POLL_PREMATCH_MS),
    refetchIntervalInBackground: false,
    retry: 1,
  });

  // 骨架屏只在首次落地前显示（防 refetch 期间骨架闪烁）
  const settledOnce = query.dataUpdatedAt > 0 || query.errorUpdatedAt > 0;

  // 引用稳定：依赖 dataUpdatedAt 而非 query.data，避免每次 render 都产新对象 →
  // 触发下游 MatchOverviewPanel.memo 误重渲染（照搬 useMoneylineHistory B1.2 模式）
  const data = useMemo(
    () => (query.data ? toMatchOverviewDomain(query.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意以 dataUpdatedAt 而非 query.data 作依赖
    [query.dataUpdatedAt]
  );

  return {
    data,
    isLoading: query.isLoading && !settledOnce,
    isError: query.isError,
  };
}
