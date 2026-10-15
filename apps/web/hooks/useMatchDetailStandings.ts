"use client";

/**
 * DD-104: Match Detail Standings tab hook。
 *
 * 后端契约：GET /api/v1/match-detail/standings/{fixtureId}
 *           (oddfi-backend commit 873beed)
 *
 * 后端一次返回所有 scope（{standings:{overall,home,away}}），scope query 参数被忽略。
 * queryKey 不含 scope（避免无意义的重复请求），hook 内部从 byScope 字典中 pick 当前 scope。
 * placeholderData: keepPreviousData 保留（scope 切换时保持旧数据直到 pick 完成）。
 * staleTime 30min，无主动轮询。
 */

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getMatchDetailStandings } from "@/lib/api";
import { toMatchStandingsDomain } from "@/lib/match-detail-adapter";
import type { MatchStandingsRowDomain } from "@/types/match-detail-domain";
import type { StandingsScope } from "@/types/moneyline";

const STALE_MS = 30 * 60 * 1000; // 30 min
// gcTime 与 staleTime 同量级，避免 tab 切走 2min 后 cache 被回收
const GC_MS = 30 * 60_000; // 30 min

export interface UseMatchDetailStandingsResult {
  /** 当前 scope 对应的行列表，null 表示数据未就绪 */
  rows: MatchStandingsRowDomain[] | null;
  leagueName: string | null;
  seasonName: string | null;
  isLoading: boolean;
  isError: boolean;
}

export function useMatchDetailStandings(
  fixtureId: number,
  scope: StandingsScope,
  enabled: boolean
): UseMatchDetailStandingsResult {
  const query = useQuery({
    // queryKey 不含 scope：后端一次返回全部 scope，无需按 scope 分拆请求
    queryKey: ["match-detail-standings", fixtureId] as const,
    queryFn: () => getMatchDetailStandings(fixtureId),
    enabled: enabled && fixtureId > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const settledOnce = query.dataUpdatedAt > 0 || query.errorUpdatedAt > 0;

  // 引用稳定：依赖 dataUpdatedAt + scope，scope 切换时重新 pick
  const domain = useMemo(
    () => (query.data ? toMatchStandingsDomain(query.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意以 dataUpdatedAt 而非 query.data 作依赖
    [query.dataUpdatedAt]
  );

  const rows = domain ? domain.byScope[scope] : null;

  return {
    rows,
    leagueName: domain?.leagueName ?? null,
    seasonName: domain?.seasonName ?? null,
    isLoading: query.isLoading && !settledOnce,
    isError: query.isError,
  };
}
