"use client";

/**
 * DD-119 §7 GET /referral/me（站点级）。我的邀请码 + 邀请人 + 累计奖励 ODD。
 * 返回经 adaptReferralMe 归一（invitedCount/totalRewardOdd）。
 */
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { referralKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/authStore";
import { getReferralMe } from "../api";

const REFERRAL_POLL_INTERVAL_MS = 3_000;
// dataUpdateCount 仅在「成功 fetch」时自增（@tanstack/query-core query.js case "success"）：
// 成功 10 次（~30s）仍无码 → 放弃；
// errorUpdateCount 仅在「失败」时自增：后端持续异常（401/500）时 dataUpdateCount 永不增，
// 必须用 errorUpdateCount 单独兜底，否则会无限重试打爆 /referral/me。
const REFERRAL_POLL_MAX_SUCCESS = 10;
const REFERRAL_POLL_MAX_ERROR = 5;

/**
 * 新用户：后端登录鉴权 hook 异步幂等建码（auth.go），首次取 /me 可能 myCode 尚未落库。
 * 空码时轮询重取直到拿到码；成功上限 + 错误上限双封顶，避免正常空窗 / 后端异常时无限轮询。
 */
export function nextReferralPollInterval(state: {
  data?: { myCode?: string | null };
  dataUpdateCount: number;
  errorUpdateCount: number;
}): number | false {
  if (state.data?.myCode) return false;
  if (state.dataUpdateCount >= REFERRAL_POLL_MAX_SUCCESS) return false;
  if (state.errorUpdateCount >= REFERRAL_POLL_MAX_ERROR) return false;
  return REFERRAL_POLL_INTERVAL_MS;
}

export function useReferralMe() {
  const { address } = useAccount();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: referralKeys.me(address),
    queryFn: getReferralMe,
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: (query) => nextReferralPollInterval(query.state),
  });
}
