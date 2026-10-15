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
import { submitOnchainDepositGlobal } from "@/lib/liquidity/submit-onchain-lp";

// DD-130：全局池加流动性从 wagmi 直连改为后端 REST 代签（后端内部自动 approve）。
// 保留 phase 联合类型（含历史 approve 档）+ execute 签名，PoolDepositModal 零改动。
// REST 路径无 approve 步，approve 相关 phase 不再 emit。
export type DepositGlobalTxPhase =
  | "idle"
  | "checking_allowance"
  | "approving"
  | "confirming_approve"
  | "depositing"
  | "confirming_deposit"
  | "success"
  | "failed";

export interface UseDepositGlobalTxResult {
  phase: DepositGlobalTxPhase;
  txHash: string | undefined;
  errorMessage: string | undefined;
  execute: (
    amount: string,
    planId: number,
    isPaused: boolean,
    minDeposit: bigint,
    balanceOf: bigint
  ) => Promise<void>;
  reset: () => void;
}

export function useDepositGlobalTx(onSuccess?: () => void): UseDepositGlobalTxResult {
  const [phase, setPhase] = useState<DepositGlobalTxPhase>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const idem = useIdempotentRefId();
  const inFlightRef = useRef(false);
  const bumpLpData = useLpRefetchStore((s) => s.bump);
  const startSync = useLpRefetchStore((s) => s.startSync);

  const execute = useCallback(
    async (
      amount: string,
      planId: number,
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

      // 客户端前置 guard（后端最终以链上 balanceOf / min 为准）
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
        const res = await submitOnchainDepositGlobal({
          planId,
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
        console.error("[useDepositGlobalTx] Deposit failed", err);
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
