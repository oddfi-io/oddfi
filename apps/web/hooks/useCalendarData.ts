/**
 * Calendar 数据查询 hooks（TanStack Query 封装 lib/calendar/api）。
 *
 * 与 lib/calendar/api 的关系：
 *   - lib 层是抽象数据源（mock 或真实接口）
 *   - hook 层加上 staleTime / 错误处理 / locale 联动
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  getCalendarTournament,
  getCalendarMatches,
  getCalendarMatchById,
} from "@/lib/calendar/api";
import { TOURNAMENT_ID } from "@/lib/calendar/constants";

const STALE_5_MIN = 5 * 60 * 1000;

/** 拉取赛事元（stages / dates / groups / window） */
export function useCalendarTournament() {
  const locale = useLocale();
  return useQuery({
    queryKey: ["calendar", "tournament", TOURNAMENT_ID, locale],
    queryFn: () => getCalendarTournament(),
    staleTime: STALE_5_MIN,
  });
}

/** 拉取整届 104 场比赛列表 */
export function useCalendarMatches() {
  const locale = useLocale();
  return useQuery({
    queryKey: ["calendar", "matches", TOURNAMENT_ID, locale],
    queryFn: () => getCalendarMatches(),
    staleTime: STALE_5_MIN,
  });
}

/**
 * 按 fixture_id 取单场（用于 Calendar 详情列）。
 * Calendar 详情列复用 MatchDetailContent 直接传 fixture，**不走** useQuery；
 * 此 hook 仅供需要 await 详情数据的旁路场景使用。
 */
export function useCalendarMatchById(fixtureId: number | null) {
  return useQuery({
    queryKey: ["calendar", "matchById", fixtureId],
    queryFn: () => getCalendarMatchById(fixtureId as number),
    enabled: typeof fixtureId === "number" && fixtureId > 0,
    staleTime: STALE_5_MIN,
  });
}
