"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWalletClient } from "wagmi";
import type { Execute } from "@relayprotocol/relay-sdk";
import type { BridgeExecutionState } from "@/lib/relay/types";

const IDLE_STATE: BridgeExecutionState = {
  status: "idle",
  currentStep: 0,
  totalSteps: 0,
  txHashes: [],
};

/**
 * Swap 页面 Bridge Tab 的跨链执行 Hook
 *
 * 与 useRelayDepositTx 不同，此 hook 不自行管理报价，由调用方传入已有报价（Execute）。
 * 内部仅封装 SDK actions.execute 调用 + onProgress 状态机。
 */
export function useRelayExecute() {
  const { data: walletClient } = useWalletClient();
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [state, setState] = useState<BridgeExecutionState>(IDLE_STATE);

  const reset = useCallback(() => setState(IDLE_STATE), []);

  const execute = useCallback(
    async (quote: Execute) => {
      if (!walletClient) {
        setState({ ...IDLE_STATE, status: "failed", errorMessage: "Wallet not connected" });
        return;
      }

      // 初始化：signing 状态，步骤总数从 quote 推断
      setState({
        status: "signing",
        currentStep: 0,
        totalSteps: quote.steps?.length ?? 0,
        txHashes: [],
      });

      try {
        const { getRelayClient } = await import("@/lib/relay/client");
        const client = await getRelayClient();

        await client.actions.execute({
          quote,
          wallet: walletClient,
          onProgress: (data) => {
            if (!mountedRef.current) return;

            if (data.error) {
              console.error("[useRelayExecute] Relay execution error", data.error);
              setState((s) => ({
                ...s,
                status: "failed",
                errorMessage: "Transaction failed. Refund initiated to your wallet.",
              }));
              return;
            }

            const collectedHashes = (data.txHashes ?? []).map((h) => h.txHash);
            const stepId = data.currentStep?.id ?? "";

            // 有交易哈希 = 已提交链上（Relaying），否则等待钱包签名
            const nextStatus: BridgeExecutionState["status"] =
              collectedHashes.length > 0 ? "relaying" : "signing";

            // 通过 stepId 在 steps 数组中定位当前步骤下标
            const steps = data.steps ?? [];
            const stepIndex = Math.max(
              0,
              steps.findIndex((s) => s.id === stepId)
            );

            // W1 fix: onProgress 非错误路径也用函数式更新，防止覆盖已有 failed 状态
            setState((s) => {
              if (s.status === "failed") return s;
              return {
                status: nextStatus,
                currentStep: stepIndex,
                totalSteps: steps.length || (quote.steps?.length ?? 0),
                txHashes: collectedHashes,
              };
            });
          },
        });

        if (mountedRef.current) {
          // 不覆盖 onProgress 已设置的 failed 状态（SDK 执行失败后仍会 resolve）
          setState((s) => (s.status === "failed" ? s : { ...s, status: "completed" }));
        }
      } catch (err) {
        if (!mountedRef.current) return;
        console.error("[useRelayExecute] Execute failed", err);
        setState((s) => ({
          ...s,
          status: "failed",
          errorMessage:
            err instanceof Error
              ? (err.message.split("\n")[0]?.slice(0, 120) ?? "Transaction failed")
              : "Transaction failed",
        }));
      }
    },
    [walletClient]
  );

  return { state, execute, reset };
}
