"use client";

/**
 * DD-104: Match Detail Lineups tab hook。
 *
 * 后端契约：GET /api/v1/match-detail/lineups/{fixtureId}
 *           (oddfi-backend commit 873beed)
 *
 * staleTime 5min：阵容数据赛前 ≥ 1h 为 null，赛前 1h 内才公布，需要相对频繁的缓存失效。
 * 无主动轮询（通过 staleTime 自然失效后重拉）。
 * enabled 参数由父组件（OverviewTabs）控制，tab 切换时才激活。
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMatchDetailLineups } from "@/lib/api";
import { toMatchLineupsDomain } from "@/lib/match-detail-adapter";
import type { MatchLineupsDomain } from "@/types/match-detail-domain";

const STALE_MS = 5 * 60 * 1000; // 5 min
// gcTime 与 staleTime 同量级，避免 tab 切走 2min 后 cache 被回收
const GC_MS = 5 * 60_000; // 5 min

export interface UseMatchDetailLineupsResult {
  data: MatchLineupsDomain | null;
  isLoading: boolean;
  isError: boolean;
}

export function useMatchDetailLineups(
  fixtureId: number,
  enabled: boolean
): UseMatchDetailLineupsResult {
  const query = useQuery({
    queryKey: ["match-detail-lineups", fixtureId] as const,
    queryFn: () => getMatchDetailLineups(fixtureId),
    enabled: enabled && fixtureId > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });

  const settledOnce = query.dataUpdatedAt > 0 || query.errorUpdatedAt > 0;

  // 引用稳定：依赖 dataUpdatedAt 而非 query.data，防 tab 回切时 memo 失效
  const data = useMemo(
    () => (query.data ? toMatchLineupsDomain(query.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意以 dataUpdatedAt 而非 query.data 作依赖
    [query.dataUpdatedAt]
  );

  return {
    data,
    isLoading: query.isLoading && !settledOnce,
    isError: query.isError,
  };
}
