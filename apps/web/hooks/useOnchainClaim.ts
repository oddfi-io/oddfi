"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  submitOnchainClaim,
  isOnchainBetNotReadyError,
  classifyClaimError,
  OnchainClaimRevertedError,
} from "@/lib/betting/onchain-claim";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import { accountKeys } from "@/lib/query-keys";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";

// ─── useOnchainClaim ────────────────────────────────────────────────────────
// DD-105 Batch 7 §c — 链上 Claim mutation,镜像 useClaimBet 设计但走 submitOnchainClaim:
//   onchainClaimPayout → tx_hash → viem 轮 BSC receipt → success
//
// 边界:
//   - ErrOnchainBetNotReady(事件索引未回填) → info toast,不当错误处理
//   - tx revert → error toast
//   - RPC 超时 → error toast,提示去 My Bets 复查(tx 已广播)
//
// 文案统一英文(对齐运行时输出英语规则)。

interface UseOnchainClaimOptions {
  onSuccess?: (txHash: `0x${string}`) => void;
  onClose?: () => void;
}

interface OnchainClaimReq {
  betId: string;
}

export function useOnchainClaim({ onSuccess, onClose }: UseOnchainClaimOptions = {}) {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  /** 刷新 active/settled 列表（成功与 guard 终态拒绝共用） */
  const invalidatePortfolioHistory = () => {
    // queryKey 是 readonly unknown[]，includes 可直接调用，不做 string[] 强转（REV-v1-A M-1）
    queryClient.invalidateQueries({
      queryKey: ["account"],
      predicate: (query) =>
        query.queryKey.includes("portfolio-history") ||
        query.queryKey.includes("portfolio-history-infinite"),
    });
  };

  return useMutation({
    mutationFn: (req: OnchainClaimReq) => submitOnchainClaim(req),

    onSuccess: (data) => {
      toastSuccess("Claimed successfully");
      onSuccess?.(data.txHash);
      onClose?.();

      invalidatePortfolioHistory();

      queryClient.invalidateQueries({
        queryKey: accountKeys.balance(address),
      });
    },

    onError: (error: unknown) => {
      if (isOnchainBetNotReadyError(error)) {
        toastInfo("Settlement still indexing on chain. Please try again in a moment.");
        return;
      }
      if (error instanceof OnchainClaimRevertedError) {
        // DD-140 TC — revert 后后端约 15min sweep 将该注单回 WON 可重领，提示用户稍后在 Portfolio 操作
        toastError("Claim transaction reverted. You can retry in Portfolio shortly.");
        return;
      }
      if (error instanceof ReceiptTimeoutError) {
        toastError("Claim submitted but receipt timed out. Check My Bets for the latest status.");
        return;
      }
      // 后端 ENH-007 guard：relay 前同步拒绝（HTTP 400/503，无 tx 上链）。
      // 终态拒绝刷新列表让按钮随状态流转消失；state-unverified 可原地重试不刷新。
      switch (classifyClaimError(error)) {
        case "not-claimable-cashed-out":
          toastError("This bet was cashed out early, no payout to claim");
          invalidatePortfolioHistory();
          return;
        case "not-claimable-claimed":
          toastError("Payout has already been claimed");
          invalidatePortfolioHistory();
          return;
        case "not-claimable":
          toastError("This bet is not claimable");
          invalidatePortfolioHistory();
          return;
        case "state-unverified":
          toastInfo("Network busy, please try again later");
          return;
        default:
          toastError("Network error, please try again");
      }
    },
  });
}
