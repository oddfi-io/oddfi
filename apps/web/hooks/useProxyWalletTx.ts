"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Transaction execution phases.
 *
 * idle → approving → executing → confirming → success
 *                                            → failed
 */
export type TxPhase = "idle" | "approving" | "executing" | "confirming" | "success" | "failed";

interface UseProxyWalletTxOptions {
  /** 'swap' for Deposit/Withdraw, 'transfer' for Claim */
  action: "swap" | "transfer";
  /** Override the global mock flag for this instance */
  mock?: boolean;
}

interface UseProxyWalletTxReturn {
  phase: TxPhase;
  txHash: string | undefined;
  errorMessage: string | undefined;
  /**
   * Execute the transaction.
   * In mock mode: simulates approve → execute → confirm with delays.
   * In real mode: will compose useTokenApproval + useWriteContract
   * (available after swap branch merges).
   */
  execute: () => Promise<void>;
  /** Reset back to idle */
  reset: () => void;
}

/**
 * Generic on-chain transaction hook for proxy wallet operations.
 *
 * Reused by:
 *  - Deposit  (swap: user-token → platform-token)
 *  - Claim    (transfer: proxy-wallet ODD → user wallet)
 *  - Withdraw (swap: platform-token → user-token)
 *
 * MVP: runs in mock mode (simulated delays, no real chain calls).
 * Production: will orchestrate useTokenApproval → useWriteContract → useWaitForTransactionReceipt.
 */
export function useProxyWalletTx(options: UseProxyWalletTxOptions): UseProxyWalletTxReturn {
  const isMock = options.mock ?? true;

  const [phase, setPhase] = useState<TxPhase>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setPhase("idle");
    setTxHash(undefined);
    setErrorMessage(undefined);
  }, []);

  const execute = useCallback(async () => {
    abortRef.current = false;
    setErrorMessage(undefined);

    if (isMock) {
      await executeMock(options.action, abortRef, setPhase, setTxHash);
      return;
    }

    // Real mode placeholder — will integrate with on-chain hooks
    // after feat/pancakeswap-swap merges into main.
    console.warn("[useProxyWalletTx] Real mode not yet implemented, falling back to mock");
    await executeMock(options.action, abortRef, setPhase, setTxHash);
  }, [isMock, options.action]);

  return { phase, txHash, errorMessage, execute, reset };
}

// ── Mock execution ────────────────────────────────────────────────

const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

async function executeMock(
  action: "swap" | "transfer",
  abortRef: React.RefObject<boolean>,
  setPhase: (p: TxPhase) => void,
  setTxHash: (h: string | undefined) => void
): Promise<void> {
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  try {
    // Approve phase (only for swap, transfer skips)
    if (action === "swap") {
      setPhase("approving");
      await delay(800);
      if (abortRef.current) return;
    }

    // Execute phase
    setPhase("executing");
    await delay(1000);
    if (abortRef.current) return;

    // Confirming phase
    setPhase("confirming");
    setTxHash(MOCK_TX_HASH);
    await delay(1200);
    if (abortRef.current) return;

    // Success
    setPhase("success");
  } catch {
    setPhase("failed");
  }
}
