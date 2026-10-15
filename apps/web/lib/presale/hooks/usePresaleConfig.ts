"use client";

/**
 * DD-119 §6.1 GET /presale/config。公开（无需登录）。
 * staleTime 5s（对齐契约建议），refetchInterval 30s 跟随后端轮次进度/状态。
 */
import { useQuery } from "@tanstack/react-query";
import { presaleKeys } from "@/lib/query-keys";
import { getPresaleConfig } from "../api";

export function usePresaleConfig() {
  return useQuery({
    queryKey: presaleKeys.config(),
    queryFn: getPresaleConfig,
    staleTime: 5_000,
    refetchInterval: 30_000,
  });
}
