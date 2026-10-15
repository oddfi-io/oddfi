"use client";

/**
 * DD-119 §6.1 GET /presale/position。需登录，绑当前 EOA。
 * 认购 confirmed 后由 useDeposit invalidate presaleKeys.all 主动刷新。
 */
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { presaleKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/authStore";
import { getPosition } from "../api";

export function usePosition() {
  const { address } = useAccount();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: presaleKeys.position(address),
    queryFn: getPosition,
    enabled: isAuthenticated,
    staleTime: 10_000,
  });
}
