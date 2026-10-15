import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getPortfolioHistory } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { accountKeys } from "@/lib/query-keys";
import type { PortfolioHistoryParams } from "@/types/auth";

export type HistoryPreset = "realtime" | "normal";

export const PRESET_CONFIG: Record<HistoryPreset, { staleTime: number; refetchInterval: number }> =
  {
    realtime: { staleTime: 0, refetchInterval: 5_000 },
    normal: { staleTime: 0, refetchInterval: 5_000 },
  };

export function usePortfolioHistory(
  params: PortfolioHistoryParams,
  opts?: { preset?: HistoryPreset }
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { address } = useAccount();
  const cfg = PRESET_CONFIG[opts?.preset ?? "normal"];
  return useQuery({
    queryKey: accountKeys.history(address, params),
    queryFn: () => getPortfolioHistory(params),
    enabled: isAuthenticated && Boolean(address),
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval,
    placeholderData: keepPreviousData,
  });
}
