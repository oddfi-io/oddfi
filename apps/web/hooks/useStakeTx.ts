"use client";

import { useCallback, useRef, useState } from "react";
import { zeroAddress } from "viem";
import { getContracts } from "@/lib/contracts";
import { CORE_CHAIN } from "@/lib/wagmi.config";
import { useTxLockStore } from "@/stores/txLockStore";
import { useIdempotentRefId } from "@/hooks/useIdempotentRefId";
import { toastError } from "@/lib/toast";
import { toUserTxMessage } from "@/lib/onchain/tx-error";
import { submitOnchainStake } from "@/lib/staking/submit-onchain-stake";
import type { LockHoursKey } from "@/lib/staking-plans";

// DD-130：质押从 wagmi 直连改为后端 REST 代签。
// 保留 StakeTxPhase 联合类型（含历史 "approving"）以免 StakeTab 比较分支改动；
// REST 路径无 approve 步，"approving" 不再被 emit。
export type StakeTxPhase = "idle" | "approving" | "staking" | "confirming" | "success" | "failed";

export interface UseStakeTxResult {
  phase: StakeTxPhase;
  txHash: string | undefined;
  errorMessage: string | undefined;
  /**
   * execute(amount, lockHoursKey)：lockHoursKey = 透传 key（8/16/24/32/40/48），后端反查 plan_id。
   * 入参收紧为 branded LockHoursKey —— 误传 lockDays（7/30/…）当 key 在编译期报错（命门降级）。
   */
  execute: (amount: string, lockHoursKey: LockHoursKey) => void;
  reset: () => void;
}

export function useStakeTx(onSuccess?: () => void): UseStakeTxResult {
  const [phase, setPhase] = useState<StakeTxPhase>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const idem = useIdempotentRefId();
  // 防并发重入：同一笔进行中拒绝再次 execute
  const inFlightRef = useRef(false);

  const execute = useCallback(
    (amount: string, lockHoursKey: LockHoursKey) => {
      // DD-147：defense-in-depth 闸由「IS_TESTNET」改为「stakingPool 地址是否配置」——
      // 未部署/未配置链才兜底拦截（兼容多链，扩链零改）。
      if (getContracts(CORE_CHAIN.id).stakingPool === zeroAddress) {
        setErrorMessage("Staking not available on this network");
        setPhase("failed");
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setErrorMessage(undefined);
      useTxLockStore.getState().lock("stake");

      void submitOnchainStake({
        lockHours: lockHoursKey,
        stakeOdd: amount,
        seq: idem.getOrCreate(),
        onState: (s) => {
          if (s === "staking") setPhase("staking");
          else if (s === "stake_confirming") {
            setPhase("confirming");
          }
        },
      })
        .then((res) => {
          setTxHash(res.txHash);
          setPhase("success");
          idem.clear();
          onSuccess?.();
        })
        .catch((err: Error) => {
          console.error("[useStakeTx] Stake failed", err);
          const msg = toUserTxMessage(err);
          setErrorMessage(msg);
          toastError(msg);
          setPhase("failed");
          idem.clear();
        })
        .finally(() => {
          inFlightRef.current = false;
          if (useTxLockStore.getState().lockedBy === "stake") {
            useTxLockStore.getState().unlock();
          }
        });
    },
    [idem, onSuccess]
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(undefined);
    setErrorMessage(undefined);
  }, []);

  return { phase, txHash, errorMessage, execute, reset };
}
