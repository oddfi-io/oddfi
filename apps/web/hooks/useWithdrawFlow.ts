import { useState, useCallback } from "react";

// ─── useWithdrawFlow ──────────────────────────────────────────────────────────
// DD-080 — Withdraw flow state machine
// form → result（apply 成败都直接落 result 态，不走中间确认态）

export type WithdrawStep = "form" | "result";

interface WithdrawFlowState {
  isOpen: boolean;
  step: WithdrawStep;
}

const INITIAL_STATE: WithdrawFlowState = {
  isOpen: false,
  step: "form",
};

/**
 * Manages the Withdraw modal's multi-step flow state.
 * Local useState — no global store needed.
 */
export function useWithdrawFlow() {
  const [state, setState] = useState<WithdrawFlowState>(INITIAL_STATE);

  const open = useCallback(() => {
    setState({ isOpen: true, step: "form" });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const goToResult = useCallback(() => {
    setState((prev) => ({ ...prev, step: "result" }));
  }, []);

  return {
    ...state,
    open,
    close,
    goToResult,
  };
}
