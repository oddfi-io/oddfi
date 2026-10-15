import { useState, useCallback } from "react";
import type { TokenMeta } from "@/lib/token-registry";
import type { TxResultData } from "@/stores/depositSheetStore";

export type DepositStep = "method" | "receive" | "select" | "amount" | "confirm" | "result";

interface DepositFlowState {
  isOpen: boolean;
  step: DepositStep;
  selectedAsset: TokenMeta | null;
  /** USD amount entered by user, e.g. "4" */
  usdAmount: string;
  txResult: TxResultData | null;
}

const INITIAL_STATE: DepositFlowState = {
  isOpen: false,
  step: "method",
  selectedAsset: null,
  usdAmount: "",
  txResult: null,
};

/**
 * Manages the Deposit modal's multi-step flow state.
 * Intentionally kept as local useState — no global store needed
 * because the flow is self-contained and destroyed on close.
 */
export function useDepositFlow() {
  const [state, setState] = useState<DepositFlowState>(INITIAL_STATE);

  const open = useCallback(() => {
    setState({ ...INITIAL_STATE, isOpen: true });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => {
      switch (prev.step) {
        case "method":
          return { ...prev, step: "select" };
        case "select":
          return { ...prev, step: "amount" };
        case "amount":
          return { ...prev, step: "confirm" };
        case "confirm":
          return { ...prev, step: "result" };
        default:
          return prev; // receive/result: no linear next
      }
    });
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      switch (prev.step) {
        case "receive":
        case "select":
          return { ...prev, step: "method" };
        case "amount":
          return { ...prev, step: "select" };
        case "confirm":
          return { ...prev, step: "amount" };
        default:
          return prev;
      }
    });
  }, []);

  const setStep = useCallback((step: DepositStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const selectAsset = useCallback((asset: TokenMeta) => {
    setState((prev) => ({ ...prev, selectedAsset: asset }));
  }, []);

  const setUsdAmount = useCallback((amount: string) => {
    setState((prev) => ({ ...prev, usdAmount: amount }));
  }, []);

  const setTxResult = useCallback((data: TxResultData) => {
    setState((prev) => ({ ...prev, txResult: data }));
  }, []);

  return {
    state,
    open,
    close,
    goNext,
    goBack,
    setStep,
    selectAsset,
    setUsdAmount,
    setTxResult,
  };
}
