"use client";

/**
 * DD-126 · 比赛直播流 hook。
 *
 * 后端契约：GET /api/v1/fixture/:fixture_id/streams（oddfi-web-api/handler/fixture_streams.go）
 *   - stream_status: available（有 alive 记录）/ pending（无记录 + 未开赛）/ unavailable（无记录 + 已过开赛）
 *   - streams[] 已按 hd desc, stream_no asc 排序
 *
 * 渲染策略（约定，由 LiveStreamSection 消费）：
 *   - available   → 渲染播放器（默认 streams[0]）
 *   - pending     → 渲染占位 + 轮询（开赛前 5min 起每 60s）
 *   - unavailable → 不渲染整块
 *   - isError     → 不渲染（直播是增量信息，失败不打断详情页）
 *
 * 轮询仅在 pending 态触发，且 startingAtTimestamp 已知时限定在开赛前 5min 内，
 * 避免远期 pending 比赛在长会话里持续刷请求（后端单 IP 60 次/分钟限流）。
 */
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFixtureStreams, MarketApiError } from "@/lib/api";
import type { FixtureStreamItem, StreamStatus } from "@/types/streams";

const POLL_MS = 60_000;
const STALE_MS = 60_000;
const GC_MS = 120_000;
/** AC2：pending 态在开赛前多久开始轮询。 */
export const PENDING_POLL_LEAD_MS = 5 * 60_000;

/**
 * 是否应轮询 pending 态（纯函数，便于测试）。
 *   - 非 pending → 不轮询
 *   - 无开赛时间 → 直接轮询（保守，确保能等到 available）
 *   - 有开赛时间 → 仅在「开赛前 5min ~」窗口内轮询
 */
export function shouldPollPending(
  status: StreamStatus | undefined,
  startingAtMs: number | null,
  nowMs: number
): boolean {
  if (status !== "pending") return false;
  if (startingAtMs == null) return true;
  return nowMs >= startingAtMs - PENDING_POLL_LEAD_MS;
}

/**
 * 是否重试请求（纯函数，便于测试）。
 *   - body code 400（fixture_id 非法，不该发生）→ 不重试
 *   - 其余（429 限流 / 500 后端错 / 网络错）→ 最多重试 2 次
 */
export function shouldRetryStreams(failureCount: number, error: unknown): boolean {
  if (error instanceof MarketApiError && error.code === 400) return false;
  return failureCount < 2;
}

export interface UseFixtureStreamsResult {
  status: StreamStatus | null;
  streams: FixtureStreamItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useFixtureStreams(
  fixtureId: number,
  opts?: { enabled?: boolean; startingAtTimestamp?: number | null }
): UseFixtureStreamsResult {
  const externallyEnabled = opts?.enabled ?? true;
  const startingAtMs = opts?.startingAtTimestamp != null ? opts.startingAtTimestamp * 1000 : null;

  const query = useQuery({
    queryKey: ["fixture-streams", fixtureId] as const,
    queryFn: () => getFixtureStreams(fixtureId),
    enabled: externallyEnabled && fixtureId > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    refetchInterval: (q) =>
      shouldPollPending(q.state.data?.stream_status, startingAtMs, Date.now()) ? POLL_MS : false,
    refetchIntervalInBackground: false,
    retry: shouldRetryStreams,
  });

  // 首轮 settled（成功或失败）后不再因 retry 闪 loading（对齐 useMoneylineHistory）。
  const settledOnce = query.dataUpdatedAt > 0 || query.errorUpdatedAt > 0;

  // query.refetch 本身稳定，用 useCallback 包一层保持暴露引用稳定，避免下游 deps 每帧失效。
  const refetch = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  return {
    status: query.data?.stream_status ?? null,
    streams: query.data?.streams ?? [],
    isLoading: query.isLoading && !settledOnce,
    isError: query.isError,
    refetch,
  };
}
