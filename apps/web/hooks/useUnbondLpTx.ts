"use client";

import { useCallback, useRef, useState } from "react";
import { zeroAddress } from "viem";
import { getContracts } from "@/lib/contracts";
import { CORE_CHAIN } from "@/lib/wagmi.config";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import type { LpPositionState } from "@/lib/abi/liquidityPool";
import { useLpRefetchStore } from "@/stores/lpRefetchStore";
import { toastError } from "@/lib/toast";
import { toUserTxMessage } from "@/lib/onchain/tx-error";
import { submitOnchainRequestUnbond } from "@/lib/liquidity/submit-onchain-lp";

// DD-130：LP 申请赎回从 wagmi 直连改为后端 REST 代签。
// 保留 phase 枚举 + execute(positionId, state, isPaused) 签名，WithdrawLpModal 零改动。
export type UnbondLpTxPhase = "idle" | "executing" | "confirming" | "success" | "failed";

export interface UseUnbondLpTxResult {
  phase: UnbondLpTxPhase;
  txHash: string | undefined;
  errorMessage: string | undefined;
  execute: (positionId: bigint, state: LpPositionState, isPaused: boolean) => void;
  reset: () => void;
}

export function useUnbondLpTx(onSuccess?: () => void): UseUnbondLpTxResult {
  const [phase, setPhase] = useState<UnbondLpTxPhase>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const inFlightRef = useRef(false);
  const bumpLpData = useLpRefetchStore((s) => s.bump);

  const execute = useCallback(
    (positionId: bigint, state: LpPositionState, isPaused: boolean) => {
      // DD-147：闸由「IS_TESTNET」改为「pools 地址是否配置」（未配置链才兜底拦截）
      if (getContracts(CORE_CHAIN.id).pools === zeroAddress) {
        setErrorMessage("Liquidity pool not available on this network");
        setPhase("failed");
        return;
      }
      setErrorMessage(undefined);
      if (isPaused) {
        setErrorMessage("Pool is paused");
        setPhase("failed");
        return;
      }
      // 客户端前置 guard：仅 Ready 可申请赎回（后端不校验，错调会合约 revert）
      if (state !== LP_POSITION_STATE.Ready) {
        setErrorMessage("Position not in unbondable state");
        setPhase("failed");
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      void submitOnchainRequestUnbond({
        positionId: positionId.toString(),
        onState: (s) => {
          if (s === "unbonding") setPhase("executing");
          else if (s === "unbond_confirming") setPhase("confirming");
        },
      })
        .then((res) => {
          setTxHash(res.txHash);
          setPhase("success");
          // DD-141：request_unbond 幂等键由后端按 position_id 派生，无需客户端 seq 生命周期管理。
          bumpLpData();
          onSuccess?.();
        })
        .catch((err: Error) => {
          console.error("[useUnbondLpTx] Transaction failed", err);
          const msg = toUserTxMessage(err);
          setErrorMessage(msg);
          toastError(msg);
          setPhase("failed");
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    },
    [bumpLpData, onSuccess]
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(undefined);
    setErrorMessage(undefined);
  }, []);

  return { phase, txHash, errorMessage, execute, reset };
}
