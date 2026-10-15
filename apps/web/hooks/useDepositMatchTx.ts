"use client";

import { useCallback, useRef, useState } from "react";
import { parseUnits, zeroAddress } from "viem";
import Decimal from "decimal.js";
import { getContracts } from "@/lib/contracts";
import { CORE_CHAIN } from "@/lib/wagmi.config";
import { useIdempotentRefId } from "@/hooks/useIdempotentRefId";
import { useLpRefetchStore } from "@/stores/lpRefetchStore";
import { toastSuccess, toastError } from "@/lib/toast";
import { toUserTxMessage } from "@/lib/onchain/tx-error";
import { submitOnchainDepositMatch } from "@/lib/liquidity/submit-onchain-lp";

// DD-130：比赛池加流动性从 wagmi 直连改为后端 REST 代签。
// 保留 phase 联合类型 + execute 签名，PoolMatchDepositModal 零改动。
// matchId 只能取自 getLiquidityMatchPools（后端不校验 match_id 有效性）。
export type DepositMatchTxPhase =
  | "idle"
  | "checking_allowance"
  | "approving"
  | "confirming_approve"
  | "depositing"
  | "confirming_deposit"
  | "success"
  | "failed";

export interface UseDepositMatchTxResult {
  phase: DepositMatchTxPhase;
  txHash: string | undefined;
  errorMessage: string | undefined;
  execute: (
    amount: string,
    matchId: `0x${string}`,
    isPaused: boolean,
    minDeposit: bigint,
    balanceOf: bigint
  ) => Promise<void>;
  reset: () => void;
}

export function useDepositMatchTx(onSuccess?: () => void): UseDepositMatchTxResult {
  const [phase, setPhase] = useState<DepositMatchTxPhase>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const idem = useIdempotentRefId();
  const inFlightRef = useRef(false);
  const bumpLpData = useLpRefetchStore((s) => s.bump);
  const startSync = useLpRefetchStore((s) => s.startSync);

  const execute = useCallback(
    async (
      amount: string,
      matchId: `0x${string}`,
      isPaused: boolean,
      minDeposit: bigint,
      balanceOf: bigint
    ) => {
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
      let amountBigint: bigint;
      try {
        amountBigint = parseUnits(amount, 18);
      } catch {
        setErrorMessage("Invalid amount format");
        setPhase("failed");
        return;
      }
      if (balanceOf < amountBigint) {
        setErrorMessage("Insufficient ODD balance");
        setPhase("failed");
        return;
      }
      if (amountBigint < minDeposit) {
        setErrorMessage("Amount below minimum deposit");
        setPhase("failed");
        return;
      }
      if (new Decimal(amount).lte(0)) {
        setErrorMessage("Amount must be greater than 0");
        setPhase("failed");
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const res = await submitOnchainDepositMatch({
          matchId,
          stakeOdd: amount,
          seq: idem.getOrCreate(),
          onState: (s) => {
            if (s === "depositing") setPhase("depositing");
            else if (s === "deposit_confirming") setPhase("confirming_deposit");
          },
        });
        setTxHash(res.txHash);
        setPhase("success");
        idem.clear();
        bumpLpData();
        toastSuccess("Liquidity added successfully");
        startSync(); // 进入同步态：切 Positions tab + 占位等新仓位入库
        onSuccess?.();
      } catch (err) {
        console.error("[useDepositMatchTx] Deposit failed", err);
        const msg = toUserTxMessage(err);
        setErrorMessage(msg);
        toastError(msg);
        setPhase("failed");
        idem.clear();
      } finally {
        inFlightRef.current = false;
      }
    },
    [idem, bumpLpData, startSync, onSuccess]
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(undefined);
    setErrorMessage(undefined);
  }, []);

  return { phase, txHash, errorMessage, execute, reset };
}
