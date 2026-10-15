/**
 * DD-101: useTxStatus — React hook wrapper for tx_status WS subscription.
 *
 * Phase 1 用法：与 wagmi `useWaitForTransactionReceipt` 并行运行做 A/B 对照（不替换）。
 * Phase 2 推广时再考虑封装 `useTxConfirmation(hash)` 把两者合并。
 *
 * 错误处理：
 * - WsDisabledError（env 缺失）→ state = "error"，消费方自行降级到 wagmi RPC
 * - 后端推 timeout / failed → state = "settled" + result.status
 */

"use client";

import { useEffect, useState } from "react";
import { txWs, type TxFinalStatus } from "@/lib/ws/tx-ws";

export type UseTxStatusState =
  | { state: "idle" }
  | { state: "subscribing"; txHash: string }
  | { state: "settled"; txHash: string; result: TxFinalStatus }
  | { state: "error"; txHash: string; error: Error };

export function useTxStatus(
  txHash: string | undefined,
  opts?: { timeoutMs?: number }
): UseTxStatusState {
  const timeoutMs = opts?.timeoutMs;
  const [state, setState] = useState<UseTxStatusState>({ state: "idle" });

  useEffect(() => {
    if (!txHash) {
      setState({ state: "idle" });
      return;
    }
    setState({ state: "subscribing", txHash });
    let cancelled = false;

    let unsubNeeded = true;
    try {
      txWs
        .subscribe(txHash, timeoutMs ? { timeoutMs } : undefined)
        .then((result) => {
          if (cancelled) return;
          unsubNeeded = false; // already settled — server auto-cleans
          setState({ state: "settled", txHash, result });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          unsubNeeded = false; // sub already removed by failSub or never registered
          const error = err instanceof Error ? err : new Error(String(err));
          setState({ state: "error", txHash, error });
        });
    } catch (err) {
      // Synchronous WsDisabledError from getTxWsConfig — consumer should downgrade
      const error = err instanceof Error ? err : new Error(String(err));
      unsubNeeded = false;
      setState({ state: "error", txHash, error });
    }

    return () => {
      cancelled = true;
      if (unsubNeeded) {
        // Component unmounted before settle — release server-side sub.
        // Inner RPC errors already logged in TxWsManager.unsubscribe.
        txWs.unsubscribe(txHash).catch((err: unknown) => {
          console.warn("[useTxStatus] cleanup failed —", err);
        });
      }
    };
  }, [txHash, timeoutMs]);

  return state;
}
