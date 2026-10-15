"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { usePancakeQuote, createPancakeSwap } from "@/lib/swap/pancake-adapter";
import { useTokenApproval } from "./useTokenApproval";
import { useProxyWallet } from "./useProxyWallet";
import { ERC20_ABI } from "@/lib/swap/constants";
import { PLATFORM_TOKEN } from "@/lib/platform-token";
import { div, formatAmount } from "@/lib/decimal";
import type { TokenMeta } from "@/lib/token-registry";

// ── Types ────────────────────────────────────────────────────────

export type DepositTxPhase =
  | "idle"
  | "approving"
  | "executing"
  | "confirming"
  | "success"
  | "failed";

export interface DepositQuoteData {
  amountOutFormatted: string;
  rate: string;
  priceImpact: string;
  minReceivedFormatted: string;
  routeLabel: string;
}

interface UseDepositTxOptions {
  selectedAsset: TokenMeta;
  /** USD amount string, e.g. "50" */
  usdAmount: string;
  /** Per-unit USD price of selectedAsset */
  assetUsdPrice: string;
  /** True when selectedAsset IS the platform token (transfer, no swap) */
  isPlatformToken: boolean;
}

interface UseDepositTxReturn {
  phase: DepositTxPhase;
  txHash: string | undefined;
  errorMessage: string | undefined;
  quoteData: DepositQuoteData | null;
  isQuoteLoading: boolean;
  execute: () => void;
  reset: () => void;
}

// ── Default slippage for deposit swaps (0.5% = 50 bps) ──────────
const DEPOSIT_SLIPPAGE_BPS = 50;

// ── Hook ─────────────────────────────────────────────────────────

export function useDepositTx({
  selectedAsset,
  usdAmount,
  assetUsdPrice,
  isPlatformToken,
}: UseDepositTxOptions): UseDepositTxReturn {
  const { address } = useAccount();
  const { wallet } = useProxyWallet();
  const proxyAddress = wallet?.address as `0x${string}` | undefined;

  // Phase state machine
  const [phase, setPhase] = useState<DepositTxPhase>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const abortRef = useRef(false);

  // Compute the token amount from USD (decimal.js precision, no native floats)
  const tokenAmountStr = useMemo(() => {
    if (!usdAmount || !assetUsdPrice || assetUsdPrice === "0") return "0";
    return formatAmount(div(usdAmount, assetUsdPrice), selectedAsset.decimals);
  }, [usdAmount, assetUsdPrice, selectedAsset.decimals]);

  const amountInBigint = useMemo(() => {
    try {
      return parseUnits(tokenAmountStr, selectedAsset.decimals);
    } catch {
      return 0n;
    }
  }, [tokenAmountStr, selectedAsset.decimals]);

  // ── On-chain quote (adapter — swap path only) ───────────────────
  const pancakeParams =
    !isPlatformToken && address && proxyAddress
      ? {
          fromToken: selectedAsset,
          toToken: PLATFORM_TOKEN,
          amount: tokenAmountStr,
          slippageBps: DEPOSIT_SLIPPAGE_BPS,
          recipient: proxyAddress,
          owner: address,
        }
      : undefined;

  const { data: quote, isLoading: isQuoteLoading } = usePancakeQuote(pancakeParams);

  // ── Approval (swap path only — transfer doesn't need router approval) ──
  const approval = useTokenApproval(
    address,
    isPlatformToken ? undefined : selectedAsset,
    isPlatformToken ? 0n : amountInBigint
  );

  // ── Write contract hooks (for ERC-20 transfer + reactive tx tracking) ──
  const { writeContract, data: writeTxHash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isWriteSuccess } = useWaitForTransactionReceipt({
    hash: writeTxHash,
  });

  // ── Auto-chain: approval confirmed → fire swap ─────────────────
  const [autoSwapPending, setAutoSwapPending] = useState(false);
  const handledApproveHashRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!autoSwapPending || !approval.isApproveConfirmed || approval.isApproving) return;
    if (approval.approveTxHash === handledApproveHashRef.current) return;
    handledApproveHashRef.current = approval.approveTxHash;

    setAutoSwapPending(false);
    setPhase("executing");
    executeSwap();
    // Safe: amount/asset are locked once Step5 renders — no user-driven
    // re-renders between approval confirmation and swap execution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSwapPending, approval.isApproveConfirmed, approval.isApproving, approval.approveTxHash]);

  // ── Track write tx lifecycle → phase transitions ───────────────
  useEffect(() => {
    if (writeTxHash && isConfirming) {
      setTxHash(writeTxHash);
      setPhase("confirming");
    }
  }, [writeTxHash, isConfirming]);

  useEffect(() => {
    if (isWriteSuccess) {
      setPhase("success");
    }
  }, [isWriteSuccess]);

  // ── Execute swap (internal) ────────────────────────────────────
  function executeSwap() {
    if (!address || !proxyAddress) return;

    const onError = (err: Error) => {
      console.error("[useDepositTx] Swap rejected", err);
      setErrorMessage(err.message?.split("\n")[0]?.slice(0, 100) || "Transaction failed");
      setPhase("failed");
    };

    if (isPlatformToken) {
      // ERC-20 transfer — send platform token directly to proxy wallet
      const tokenAddress = selectedAsset.address as `0x${string}`;
      writeContract(
        {
          abi: ERC20_ABI,
          address: tokenAddress,
          functionName: "transfer",
          args: [proxyAddress, amountInBigint],
        },
        { onError }
      );
      return;
    }

    // Swap path — use adapter, `to` = proxy wallet
    if (!quote || !pancakeParams) return;

    const adapter = createPancakeSwap(pancakeParams);

    adapter
      .execute(quote)
      .then((hash) => {
        setTxHash(hash);
        setPhase("confirming");
      })
      .catch(onError);
  }

  // ── Build quote data for display ───────────────────────────────
  const quoteData = useMemo((): DepositQuoteData | null => {
    if (isPlatformToken) {
      return {
        amountOutFormatted: tokenAmountStr,
        rate: "1.000000",
        priceImpact: "0",
        minReceivedFormatted: tokenAmountStr,
        routeLabel: `${selectedAsset.symbol} → ODD Wallet`,
      };
    }
    if (!quote) return null;
    return {
      amountOutFormatted: quote.amountOutFormatted,
      rate: quote.rate,
      priceImpact: quote.priceImpact,
      minReceivedFormatted: quote.minReceivedFormatted,
      routeLabel:
        quote.path.length === 2
          ? `${selectedAsset.symbol} → ${PLATFORM_TOKEN.symbol}`
          : `${selectedAsset.symbol} → BNB → ${PLATFORM_TOKEN.symbol}`,
    };
  }, [isPlatformToken, quote, selectedAsset.symbol, tokenAmountStr]);

  // ── Public API ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current = true;
    setPhase("idle");
    setTxHash(undefined);
    setErrorMessage(undefined);
    setAutoSwapPending(false);
  }, []);

  const execute = useCallback(() => {
    abortRef.current = false;
    setErrorMessage(undefined);

    if (!address || !proxyAddress) {
      setErrorMessage("Wallet not connected");
      setPhase("failed");
      return;
    }

    if (isPlatformToken) {
      // Transfer: no approval needed, execute directly
      setPhase("executing");
      executeSwap();
    } else if (approval.needsApproval) {
      // Swap: approve first, then auto-chain to swap
      setPhase("approving");
      setAutoSwapPending(true);
      approval.approve({
        onError(err) {
          console.error("[useDepositTx] Approval rejected", err);
          setErrorMessage("Approval rejected");
          setPhase("failed");
          setAutoSwapPending(false);
        },
      });
    } else {
      // Swap: already approved, execute directly
      setPhase("executing");
      executeSwap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformToken, address, proxyAddress, approval.needsApproval, quote]);

  return {
    phase,
    txHash,
    errorMessage,
    quoteData,
    isQuoteLoading,
    execute,
    reset,
  };
}
