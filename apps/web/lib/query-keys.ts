/**
 * TanStack Query key factory for account-scoped queries.
 *
 * All keys share the ["account"] prefix so that `performLogout()` can
 * remove every account-related cache entry with a single prefix match:
 *   queryClient.removeQueries({ queryKey: accountKeys.all })
 */
import type { PortfolioHistoryParams } from "@/types/auth";

export const accountKeys = {
  all: ["account"] as const,
  balance: (address: string | undefined) => ["account", address, "balance"] as const,
  history: (address: string | undefined, params: PortfolioHistoryParams) =>
    ["account", address, "portfolio-history", params] as const,
  historyInfinite: (address: string | undefined, params: Omit<PortfolioHistoryParams, "page">) =>
    ["account", address, "portfolio-history-infinite", params] as const,
  // DD-130 onchain stake / liquidity（绑当前登录 address，登出随 accountKeys.all 清理）
  stakeHistory: (address: string | undefined) =>
    ["account", address, "onchain-stake-history"] as const,
  stakeStats: (address: string | undefined) => ["account", address, "onchain-stake-stats"] as const,
  lpPositions: (address: string | undefined) =>
    ["account", address, "onchain-lp-positions"] as const,
  lpWithdrawable: (address: string | undefined) =>
    ["account", address, "onchain-lp-withdrawable"] as const,
};

/** DD-130 公开流动性 query keys（不绑 address，免鉴权）。 */
export const liquidityKeys = {
  all: ["liquidity"] as const,
  matchPools: () => ["liquidity", "match-pools"] as const,
  globalPlans: () => ["liquidity", "global-plans"] as const,
};

/**
 * DD-119 Presale query keys。config 公开（不绑 address）；
 * 持仓/历史绑当前登录 address，登出时随 accountKeys 清理路径之外另行 invalidate。
 */
export const presaleKeys = {
  all: ["presale"] as const,
  config: () => ["presale", "config"] as const,
  deposit: (txHash: string) => ["presale", "deposit", txHash] as const,
  depositList: (address: string | undefined, params: Record<string, unknown>) =>
    ["presale", "deposit-list", address, params] as const,
  position: (address: string | undefined) => ["presale", "position", address] as const,
};

/** DD-119 站点级 Referral query keys。 */
export const referralKeys = {
  all: ["referral"] as const,
  me: (address: string | undefined) => ["referral", "me", address] as const,
  list: (address: string | undefined, params: Record<string, unknown>) =>
    ["referral", "list", address, params] as const,
};

/**
 * DD-148 推特(X)绑定 query keys。binding/follow 绑当前登录 address 隔离
 * （切账号 staleTime 窗口内不串号）；解绑/回跳成功按 `all` 前缀一并失效。
 */
export const twitterKeys = {
  all: ["twitter"] as const,
  binding: (address: string | undefined) => ["twitter", "binding", address] as const,
  follow: (address: string | undefined) => ["twitter", "follow", address] as const,
};
