"use client";

import { useCallback, useRef, useState } from "react";
import { zeroAddress } from "viem";
import { getContracts } from "@/lib/contracts";
import { CORE_CHAIN } from "@/lib/wagmi.config";
import { useTxLockStore } from "@/stores/txLockStore";
import { toastError } from "@/lib/toast";
import { toUserTxMessage } from "@/lib/onchain/tx-error";
import { submitOnchainUnstake, type UnstakeOp } from "@/lib/staking/submit-onchain-stake";

// DD-130：解押 / 提前解押从 wagmi 直连改为后端 REST 代签。
// 保留 bigint positionId 入参 + lastPositionId/lastOp 返回形状，UnstakeTab/PositionCard 零改动。
export type UnstakeTxPhase = "idle" | "executing" | "confirming" | "success" | "failed";
export type { UnstakeOp };

export interface UseUnstakeTxResult {
  phase: UnstakeTxPhase;
  lastOp: UnstakeOp | undefined;
  /** 当前正在解押的 positionId（PositionCard 据此渲染自身 spinner） */
  lastPositionId: bigint | undefined;
  txHash: string | undefined;
  errorMessage: string | undefined;
  executeUnstake: (positionId: bigint) => void;
  executeEarlyUnstake: (positionId: bigint) => void;
  reset: () => void;
}

export function useUnstakeTx(onSuccess?: () => void): UseUnstakeTxResult {
  const [phase, setPhase] = useState<UnstakeTxPhase>("idle");
  const [lastOp, setLastOp] = useState<UnstakeOp | undefined>(undefined);
  const [lastPositionId, setLastPositionId] = useState<bigint | undefined>(undefined);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const inFlightRef = useRef(false);

  const run = useCallback(
    (positionId: bigint, op: UnstakeOp) => {
      // DD-147：闸由「IS_TESTNET」改为「stakingPool 地址是否配置」（未配置链才兜底拦截）
      if (getContracts(CORE_CHAIN.id).stakingPool === zeroAddress) {
        setErrorMessage("Staking not available");
        setPhase("failed");
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setErrorMessage(undefined);
      setLastOp(op);
      setLastPositionId(positionId);
      useTxLockStore.getState().lock(op);

      void submitOnchainUnstake({
        positionId: positionId.toString(),
        op,
        onState: (s) => {
          if (s === "unstaking") setPhase("executing");
          else if (s === "unstake_confirming") setPhase("confirming");
        },
      })
        .then((res) => {
          setTxHash(res.txHash);
          setPhase("success");
          onSuccess?.();
        })
        .catch((err: Error) => {
          console.error("[useUnstakeTx] Transaction failed", err);
          const msg = toUserTxMessage(err);
          setErrorMessage(msg);
          toastError(msg);
          setPhase("failed");
        })
        .finally(() => {
          inFlightRef.current = false;
          const heldBy = useTxLockStore.getState().lockedBy;
          if (heldBy === "unstake" || heldBy === "earlyUnstake") {
            useTxLockStore.getState().unlock();
          }
        });
    },
    [onSuccess]
  );

  const executeUnstake = useCallback((positionId: bigint) => run(positionId, "unstake"), [run]);
  const executeEarlyUnstake = useCallback(
    (positionId: bigint) => run(positionId, "earlyUnstake"),
    [run]
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setLastOp(undefined);
    setLastPositionId(undefined);
    setTxHash(undefined);
    setErrorMessage(undefined);
  }, []);

  return {
    phase,
    lastOp,
    lastPositionId,
    txHash,
    errorMessage,
    executeUnstake,
    executeEarlyUnstake,
    reset,
  };
}
