import { useQuery } from "@tanstack/react-query";
import { getWithdrawRecordInfo } from "@/lib/api";
import {
  isTerminalWithdrawStatus,
  isSuccessWithdrawStatus,
  isFailedWithdrawStatus,
  type WithdrawRecordInfo,
} from "@/types/auth";

// ─── useWithdrawStatus ────────────────────────────────────────────────────────
// 提现单笔状态轮询 — apply 成功后拿到 order_sn 即可喂入
// 3s 间隔直至终态（3/4/5/6）；终态后 refetchInterval 返 false 自动停止
// queryKey 前缀 "account" 保证 logout 时被 removeQueries({ queryKey: ["account"] }) 清掉
const POLL_INTERVAL_MS = 3_000;

export interface UseWithdrawStatusReturn {
  record: WithdrawRecordInfo | null;
  status: number | null;
  isTerminal: boolean;
  isSuccess: boolean;
  isFailed: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export function useWithdrawStatus(orderSn: string | null | undefined): UseWithdrawStatusReturn {
  const enabled = !!orderSn;

  const query = useQuery({
    queryKey: ["account", "withdraw-status", orderSn] as const,
    queryFn: async () => {
      const res = await getWithdrawRecordInfo([orderSn as string]);
      return res.list[0] ?? null;
    },
    enabled,
    refetchInterval: (q) => {
      const record = q.state.data as WithdrawRecordInfo | null | undefined;
      if (record && isTerminalWithdrawStatus(record.status)) return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
    // 后端查不到 order_sn 会 502（已与后端确认修复中），轮询期容错
    retry: 3,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
  });

  const record = (query.data as WithdrawRecordInfo | null) ?? null;
  const status = record?.status ?? null;

  return {
    record,
    status,
    isTerminal: isTerminalWithdrawStatus(status),
    isSuccess: isSuccessWithdrawStatus(status),
    isFailed: isFailedWithdrawStatus(status),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
  };
}
