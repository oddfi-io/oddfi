"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseUnits } from "viem";
import { useTxLockStore } from "@/stores/txLockStore";
import { useIdempotentRefId } from "@/hooks/useIdempotentRefId";
import { toastError } from "@/lib/toast";
import { toUserTxMessage } from "@/lib/onchain/tx-error";
import { ReceiptTimeoutError } from "@/lib/onchain/receipt-poller";
import { estimateTierSale } from "@/lib/tiersale/api";
import {
  submitTierSaleBuy,
  isSlippageExceeded,
  type TierSaleBuyState,
} from "@/lib/tiersale/submit-tiersale-buy";
import type { TierSaleEstimateRes } from "@/lib/tiersale/types";

/**
 * DD-146 TierSale 购买 hook（BuyCard 核心）。
 *
 * 职责（DD §3.2 / §8.3 / §8.5）：
 * - estimate：输入金额 debounce + 请求序号防竞态（旧响应不覆盖新）。
 * - buy：下单前 re-estimate → 滑点闸（usdt_cost 漂移超阈值中止）→ approve→poll→buy→poll。
 * - nonce：useIdempotentRefId（一次意图锁定，retry 复用，成功/可重试失败后换新）。
 * - 重入锁：useTxLockStore("tiersale") + inFlightRef，防双击。
 * - 轮询超时：进 `reconciling` 对账态，canRetry=false，**禁止盲重发**（防双买）。
 * - 运行时输出英文（code-quality.md）；不静默 catch。
 *
 * USDT 18 位（mainnet 0x55d398...）。下单数值一律来自 fresh estimate，mock/静态档位不得驱动真实购买（§8.5 S-Major）。
 */

const USDT_DECIMALS = 18;
const ESTIMATE_DEBOUNCE_MS = 400;
const SLIPPAGE_TOLERANCE_BPS = 100; // 1%

export type TierSaleBuyPhase =
  | "idle"
  | TierSaleBuyState // approving | approve_confirming | buying | buy_confirming | success
  | "failed"
  | "reconciling"; // poll 超时：tx 可能已上链，去记录核对，禁止盲重发

export interface UseTierSaleBuyResult {
  /** 最近一次 estimate 结果（驱动 BuyCard 信息面板 + 下单数值）。 */
  estimate: TierSaleEstimateRes | null;
  estimating: boolean;
  estimateError: string | undefined;
  phase: TierSaleBuyPhase;
  buyTxHash: string | undefined;
  errorMessage: string | undefined;
  /** reverted / 网络错误 → true（换 nonce 重试）；reconciling → false（禁止盲重发）。 */
  canRetry: boolean;
  /** 是否处于进行中（按钮 disabled + spinner）。 */
  isBusy: boolean;
  /** 金额输入变化（人类可读 USDT 串）→ debounce estimate。 */
  setUsdtAmount: (amount: string) => void;
  /** 发起购买（无参；用内部最新 estimate）。 */
  buy: () => void;
  /** 重置到 idle（不动 estimate）。 */
  reset: () => void;
}

const BUSY_PHASES: ReadonlySet<TierSaleBuyPhase> = new Set([
  "approving",
  "approve_confirming",
  "buying",
  "buy_confirming",
]);

export function useTierSaleBuy(onSuccess?: () => void): UseTierSaleBuyResult {
  const [estimate, setEstimate] = useState<TierSaleEstimateRes | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | undefined>();
  const [phase, setPhase] = useState<TierSaleBuyPhase>("idle");
  const [buyTxHash, setBuyTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [canRetry, setCanRetry] = useState(false);

  const idem = useIdempotentRefId();
  const inFlightRef = useRef(false);
  const amountRef = useRef("");
  const estimateSeqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载清理 debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // 单次 estimate 请求（seq 守卫：仅当本次仍是最新请求才落地）。
  const runEstimate = useCallback(async (amount: string) => {
    const seq = ++estimateSeqRef.current;
    setEstimating(true);
    setEstimateError(undefined);
    try {
      const res = await estimateTierSale({ usdt_amount: amount });
      if (seq !== estimateSeqRef.current) return; // 过期响应丢弃
      setEstimate(res);
    } catch (err) {
      if (seq !== estimateSeqRef.current) return;
      console.error("[useTierSaleBuy] Estimate failed", err);
      setEstimate(null);
      setEstimateError(toUserTxMessage(err));
    } finally {
      if (seq === estimateSeqRef.current) setEstimating(false);
    }
  }, []);

  const setUsdtAmount = useCallback(
    (amount: string) => {
      amountRef.current = amount;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      const trimmed = amount.trim();
      // 空/非正数 → 清空 estimate，不打接口
      if (!trimmed || !(Number(trimmed) > 0)) {
        estimateSeqRef.current++; // 作废挂起响应
        setEstimate(null);
        setEstimating(false);
        setEstimateError(undefined);
        return;
      }
      debounceTimerRef.current = setTimeout(() => void runEstimate(trimmed), ESTIMATE_DEBOUNCE_MS);
    },
    [runEstimate]
  );

  const buy = useCallback(() => {
    if (inFlightRef.current) return;
    const amount = amountRef.current.trim();
    if (!amount || !(Number(amount) > 0)) return;
    const prevEstimate = estimate;

    inFlightRef.current = true;
    setErrorMessage(undefined);
    setCanRetry(false);
    setBuyTxHash(undefined);
    useTxLockStore.getState().lock("tiersale");

    void (async () => {
      try {
        // 1) 下单前 re-estimate —— 取链上实时档位/花费（mock/静态档位绝不驱动真实购买）
        const fresh = await estimateTierSale({ usdt_amount: amount });
        setEstimate(fresh);
        if (!fresh.odd_amount_wei || !(Number(fresh.odd_amount) > 0)) {
          // 售罄 / 预算太小
          setErrorMessage("This amount can no longer be filled. Please adjust and try again.");
          setCanRetry(true);
          setPhase("failed");
          return;
        }

        // 2) 滑点闸：与用户上次看到的花费比对
        if (
          prevEstimate &&
          isSlippageExceeded(prevEstimate.usdt_cost, fresh.usdt_cost, SLIPPAGE_TOLERANCE_BPS)
        ) {
          setErrorMessage("Price changed, please review the new estimate and confirm again.");
          setCanRetry(true);
          setPhase("failed");
          return;
        }

        // 3) approve(USDT)→poll→buy(ODD)→poll
        const usdtApproveWei = parseUnits(fresh.usdt_cost as `${number}`, USDT_DECIMALS).toString();
        const res = await submitTierSaleBuy({
          oddAmountWei: fresh.odd_amount_wei,
          usdtApproveWei,
          nonce: idem.getOrCreate(),
          onState: (s) => setPhase(s),
        });
        setBuyTxHash(res.buyTxHash);
        setPhase("success");
        idem.clear(); // 下一笔换新 nonce
        onSuccess?.();
      } catch (err) {
        const msg = toUserTxMessage(err);
        if (err instanceof ReceiptTimeoutError) {
          // tx 已上链但前端超时 → 对账态，保留 nonce（不盲重发），引导去记录核对
          console.warn("[useTierSaleBuy] Receipt timeout — entering reconciliation", err);
          setErrorMessage(msg);
          setCanRetry(false);
          setPhase("reconciling");
        } else {
          // reverted / 503 / 网络错误 → 可重试。
          // reverted（tx 已上链失败）换新 nonce；其余（未上链）复用同 nonce 由后端去重兜底。
          console.error("[useTierSaleBuy] Buy failed", err);
          const name = (err as { name?: string })?.name ?? "";
          if (name.endsWith("RevertedError")) idem.clear();
          setErrorMessage(msg);
          toastError(msg);
          setCanRetry(true);
          setPhase("failed");
        }
      } finally {
        inFlightRef.current = false;
        if (useTxLockStore.getState().lockedBy === "tiersale") {
          useTxLockStore.getState().unlock();
        }
      }
    })();
  }, [estimate, idem, onSuccess]);

  const reset = useCallback(() => {
    setPhase("idle");
    setBuyTxHash(undefined);
    setErrorMessage(undefined);
    setCanRetry(false);
  }, []);

  return {
    estimate,
    estimating,
    estimateError,
    phase,
    buyTxHash,
    errorMessage,
    canRetry,
    isBusy: BUSY_PHASES.has(phase),
    setUsdtAmount,
    buy,
    reset,
  };
}
