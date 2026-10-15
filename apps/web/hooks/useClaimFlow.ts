import { useState, useCallback } from "react";
import type { PortfolioBet } from "@/types/portfolio";

// ─── useClaimFlow ───────────────────────────────────────────────────────────
// DD-054 §4.5 — Claim flow state machine
// reward → signature → success（pending 暂保留 step 待真签名接入时启用）
// bets 在 reward 步骤注入，沿用到 signature/success 展示

export type ClaimStep = "reward" | "signature" | "pending" | "success";

interface ClaimFlowState {
  isOpen: boolean;
  step: ClaimStep;
  bets: PortfolioBet[];
}

const INITIAL_STATE: ClaimFlowState = {
  isOpen: false,
  step: "reward",
  bets: [],
};

/**
 * Manages the Claim modal's multi-step flow state.
 * Local useState — no global store needed.
 */
export function useClaimFlow() {
  const [state, setState] = useState<ClaimFlowState>(INITIAL_STATE);

  const openWithBets = useCallback((bets: PortfolioBet[]) => {
    setState({ isOpen: true, step: "reward", bets });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const goToSignature = useCallback(() => {
    setState((prev) => ({ ...prev, step: "signature" }));
  }, []);

  const goToPending = useCallback(() => {
    setState((prev) => ({ ...prev, step: "pending" }));
  }, []);

  const goToSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, step: "success" }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({ ...prev, step: "reward" }));
  }, []);

  return {
    ...state,
    openWithBets,
    close,
    goToSignature,
    goToPending,
    goToSuccess,
    goBack,
  };
}
