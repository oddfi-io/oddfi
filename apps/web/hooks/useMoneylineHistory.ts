"use client";

/**
 * DD-102 · Moneyline 历史曲线 hook。
 *
 * 后端契约：GET /api/v1/moneyline/history/{fixtureId}?downsample=auto
 *           (oddfi-web-api commit 0ffc071)
 *
 * 适配职责：
 *   - 后端 normalized_pct (%) → 前端 MoneylineTrendPoint.value
 *   - 后端 captured_at (RFC3339Nano) → 前端 time
 *   - 动态轮询：赛中 state_id ∈ MONEYLINE_LIVE_STATES 时 30s，否则 60s
 *
 * 渲染策略（约定）：
 *   - isLoading            → 父组件渲染 skeleton
 *   - isError / 三方均为空 → 父组件不渲染 Panel
 *   - 有任一方点位         → 父组件渲染 Panel
 *
 * ENH-031 B1.2：trend 引用稳定。后端按 30/60s 轮询时，cache hit 直接复用旧 data 引用
 * （TanStack Query v5 structuralSharing 默认开），useMemo 依赖 dataUpdatedAt 而非 query.data
 * 自身，确保 toMoneylineTrend 仅在真正有新数据时重算，避免下游 MoneylineChart effect 误触发。
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMoneylineHistory } from "@/lib/api";
import {
  MONEYLINE_LIVE_STATES,
  type MoneylineHistoryFixture,
  type MoneylineHistoryPoint,
  type MoneylineHistoryResponse,
  type MoneylineTrend,
} from "@/types/moneyline";

const POLL_LIVE_MS = 30_000;
const POLL_PREMATCH_MS = 60_000;
const STALE_MS = 15_000;
/** ENH-031 B2.5：用户频繁切赛事时 query 缓存上限，超过窗口未访问则回收，避免长会话 heap 堆积。 */
const GC_MS = 120_000;

function adaptPoint(point: MoneylineHistoryPoint) {
  return { time: point.captured_at, value: point.normalized_pct };
}

/** 后端响应 → 前端 trend；空 fixture / 全空数组直接返回 null 让父组件不渲染。 */
export function toMoneylineTrend(
  api: MoneylineHistoryResponse | undefined | null
): MoneylineTrend | null {
  if (!api) return null;
  const hasAny = api.home.length > 0 || api.draw.length > 0 || api.away.length > 0;
  if (!hasAny) return null;
  return {
    home: api.home.map(adaptPoint),
    draw: api.draw.map(adaptPoint),
    away: api.away.map(adaptPoint),
  };
}

export function isLiveMoneylineState(stateId: number | null | undefined): boolean {
  return stateId != null && MONEYLINE_LIVE_STATES.has(stateId);
}

export interface UseMoneylineHistoryResult {
  trend: MoneylineTrend | null;
  fixture: MoneylineHistoryFixture | null;
  /** 当前轮询是否赛中频率（30s） */
  isLive: boolean;
  isLoading: boolean;
  isError: boolean;
}

export function useMoneylineHistory(fixtureId: number): UseMoneylineHistoryResult {
  const query = useQuery({
    queryKey: ["moneyline-history", fixtureId] as const,
    queryFn: () => getMoneylineHistory(fixtureId),
    enabled: fixtureId > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    refetchInterval: (q) => {
      const stateId = q.state.data?.fixture?.state_id;
      return isLiveMoneylineState(stateId) ? POLL_LIVE_MS : POLL_PREMATCH_MS;
    },
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const fixture = query.data?.fixture ?? null;

  // 骨架屏只在"首次落地前"显示。
  // 原因：v5 的 isLoading = isPending && isFetching；当接口持续失败时 data 始终 undefined →
  //       isPending 一直 true，每次 refetchInterval retry 都会瞬间 isLoading=true，骨架屏就会
  //       周期闪烁。用 dataUpdatedAt / errorUpdatedAt 派生"是否曾结束过一次"，从根上消除闪烁：
  //       一旦首轮 settled（成功或失败），后续 retry 期间不再触发骨架屏。
  const settledOnce = query.dataUpdatedAt > 0 || query.errorUpdatedAt > 0;

  // B1.2：trend 引用按 dataUpdatedAt 稳定，避免每次 render 都跑 toMoneylineTrend 产新对象 →
  // 触发下游 MoneylineChart 的 data effect 误重跑（之前每 render 都产新 trend 引用）。
  const trend = useMemo(
    () => toMoneylineTrend(query.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意以 dataUpdatedAt 而非 query.data 作依赖
    [query.dataUpdatedAt]
  );

  return {
    trend,
    fixture,
    isLive: isLiveMoneylineState(fixture?.state_id),
    isLoading: query.isLoading && !settledOnce,
    isError: query.isError,
  };
}
