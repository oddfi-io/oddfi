"use client";

/**
 * DD-119 §6.1 GET /presale/deposit/list 入账历史分页。需登录。
 * 返回经 adaptDepositList 归一（items/total），组件不直读原始键。
 */
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { presaleKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/authStore";
import { getDepositList } from "../api";
import type { ListQuery } from "../types";

export function useDepositList(params: ListQuery = {}) {
  const { address } = useAccount();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    // params 仅作 queryKey 序列化用，widen 为 Record（非逻辑断言）
    queryKey: presaleKeys.depositList(address, params as Record<string, unknown>),
    queryFn: () => getDepositList(params),
    enabled: isAuthenticated,
    staleTime: 10_000,
  });
}
