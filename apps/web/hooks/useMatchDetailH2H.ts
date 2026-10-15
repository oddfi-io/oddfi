"use client";

/**
 * DD-104: Match Detail H2H tab hook。
 *
 * 后端契约：GET /api/v1/match-detail/h2h/{fixtureId}
 *           (oddfi-backend commit 873beed)
 *
 * staleTime 30min：后端 cache 24h，此处前端层面短期缓存。
 * 无主动轮询（H2H 数据实时性要求低）。
 * enabled 参数由父组件（OverviewTabs）控制，tab 切换时才激活。
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMatchDetailH2H } from "@/lib/api";
import { toMatchH2HDomain } from "@/lib/match-detail-adapter";
import type { MatchH2HDomain } from "@/types/match-detail-domain";

const STALE_MS = 30 * 60 * 1000; // 30 min
// gcTime 与 staleTime 同量级，避免 tab 切走 2min 后 cache 被回收
const GC_MS = 30 * 60_000; // 30 min

export interface UseMatchDetailH2HResult {
  data: MatchH2HDomain | null;
  isLoading: boolean;
  isError: boolean;
}

export function useMatchDetailH2H(fixtureId: number, enabled: boolean): UseMatchDetailH2HResult {
  const query = useQuery({
    queryKey: ["match-detail-h2h", fixtureId] as const,
    queryFn: () => getMatchDetailH2H(fixtureId),
    enabled: enabled && fixtureId > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });

  const settledOnce = query.dataUpdatedAt > 0 || query.errorUpdatedAt > 0;

  // 引用稳定：依赖 dataUpdatedAt 而非 query.data，防 tab 回切时 memo 失效
  const data = useMemo(
    () => (query.data ? toMatchH2HDomain(query.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意以 dataUpdatedAt 而非 query.data 作依赖
    [query.dataUpdatedAt]
  );

  return {
    data,
    isLoading: query.isLoading && !settledOnce,
    isError: query.isError,
  };
}
