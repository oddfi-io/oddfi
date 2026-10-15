import { create } from "zustand";
import type { DepositStep } from "@/hooks/useDepositFlow";
import type { TokenMeta } from "@/lib/token-registry";

export interface TxResultData {
  sendAmount: string;
  sendSymbol: string;
  sendIconUrl?: string;
  receiveAmount: string;
  receiveSymbol: string;
  sourceAddress: string;
  /** 源钱包 Provider 图标（MetaMask/OKX/…），来自 useConnectedWalletIcon */
  sourceIconUrl?: string;
  destAddress: string;
}

interface DepositSheetState {
  isOpen: boolean;
  step: DepositStep;
  selectedAsset: TokenMeta | null;
  usdAmount: string;
  txResult: TxResultData | null;
  open: () => void;
  close: () => void;
  goNext: () => void;
  goBack: () => void;
  setStep: (step: DepositStep) => void;
  selectAsset: (asset: TokenMeta) => void;
  setUsdAmount: (amount: string) => void;
  setTxResult: (data: TxResultData) => void;
}

export const useDepositSheetStore = create<DepositSheetState>((set) => ({
  isOpen: false,
  step: "method" as DepositStep,
  selectedAsset: null,
  usdAmount: "",
  txResult: null,
  open: () =>
    set({
      isOpen: true,
      step: "method",
      selectedAsset: null,
      usdAmount: "",
      txResult: null,
    }),
  close: () =>
    set({
      isOpen: false,
      step: "method",
      selectedAsset: null,
      usdAmount: "",
      txResult: null,
    }),
  goNext: () =>
    set((s) => {
      switch (s.step) {
        case "method":
          return { step: "select" };
        case "select":
          return { step: "amount" };
        case "amount":
          return { step: "confirm" };
        case "confirm":
          return { step: "result" };
        default:
          return {}; // receive/result: no linear next
      }
    }),
  goBack: () =>
    set((s) => {
      switch (s.step) {
        case "receive":
        case "select":
          return { step: "method" };
        case "amount":
          return { step: "select" };
        case "confirm":
          return { step: "amount" };
        default:
          return {};
      }
    }),
  setStep: (step) => set({ step }),
  selectAsset: (asset) => set({ selectedAsset: asset }),
  setUsdAmount: (amount) => set({ usdAmount: amount }),
  setTxResult: (data) => set({ txResult: data }),
}));
