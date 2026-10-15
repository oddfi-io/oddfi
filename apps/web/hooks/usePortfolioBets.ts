import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { cancelBets } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

// ─── useCancelBet ──────────────────────────────────────────────────────────────
// DD-087 §4.2 / §5.1：单条 UI 走批量 API（body: { bet_ids: [id] }）
// 成功后 invalidate 所有 active 列表（prefix match）；错误按 §3.3 映射 toast

/**
 * 后端 bet_cancel 错误码 → toast 文案映射（DD-087 §3.3）
 */
function getCancelErrorMessage(code: string | undefined): string {
  switch (code) {
    case "NOT_LIVE_STATUS":
      // cancel.error.notLive
      return "Bet already settled";
    default:
      // claim.error.generic — 网络/未知错误兜底
      return "Network error, please try again";
  }
}

// 单条 FAILED 时抛出的错误，携带后端业务错误码，让 onError 统一映射 toast
class CancelBetItemError extends Error {
  cancelErrorCode?: string;
  constructor(code?: string) {
    super(code ?? "CANCEL_ITEM_FAILED");
    this.name = "CancelBetItemError";
    this.cancelErrorCode = code;
  }
}

export function useCancelBet() {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  return useMutation({
    // 后端 bet_cancel 即使单条失败也返回 HTTP 200 + code:0，
    // 真实结果在 data.results[].status；单条 FAILED 时抛错让 mutateAsync 走 reject，
    // 调用方 await 不会落入成功分支
    mutationFn: async (betId: number) => {
      const data = await cancelBets({ bet_ids: [betId] });
      const result = data?.results?.find((r) => r.bet_id === betId);
      if (result?.status === "FAILED") {
        throw new CancelBetItemError(result.error);
      }
      return data;
    },
    onSuccess: () => {
      toastSuccess("Bet cancelled successfully");
      queryClient.invalidateQueries({
        queryKey: ["account", address],
        predicate: (query) => {
          const key = query.queryKey as string[];
          return key.includes("portfolio-history") || key.includes("portfolio-history-infinite");
        },
      });
    },
    onError: (err: unknown) => {
      // 单条 FAILED → cancelErrorCode；网络层错误 → ky HTTPError 的 responseJSON.code
      const code =
        err instanceof CancelBetItemError
          ? err.cancelErrorCode
          : (err as { responseJSON?: { code?: string } })?.responseJSON?.code;
      toastError(getCancelErrorMessage(code));
    },
  });
}
