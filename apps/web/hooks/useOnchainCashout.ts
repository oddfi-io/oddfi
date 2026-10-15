"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  fetchCashoutQuote,
  submitOnchainCashout,
  classifyCashoutError,
  CashoutQuoteUnavailableError,
  OnchainCashoutRevertedError,
} from "@/lib/betting/onchain-cashout";
import { parseFixtureTimeMs } from "@/lib/adapters/portfolio";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import { accountKeys } from "@/lib/query-keys";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import { useCashingOutBetsStore } from "@/stores/cashingOutBetsStore";
import type { PortfolioBet } from "@/types/portfolio";

// ─── useOnchainCashout ──────────────────────────────────────────────────────
// DD-137 纯方案 B — 链上注单 Cash Out（撤单）。镜像 useOnchainClaim 的 mutation 设计，外加报价 query：
//
//   quote：modal 打开时拉（GET /market/onchain?fixture_id → quoted_odds[outcome] → 预估额），仅供决策展示
//   cashout：Confirm 点击时**重新取鲜** quoteVersion + 生成 quoted_at 立即提交（30s TTL，§3.3），
//            用户在弹窗停留多久都不影响报价时效；betId 用 bet.onchainBetId（不再查 orders/:id）
//
// 文案统一英文（运行时输出英语规则）。

interface UseOnchainCashoutOptions {
  bet: PortfolioBet;
  /** modal 打开时才拉报价 */
  enabled: boolean;
  onSuccess?: (txHash: `0x${string}`) => void;
}

export function useOnchainCashout({ bet, enabled, onSuccess }: UseOnchainCashoutOptions) {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  // 解析失败传 0 → calcCashoutEstimate 保守按 20% fee 档（实际费率合约结算说了算）
  const matchTimeMs = parseFixtureTimeMs(bet.matchTime) ?? 0;
  // 报价输入全部来自 history event_info（adapter 透传）；0 合法（主胜/1X2/line0），判断一律 != null
  const hasQuoteInputs =
    bet.cashoutFixtureId != null &&
    bet.cashoutOutcome != null &&
    bet.cashoutMarketTypeCode != null &&
    bet.cashoutLineCode != null;

  /** 组装 fetchCashoutQuote 入参（nowMs 由调用处注入，保持取鲜语义）*/
  const buildQuoteArgs = (nowMs: number) => ({
    fixtureId: bet.cashoutFixtureId!,
    outcome: bet.cashoutOutcome!,
    marketTypeCode: bet.cashoutMarketTypeCode!,
    lineCode: bet.cashoutLineCode!,
    acceptedAmountWei: bet.cashoutAcceptedAmountWei,
    lockedOddsRaw: bet.cashoutLockedOddsRaw,
    betAmountOdd: bet.betAmount,
    oddsDecimal: bet.odds,
    matchTimeMs,
    nowMs,
  });

  const quote = useQuery({
    queryKey: ["onchain-cashout-quote", bet.onchainBetId],
    enabled: enabled && hasQuoteInputs,
    // nowMs 每次 fetch 取当前时刻是设计意图：feeBps 档位（开赛前 30min 分界）必须随真实时间走，
    // 不要"修复"成固定值——展示预估在临界点从 10% 跳 20% 是正确行为（REV-v1-A m-1）
    queryFn: () => fetchCashoutQuote(buildQuoteArgs(Date.now())),
    // 报价是瞬时值：不缓存复用、不自动重试（market-not-found/no-live-quote 重试也不会立刻好转）
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  /** 刷新 active/settled 列表（与 useOnchainClaim 同一 invalidate 策略） */
  const invalidatePortfolioHistory = () => {
    // queryKey 是 readonly unknown[]，includes 可直接调用，不做 string[] 强转（REV-v1-A M-1）
    queryClient.invalidateQueries({
      queryKey: ["account"],
      predicate: (query) =>
        query.queryKey.includes("portfolio-history") ||
        query.queryKey.includes("portfolio-history-infinite"),
    });
  };

  const cashout = useMutation({
    mutationFn: async () => {
      if (!bet.onchainBetId || !hasQuoteInputs) {
        throw new Error(
          "[OnchainCashout] Missing onchainBetId/quote inputs — button should be hidden"
        );
      }
      // Confirm 时刻取鲜报价（quoteVersion 可能已变，旧值必 revert QuoteVersionMismatch）
      const fresh = await fetchCashoutQuote(buildQuoteArgs(Date.now()));
      return submitOnchainCashout({
        betId: bet.onchainBetId,
        expectedQuoteVersion: fresh.quoteVersion,
        quotedAt: Math.floor(Date.now() / 1000),
      });
    },

    onSuccess: (data) => {
      toastSuccess("Bet cancelled successfully");
      onSuccess?.(data.txHash);

      // ENH-038 — receipt 已确认撤单成功（submitOnchainCashout 内部等 receipt，revert 走 onError）。
      // 乐观标记该 betId「正在取消」：后端 cash_out_state 回写 cashing_out 前（refetch 往返窗口），
      // active 列表据此立即把按钮禁用 + 显示「正在取消」，避免「按钮仍可点 → 二次 Cancel → 链上 revert」。
      // mutationFn 已保证 onchainBetId 非空。
      if (bet.onchainBetId) {
        useCashingOutBetsStore.getState().markCashingOut(bet.onchainBetId);
      }

      invalidatePortfolioHistory();
      queryClient.invalidateQueries({ queryKey: accountKeys.balance(address) });
    },

    onError: (error: unknown) => {
      if (error instanceof CashoutQuoteUnavailableError) {
        // market-not-found（盘口已关/未返回）/ no-live-quote（盘口锁定/降级）→ 暂不可撤
        toastError("Quote temporarily unavailable, please try again later");
        return;
      }
      if (error instanceof OnchainCashoutRevertedError) {
        // 合约所有时间/版本 guard（494 version 不符 / 496 报价 30s TTL 超时 / 500 盘口降级）都 revert
        // 同一个 InvalidQuoteGuard，前端从 receipt 无法区分子因（BUG-026 §6.5）。这三类补救手段相同——
        // 报价失效，重取报价后重试即可，故不再用死胡同文案「reverted on chain」（会被误读成「没修好」），
        // 统一按「报价过期可重试」处理 + refetch，与下方 quote-stale 分支一致。txHash 留 console 供 BscScan 反查。
        console.error(
          "[OnchainCashout] cash_out reverted on chain (InvalidQuoteGuard: version/TTL/odds)",
          {
            txHash: error.txHash,
            betId: bet.onchainBetId,
            fixtureId: bet.cashoutFixtureId,
          }
        );
        toastError("Quote expired, please review the refreshed quote and try again");
        void quote.refetch();
        return;
      }
      if (error instanceof ReceiptTimeoutError) {
        toastError("Cancel submitted but receipt timed out. Check My Bets for the latest status.");
        return;
      }
      switch (classifyCashoutError(error)) {
        case "quote-stale":
          // 报价过期/赔率已变 → 刷新展示报价，引导用户重新 Confirm
          toastError("Odds changed, please review the new quote and try again");
          void quote.refetch();
          return;
        case "already-cashed-out":
          // 后端 ENH-007 guard 同步拒绝（无 tx 上链）：该单已提前兑现（跨设备/回写滞后窗口）。
          // 刷新列表让其流转到已结算 tab，按钮自然消失。
          toastError("This bet has already been cashed out");
          invalidatePortfolioHistory();
          return;
        case "not-cancellable":
          // 终态（已结算/已退款等）：同样刷新列表，避免失效按钮残留可点
          toastError("This bet can no longer be cancelled");
          invalidatePortfolioHistory();
          return;
        case "state-unverified":
          // 后端读链失败降级（HTTP 503 retryable）：不刷新，可原地重试
          toastInfo("Network busy, please try again later");
          return;
        case "not-ready":
          toastInfo("Bet still indexing on chain. Please try again in a moment.");
          return;
        default:
          toastError("Network error, please try again");
      }
    },
  });

  return { quote, cashout };
}
