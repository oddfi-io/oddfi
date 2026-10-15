"use client";

/**
 * DD-148 §3.2 — 关注核验。
 *
 * 默认读快照（checkTwitterFollow(false)，快、不压第三方限流），retry:false 不自动重试。
 * refresh() 手动触发实时复查（checkTwitterFollow(true)），结果回写 query cache。
 * 429 → mutation error 为 TwitterCheckFollowError("rate_limited")，调用方据此 toast 退避，
 * 并用 isRefreshing 在途禁用按钮（防狂点压限流）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twitterKeys } from "@/lib/query-keys";
import { checkTwitterFollow } from "../api";
import type { CheckFollowResult } from "../types";

export function useTwitterFollow(opts: { enabled: boolean; address: string | undefined }) {
  const qc = useQueryClient();
  const followKey = twitterKeys.follow(opts.address);

  const query = useQuery({
    queryKey: followKey,
    queryFn: () => checkTwitterFollow(false),
    enabled: opts.enabled,
    staleTime: 30_000,
    retry: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => checkTwitterFollow(true),
    onSuccess: (data: CheckFollowResult) => qc.setQueryData(followKey, data),
  });

  return {
    follow: query.data,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
    refreshError: refreshMutation.error,
    resetRefreshError: refreshMutation.reset,
  };
}
