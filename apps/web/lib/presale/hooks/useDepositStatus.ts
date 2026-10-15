"use client";

/**
 * DD-119 §6.1 GET /deposit/:txHash 轮询。
 *
 * pending → 5s/次继续轮；confirmed/anomaly → 停。最多 5min（由调用方 useDeposit 控超时）。
 * 40405 TX_NOT_FOUND（worker 还没确认/上报失败）→ 不报错，合成 pending 继续轮（§5.1）。
 */
import { useQuery } from "@tanstack/react-query";
import { presaleKeys } from "@/lib/query-keys";
import { getDeposit } from "../api";
import type { Deposit } from "../types";

export const DEPOSIT_POLL_INTERVAL_MS = 5_000;

/** ky HTTPError → 业务码（proxy 把 upstream 40405 透传为 body.code / status 404）。 */
async function isTxNotFound(err: unknown): Promise<boolean> {
  if (!err || typeof err !== "object" || !("response" in err)) return false;
  const res = (err as { response: Response }).response;
  if (res.status === 404) return true;
  try {
    const body = await res.clone().json();
    return body?.code === 40405;
  } catch {
    return false;
  }
}

export function useDepositStatus(txHash: string | null, enabled: boolean) {
  return useQuery<Deposit>({
    queryKey: presaleKeys.deposit(txHash ?? ""),
    enabled: enabled && !!txHash,
    staleTime: 0,
    retry: false,
    queryFn: async (): Promise<Deposit> => {
      try {
        return await getDeposit(txHash!);
      } catch (err) {
        if (await isTxNotFound(err)) {
          // worker 未确认 → 合成 pending 占位，保持轮询
          return {
            depositId: "",
            txHash: txHash!,
            status: "pending",
            anomalyReason: null,
            roundId: "",
            amountUsdt: "",
            sharesOdd: "",
            blockTimestamp: 0,
          };
        }
        throw err;
      }
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return DEPOSIT_POLL_INTERVAL_MS;
      return data.status === "pending" ? DEPOSIT_POLL_INTERVAL_MS : false;
    },
  });
}
