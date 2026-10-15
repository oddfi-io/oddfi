"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { claimPrize } from "@/lib/api";
import { accountKeys } from "@/lib/query-keys";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";

// ─── useClaimBet ────────────────────────────────────────────────────────────
// DD-087 Batch 4 §4.3：Settled Claim mutation
// - onSuccess: refetch settled list (accountKeys prefix) + global balance
// - already_claimed=true → info toast（不当错误处理）
// - 错误码全表见 DD-087 §3.3
// - toast 文案统一英文（对齐 useCancelBet 与「运行时输出英语强制」规则）

/** 后端 bet_claim 错误码 → 英文 toast 文案 */
const ERROR_CODE_TO_MSG: Record<string, string> = {
  BET_NOT_FOUND: "Bet not found",
  INVALID_BET_STATUS_FOR_CLAIM: "Bet not eligible for claim",
  INVALID_CLAIM_AMOUNT: "Claimable amount changed, please retry",
  CLAIM_AMOUNT_MISMATCH: "Claimable amount changed, please retry",
  INSUFFICIENT_CLAIMABLE_BALANCE: "Service unavailable, contact support",
  MULTIPLE_CLAIMABLE_BALANCE_ROWS: "Service unavailable, contact support",
  CONCURRENCY_CLAIM_ERROR: "Claim in progress, please wait",
};

interface UseClaimBetOptions {
  onSuccess?: (betId: number, amount: number) => void;
  onClose?: () => void;
}

/**
 * 单注 Claim mutation（DD-087 Batch 4）
 *
 * 使用：
 * ```tsx
 * const { mutate: claim, isPending } = useClaimBet({ onSuccess: () => setOpen(false) });
 * claim({ bet_id: bet.id });
 * ```
 */
export function useClaimBet({ onSuccess, onClose }: UseClaimBetOptions = {}) {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  return useMutation({
    mutationFn: (req: { bet_id: number }) => claimPrize(req),

    onSuccess: (data) => {
      // 幂等命中：info toast，不当错误处理
      if (data.already_claimed) {
        toastInfo("This bet has already been claimed");
        onClose?.();
        return;
      }

      // 正常成功
      toastSuccess("Claimed successfully");
      onSuccess?.(data.bet_id, data.amount);
      onClose?.();

      // refetch settled 列表（invalidate 所有 portfolio-history key）
      queryClient.invalidateQueries({
        queryKey: ["account"],
        predicate: (query) => {
          const key = query.queryKey as string[];
          return key.includes("portfolio-history") || key.includes("portfolio-history-infinite");
        },
      });

      // refetch 全局 balance
      queryClient.invalidateQueries({
        queryKey: accountKeys.balance(address),
      });
    },

    onError: (error: unknown) => {
      // 从 ky HTTPError 中提取后端 code 字段
      const code = extractErrorCode(error);
      const msg = (code && ERROR_CODE_TO_MSG[code]) || "Network error, please try again";
      toastError(msg);
    },
  });
}

/** 从 ky HTTPError 中提取后端 code 字段（对齐 useCancelBet 的模式） */
function extractErrorCode(error: unknown): string | null {
  // ky HTTPError 携带 responseJSON（后端 { code, message, data }）
  const code = (error as { responseJSON?: { code?: string } })?.responseJSON?.code;
  return code ?? null;
}
