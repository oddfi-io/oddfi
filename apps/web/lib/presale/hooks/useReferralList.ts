"use client";

/**
 * DD-119 §7.3 GET /referral/list（站点级）。我邀请的用户 + 逐笔贡献。
 * 返回经 adaptReferralList 归一（items + boundAt→joinedAt）。默认 business=presale。
 */
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { referralKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/authStore";
import { getReferralList } from "../api";
import type { ListQuery } from "../types";

export function useReferralList(params: ListQuery = { business: "presale" }) {
  const { address } = useAccount();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: referralKeys.list(address, params as Record<string, unknown>),
    queryFn: () => getReferralList(params),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}
